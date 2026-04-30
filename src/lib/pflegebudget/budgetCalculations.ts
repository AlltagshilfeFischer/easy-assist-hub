// =============================================================
// Pflegebudget Business-Logik
// Alle Berechnungen erfolgen dynamisch aus Kunden-Stammdaten
// + abgerechneten Transaktionen (billed=true)
// =============================================================

import type {
  BudgetTransaction,
  BudgetAvailability,
  BillingSuggestion,
  AllocationStatus,
  ServiceType,
  SplitAllocation,
  Tariff,
  CareLevel,
  AbrechnungsRow,
} from '@/types/domain';

// Jahreslimit Verhinderungspflege (gesetzlich fixiert)
const VP_JAHRESBUDGET = 3539;
// Monatlicher Entlastungsbetrag pro PG >= 1
const EB_MONATSBETRAG = 131;

// ─── Privatversicherten-Erkennung ───────────────────────────

/**
 * Prüft, ob ein Kunde privatversichert ist.
 * GKV-Format: 1 Buchstabe + 9 Ziffern
 */
export function isPrivateInsured(versichertennummer: string | null | undefined): boolean {
  if (!versichertennummer) return true;
  const pattern = /^[A-Za-z]\d{9}$/;
  return !pattern.test(versichertennummer.trim());
}

// ─── Währungsformatierung ────────────────────────────────────

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

// ─── Entlastungsbudget-Berechnung (FIFO, Vorjahresrest) ─────

/**
 * Berechnet das Jahres-Entlastungsbudget für einen Kunden.
 * Vorjahresrest verfällt am 01.07. (Monate 1-6 nutzbar).
 *
 * @param pflegegrad           Pflegegrad des Kunden
 * @param initialBudget        Vorjahresrest (initial_budget_entlastung)
 * @param consumedEntYear      Bereits verbrauchter EB (billed=true im Jahr)
 * @param currentYear          Aktuelles Jahr
 * @param selectedMonth        Selektierter Monat (1-12)
 * @param entlastungGenehmigt  Boolean ob EB genehmigt
 */
export function calculateEntlastungBudget(
  pflegegrad: number,
  initialBudget: number | null | undefined,
  consumedEntYear: number,
  currentYear: number,
  selectedMonth: number,
  entlastungGenehmigt: boolean | null | undefined,
): { yearlyTotal: number; available: number; expiringCarryOver: number } {
  if (!entlastungGenehmigt || pflegegrad < 1) {
    return { yearlyTotal: 0, available: 0, expiringCarryOver: 0 };
  }

  const carryOver = initialBudget ?? 0;
  const remainingMonths = 12 - (selectedMonth - 1); // Monate inkl. dem gewählten
  const regularBudget = remainingMonths * EB_MONATSBETRAG;

  // Ab Juli: effectiveInitial = min(Vorjahresrest, tatsächlich_verbrauchter_Entlastung)
  let effectiveInitial: number;
  if (selectedMonth >= 7) {
    effectiveInitial = Math.min(carryOver, consumedEntYear);
  } else {
    effectiveInitial = carryOver;
  }

  // Bereits genutzter Teil des Vorjahresrests (FIFO: erst Carryover, dann laufendes Jahr)
  const consumedFromCarryOver = Math.min(consumedEntYear, carryOver);
  const expiringCarryOver =
    selectedMonth < 7 ? Math.max(0, carryOver - consumedFromCarryOver) : 0;

  const yearlyTotal = effectiveInitial + regularBudget;
  const available = Math.max(0, yearlyTotal - consumedEntYear);

  return { yearlyTotal, available, expiringCarryOver };
}

// ─── Kombi-Budget-Berechnung ─────────────────────────────────

export function calculateKombiBudget(
  pflegegrad: number,
  kombileistungGenehmigt: boolean | null | undefined,
  careLevels: CareLevel[],
  consumedKombiMonth: number,
): { monthlyMax: number; available: number } {
  if (!kombileistungGenehmigt || pflegegrad < 2) {
    return { monthlyMax: 0, available: 0 };
  }

  const careLevel = careLevels.find((cl) => cl.pflegegrad === pflegegrad);
  const monthlyMax = careLevel?.kombi_max_40_prozent_monat ?? 0;
  const available = Math.max(0, monthlyMax - consumedKombiMonth);

  return { monthlyMax, available };
}

// ─── VP-Budget-Berechnung ────────────────────────────────────

export function calculateVPBudget(
  pflegegrad: number,
  verhinderungspflegeGenehmigt: boolean | null | undefined,
  consumedVPYear: number,
): { yearlyTotal: number; remaining: number } {
  if (!verhinderungspflegeGenehmigt || pflegegrad < 2) {
    return { yearlyTotal: 0, remaining: 0 };
  }

  const yearlyTotal = VP_JAHRESBUDGET;
  const remaining = Math.max(0, yearlyTotal - consumedVPYear);

  return { yearlyTotal, remaining };
}

// ─── Tarif-Berechnung ────────────────────────────────────────

export function calculateTransactionAmount(
  hours: number,
  visits: number,
  serviceType: ServiceType,
  tariffs: Tariff[],
): { hourlyRate: number; travelFlatTotal: number; totalAmount: number } {
  const lookupType = serviceType === 'PRIVAT' ? 'ENTLASTUNG' : serviceType;
  const tariff = tariffs.find((t) => t.service_type === lookupType && t.active);

  if (!tariff) {
    return { hourlyRate: 0, travelFlatTotal: 0, totalAmount: 0 };
  }

  const hourlyRate = tariff.hourly_rate;
  const travelFlatTotal = visits * tariff.travel_flat_per_visit;
  const totalAmount = hours * hourlyRate + travelFlatTotal;

  return { hourlyRate, travelFlatTotal, totalAmount };
}

// ─── Budget-Zuordnungsalgorithmus (Kern) ─────────────────────

type KundeForBudget = {
  pflegegrad: number | null;
  entlastung_genehmigt?: boolean | null;
  verhinderungspflege_genehmigt?: boolean | null;
  pflegesachleistung_genehmigt?: boolean | null; // = kombileistung
  initial_budget_entlastung?: number | null;
  budget_prioritaet?: string[] | null;
};

type TransactionWithSuggestion = BudgetTransaction & {
  suggestedType: ServiceType;
  splitAllocations?: SplitAllocation[];
};

export function assignTransactionTypes(
  transactions: BudgetTransaction[],
  kunde: KundeForBudget,
  availability: BudgetAvailability,
  tariffs: Tariff[],
): TransactionWithSuggestion[] {
  const pflegegrad = kunde.pflegegrad ?? 0;

  // PG 0: alles privat
  if (pflegegrad === 0) {
    return transactions.map((tx) => ({ ...tx, suggestedType: 'PRIVAT' as ServiceType }));
  }

  // Verfügbare Töpfe
  let remainingKombi = availability.kombiAvailable;
  let remainingExpiringEntl = availability.expiringCarryOver;
  let remainingVP = availability.vpRemainingYear;
  let remainingEntlastung = Math.max(
    0,
    availability.entlastungAvailable - availability.expiringCarryOver,
  );

  // Sortiert nach Datum
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.service_date).getTime() - new Date(b.service_date).getTime(),
  );

  return sorted.map((tx) => {
    // Manuell zugewiesene + bereits abgerechnete Transaktionen beibehalten
    if (tx.allocation_type === 'MANUAL' && tx.billed) {
      return { ...tx, suggestedType: tx.service_type };
    }

    const { totalAmount } = calculateTransactionAmount(tx.hours, tx.visits, 'ENTLASTUNG', tariffs);

    // Budget-Töpfe in Prioritätsreihenfolge durchlaufen und ggf. splitten
    type Pool = { type: ServiceType; remaining: () => number; consume: (amt: number) => void; calcAmount?: number };
    const vpCalc = calculateTransactionAmount(tx.hours, tx.visits, 'VERHINDERUNG', tariffs);

    const kombiPool: Pool = {
      type: 'KOMBI',
      remaining: () => remainingKombi,
      consume: (amt) => { remainingKombi -= amt; },
    };
    const vpPool: Pool | null = pflegegrad >= 2
      ? {
          type: 'VERHINDERUNG',
          remaining: () => remainingVP,
          consume: (amt) => { remainingVP -= amt; },
          calcAmount: vpCalc.totalAmount,
        }
      : null;

    // Kundenspezifische Priorisierung: 'pflegesachleistung' = KOMBI, 'verhinderungspflege' = VP
    const budgetPrio = kunde.budget_prioritaet;
    let configurablePools: Pool[];
    if (budgetPrio && budgetPrio.length > 0) {
      configurablePools = budgetPrio
        .map((key) => {
          if (key === 'pflegesachleistung') return kombiPool;
          if (key === 'verhinderungspflege') return vpPool;
          return null;
        })
        .filter((p): p is Pool => p !== null);
    } else {
      // Default-Reihenfolge: KOMBI → VP
      configurablePools = [kombiPool, ...(vpPool ? [vpPool] : [])];
    }

    const pools: Pool[] = [
      ...configurablePools,
      {
        type: 'ENTLASTUNG', // Expiring Vorjahresrest
        remaining: () => remainingExpiringEntl,
        consume: (amt) => { remainingExpiringEntl -= amt; },
      },
      {
        type: 'ENTLASTUNG', // Regulärer EB
        remaining: () => remainingEntlastung,
        consume: (amt) => { remainingEntlastung -= amt; },
      },
    ];

    let remaining = totalAmount;
    const allocations: SplitAllocation[] = [];

    for (const pool of pools) {
      if (remaining <= 0) break;
      const poolRemaining = pool.remaining();
      if (poolRemaining <= 0) continue;

      // VP hat eigenen Tarif — Anteil proportional umrechnen
      const effectiveAmount = pool.type === 'VERHINDERUNG'
        ? (pool.calcAmount ?? totalAmount) * (remaining / totalAmount)
        : remaining;
      const allocatable = Math.min(effectiveAmount, poolRemaining);

      if (allocatable > 0.01) { // Rundungsschwelle
        pool.consume(allocatable);
        // Für den Restbetrag-Tracker: bei VP zurückrechnen auf EB-Basis
        const deducted = pool.type === 'VERHINDERUNG' && totalAmount > 0
          ? remaining * (allocatable / effectiveAmount)
          : allocatable;
        allocations.push({ type: pool.type, amount: Math.round(allocatable * 100) / 100 });
        remaining = Math.round((remaining - deducted) * 100) / 100;
      }
    }

    // Rest auf Privat
    if (remaining > 0.01) {
      allocations.push({ type: 'PRIVAT', amount: Math.round(remaining * 100) / 100 });
    }

    // Primärer Typ = Topf mit dem höchsten Anteil
    const primaryType = allocations.length > 0
      ? allocations.reduce((a, b) => (b.amount > a.amount ? b : a)).type
      : 'PRIVAT' as ServiceType;

    // Nur splitAllocations setzen wenn tatsächlich ein Split vorliegt
    const isSplit = allocations.length > 1;

    return {
      ...tx,
      suggestedType: primaryType,
      ...(isSplit ? { splitAllocations: allocations } : {}),
    };
  });
}

// ─── Billing-Vorschlag berechnen ─────────────────────────────

export function buildBillingSuggestion(
  assignedTransactions: TransactionWithSuggestion[],
  tariffs: Tariff[],
): BillingSuggestion {
  let entlastung = 0;
  let kombi = 0;
  let verhinderung = 0;
  let privat = 0;

  for (const tx of assignedTransactions) {
    // Bei Split-Transaktionen die einzelnen Allokationen nutzen
    if (tx.splitAllocations && tx.splitAllocations.length > 0) {
      for (const alloc of tx.splitAllocations) {
        switch (alloc.type) {
          case 'ENTLASTUNG': entlastung += alloc.amount; break;
          case 'KOMBI': kombi += alloc.amount; break;
          case 'VERHINDERUNG': verhinderung += alloc.amount; break;
          case 'PRIVAT': privat += alloc.amount; break;
        }
      }
    } else {
      const { totalAmount } = calculateTransactionAmount(
        tx.hours,
        tx.visits,
        tx.suggestedType,
        tariffs,
      );

      switch (tx.suggestedType) {
        case 'ENTLASTUNG': entlastung += totalAmount; break;
        case 'KOMBI': kombi += totalAmount; break;
        case 'VERHINDERUNG': verhinderung += totalAmount; break;
        case 'PRIVAT': privat += totalAmount; break;
      }
    }
  }

  return {
    entlastung,
    kombi,
    verhinderung,
    privat,
    total: entlastung + kombi + verhinderung + privat,
    transactions: assignedTransactions,
  };
}

// ─── Status-Ermittlung ───────────────────────────────────────

export function getBillingStatus(
  pflegegrad: number,
  suggestion: BillingSuggestion,
  initialBudgetEntlastung: number | null | undefined,
  selectedMonth: number,
  consumedEntYear: number,
): AllocationStatus {
  // PG 0: kein Budget = immer OK
  if (pflegegrad === 0) return 'OK';

  // Privatanteil vorhanden = Budget überschritten
  if (suggestion.privat > 0) return 'BUDGET_EXCEEDED';

  // Optimierungswarnung: Vorjahresrest vorhanden, der vor Juli aufgebraucht werden sollte
  const carryOver = initialBudgetEntlastung ?? 0;
  if (carryOver > 0 && selectedMonth < 7) {
    const unconsumedCarryOver = Math.max(0, carryOver - consumedEntYear);
    if (unconsumedCarryOver > 0) return 'OPTIMIZE';
  }

  return 'OK';
}

// ─── Manuelle Guthaben ───────────────────────────────────────

/**
 * Summiert alle noch nicht abgelaufenen manuellen Guthaben-Einträge.
 * Abgelaufen = verfaellt_am liegt vor heute (UTC).
 */
export function getTotalManuelleGuthaben(
  eintraege: { betrag: number; verfaellt_am: string }[],
): { total: number; aktiv: number } {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let total = 0;
  let aktiv = 0;

  for (const e of eintraege) {
    total += e.betrag;
    if (e.verfaellt_am >= today) {
      aktiv += e.betrag;
    }
  }

  return { total, aktiv };
}

// ─── Verfallswarnung ─────────────────────────────────────────

export function hasExpiryWarning(
  initialBudgetEntlastung: number | null | undefined,
  consumedEntYear: number,
  currentMonth: number,
): boolean {
  const carryOver = initialBudgetEntlastung ?? 0;
  if (carryOver <= 0 || currentMonth >= 7) return false;

  // Warnung wenn Vorjahresrest noch vorhanden und weniger als 60 Tage bis 01.07.
  const unconsumed = Math.max(0, carryOver - consumedEntYear);
  if (unconsumed <= 0) return false;

  const now = new Date();
  const july1 = new Date(now.getFullYear(), 6, 1); // 01. Juli
  const daysUntilJuly1 = Math.floor((july1.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return daysUntilJuly1 >= 0 && daysUntilJuly1 <= 60;
}

// ─── Consumed-Beträge aus Transaktionen aggregieren ──────────

export type ConsumedByType = {
  ENTLASTUNG: number;
  KOMBI: number;
  VERHINDERUNG: number;
};

export function aggregateConsumed(
  transactions: BudgetTransaction[],
  tariffs: Tariff[],
  billedOnly = true,
): ConsumedByType {
  const result: ConsumedByType = { ENTLASTUNG: 0, KOMBI: 0, VERHINDERUNG: 0 };

  for (const tx of transactions) {
    if (billedOnly && !tx.billed) continue;
    if (tx.service_type === 'PRIVAT' || tx.service_type === ('PRIVAT' as ServiceType)) continue;

    const type = tx.service_type as keyof ConsumedByType;
    if (type in result) {
      // Use stored total_amount if available (post-billing), otherwise calculate
      const amount =
        tx.total_amount > 0
          ? tx.total_amount
          : calculateTransactionAmount(tx.hours, tx.visits, tx.service_type, tariffs).totalAmount;
      result[type] += amount;
    }
  }

  return result;
}

// ─── Vollständige Availability-Berechnung ───────────────────

export function buildAvailability(
  kunde: KundeForBudget & {
    initial_budget_entlastung?: number | null;
    entlastung_genehmigt?: boolean | null;
    verhinderungspflege_genehmigt?: boolean | null;
    pflegesachleistung_genehmigt?: boolean | null;
  },
  consumed: ConsumedByType,
  consumedKombiThisMonth: number,
  careLevels: CareLevel[],
  selectedMonth: number,
  selectedYear: number,
): BudgetAvailability {
  const pflegegrad = kunde.pflegegrad ?? 0;

  const entl = calculateEntlastungBudget(
    pflegegrad,
    kunde.initial_budget_entlastung,
    consumed.ENTLASTUNG,
    selectedYear,
    selectedMonth,
    kunde.entlastung_genehmigt,
  );

  const kombi = calculateKombiBudget(
    pflegegrad,
    kunde.pflegesachleistung_genehmigt,
    careLevels,
    consumedKombiThisMonth,
  );

  const vp = calculateVPBudget(
    pflegegrad,
    kunde.verhinderungspflege_genehmigt,
    consumed.VERHINDERUNG,
  );

  return {
    entlastungYearlyTotal: entl.yearlyTotal,
    entlastungConsumed: consumed.ENTLASTUNG,
    entlastungAvailable: entl.available,
    kombiMonthlyMax: kombi.monthlyMax,
    kombiConsumed: consumedKombiThisMonth,
    kombiAvailable: kombi.available,
    vpYearlyTotal: vp.yearlyTotal,
    vpConsumed: consumed.VERHINDERUNG,
    vpRemainingYear: vp.remaining,
    expiringCarryOver: entl.expiringCarryOver,
  };
}
