/**
 * Kanonische Budget-Allokationslogik für Alltagshilfe Fischer.
 * Verwendet von: batch-billing Edge Function
 * Muss synchron bleiben mit: src/lib/pflegebudget/budgetCalculations.ts
 *
 * Algorithmus: FIFO-Zuweisung nach Prioritätsreihenfolge
 *   0. Haushaltshilfe §38 (aktive Verordnung → alle Termine darüber, kein Pool-Verbrauch)
 *   1. Vorjahresrest Entlastung (FIFO, verfällt 01.07.)
 *   2. VERHINDERUNG (§39, jährlich, eigener Tarif)
 *   3. Reguläre Entlastung (§45b, 131€/Monat)
 *   4. KOMBI (§45a, monatlich, verfällt)
 *   5. PRIVAT (Fallback, unbegrenzt)
 */

// ─── Types ──────────────────────────────────────────────────

export type ServiceType = "ENTLASTUNG" | "KOMBI" | "VERHINDERUNG" | "PRIVAT" | "HAUSHALTSHILFE";

export interface HaushaltshilfeVerordnung {
  gueltig_von: string;    // YYYY-MM-DD
  gueltig_bis: string;    // YYYY-MM-DD
  max_dauer_stunden: number;
}

export interface Tariff {
  service_type: "ENTLASTUNG" | "KOMBI" | "VERHINDERUNG";
  hourly_rate: number;
  travel_flat_per_visit: number;
  active: boolean;
}

export interface CareLevel {
  pflegegrad: number;
  kombi_max_40_prozent_monat: number;
}

export interface KundeForAllocation {
  pflegegrad: number | null;
  entlastung_genehmigt: boolean | null;
  verhinderungspflege_genehmigt: boolean | null;
  pflegesachleistung_genehmigt: boolean | null;
  pflegesachleistung_budget: number | null; // Kunden-Override für Kombi-Monatsbetrag
  initial_budget_entlastung: number | null;
  budget_prioritaet: string[] | null;
  haushaltshilfe_verordnungen?: HaushaltshilfeVerordnung[] | null;
}

export interface TerminInput {
  id: string;
  serviceDate: string; // YYYY-MM-DD
  hours: number;
  visits: number;
}

export interface BillingPosition {
  serviceType: ServiceType;
  amount: number; // Nettobetrag
  hourlyRate: number;
  travelFlat: number;
  stunden: number;
  mwstSatz: number;
  mwstBetrag: number;
  bruttoBetrag: number;
}

export interface TerminAllocationResult {
  terminId: string;
  serviceDate: string;
  hours: number;
  visits: number;
  positions: BillingPosition[];
  totalNet: number;
  totalMwst: number;
  totalBrutto: number;
}

// ─── Konstanten (identisch zu budgetCalculations.ts) ─────────

const VP_JAHRESBUDGET = 3_539;
const EB_MONATSBETRAG = 131;

// ─── Hilfsfunktionen ─────────────────────────────────────────

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getActiveTariff(type: ServiceType, tariffs: Tariff[]): Tariff | undefined {
  // HAUSHALTSHILFE und PRIVAT verwenden ENTLASTUNG-Tarif (kein eigener Tarif-Eintrag)
  const lookup = (type === "PRIVAT" || type === "HAUSHALTSHILFE") ? "ENTLASTUNG" : type;
  return tariffs.find((t) => t.service_type === lookup && t.active);
}

/**
 * Gibt die erste aktive Verordnung zurück, die das serviceDate abdeckt.
 */
function findActiveVerordnung(
  serviceDate: string,
  verordnungen: HaushaltshilfeVerordnung[],
): HaushaltshilfeVerordnung | null {
  return verordnungen.find(
    (v) => v.gueltig_von <= serviceDate && v.gueltig_bis >= serviceDate,
  ) ?? null;
}

// ─── Betragsberechnung ────────────────────────────────────────

export function calculateAmount(
  hours: number,
  visits: number,
  type: ServiceType,
  tariffs: Tariff[],
): { hourlyRate: number; travelFlat: number; total: number } {
  const t = getActiveTariff(type, tariffs);
  if (!t) return { hourlyRate: 0, travelFlat: 0, total: 0 };
  if (hours <= 0) return { hourlyRate: t.hourly_rate, travelFlat: 0, total: 0 };
  const travelFlat = r2(visits * t.travel_flat_per_visit);
  return { hourlyRate: t.hourly_rate, travelFlat, total: r2(hours * t.hourly_rate + travelFlat) };
}

// ─── MwSt-Berechnung ─────────────────────────────────────────

/**
 * §4 Nr. 16 UStG: 0% für Pflegeleistungen (pflegegrad > 0).
 * 19% nur für Privatkunden ohne Pflegegrad.
 */
export function calculateMwst(
  netto: number,
  pflegegrad: number | null,
): { mwstSatz: number; mwstBetrag: number; bruttoBetrag: number } {
  const satz = (pflegegrad ?? 0) > 0 ? 0 : 0.19;
  const betrag = r2(netto * satz);
  return { mwstSatz: satz, mwstBetrag: betrag, bruttoBetrag: r2(netto + betrag) };
}

// ─── Budget-Verfügbarkeit (pro Monat) ────────────────────────

function entlAvailable(
  pg: number,
  carryOver: number,
  consumedYear: number,
  month: number,
  genehmigt: boolean,
): { available: number; expiringCarryOver: number } {
  if (!genehmigt || pg < 1) return { available: 0, expiringCarryOver: 0 };
  const remainMonths = 12 - (month - 1);
  const effectiveInitial = month >= 7 ? Math.min(carryOver, consumedYear) : carryOver;
  const consumedFromCarry = Math.min(consumedYear, carryOver);
  const expiring = month < 7 ? Math.max(0, carryOver - consumedFromCarry) : 0;
  const total = effectiveInitial + remainMonths * EB_MONATSBETRAG;
  return { available: Math.max(0, total - consumedYear), expiringCarryOver: expiring };
}

function kombiMonthlyMax(pg: number, genehmigt: boolean, careLevels: CareLevel[], customBudget?: number | null): number {
  if (!genehmigt || pg < 2) return 0;
  return customBudget ?? careLevels.find((cl) => cl.pflegegrad === pg)?.kombi_max_40_prozent_monat ?? 0;
}

function vpRemainingYear(pg: number, genehmigt: boolean, consumedYear: number): number {
  if (!genehmigt || pg < 2) return 0;
  return Math.max(0, VP_JAHRESBUDGET - consumedYear);
}

// ─── FIFO Pool-Objekt ─────────────────────────────────────────

interface Pool {
  type: ServiceType;
  remaining: number;
  isVP: boolean; // VP hat eigenen Tarif → proportionale Umrechnung
}

// ─── Pool-Zuweisung (einzelner Termin) ───────────────────────

function fifoAssign(
  baseAmt: number,
  vpAmt: number,
  pools: Pool[],
): Array<{ type: ServiceType; amount: number }> {
  const allocs: Array<{ type: ServiceType; amount: number }> = [];
  let remaining = baseAmt;

  for (const pool of pools) {
    if (remaining <= 0.01) break;
    if (pool.remaining <= 0.01) continue;

    // VP hat höheren Stundensatz → Anteil proportional umrechnen
    const effectiveAmt = pool.isVP && baseAmt > 0
      ? vpAmt * (remaining / baseAmt)
      : remaining;
    const allocatable = Math.min(effectiveAmt, pool.remaining);

    if (allocatable > 0.01) {
      // Bei VP: Rückrechnung auf Entlastungs-Basis für remaining-Tracking
      const deducted = pool.isVP && baseAmt > 0
        ? remaining * (allocatable / effectiveAmt)
        : allocatable;
      pool.remaining -= allocatable;
      allocs.push({ type: pool.type, amount: r2(allocatable) });
      remaining = r2(remaining - deducted);
    }
  }

  if (remaining > 0.01) {
    allocs.push({ type: "PRIVAT", amount: r2(remaining) });
  }
  return allocs;
}

// ─── Pool-Liste aufbauen ──────────────────────────────────────

function buildPools(
  budgetPrio: string[] | null,
  kombiAmt: number,
  vpBudget: number,
  expiringEnt: number,
  regularEnt: number,
  pg: number,
): Pool[] {
  const kombiPool: Pool = { type: "KOMBI", remaining: kombiAmt, isVP: false };
  const expiringEntlPool: Pool = { type: "ENTLASTUNG", remaining: expiringEnt, isVP: false };
  const regularEntPool: Pool = { type: "ENTLASTUNG", remaining: regularEnt, isVP: false };
  const vpPool: Pool | null = pg >= 2
    ? { type: "VERHINDERUNG", remaining: vpBudget, isVP: true }
    : null;

  if (budgetPrio && budgetPrio.length > 0) {
    const pools: Pool[] = budgetPrio
      .flatMap((k) => {
        if (k === "vorjahresrest_entlastung") return [expiringEntlPool];
        if (k === "verhinderungspflege") return vpPool ? [vpPool] : [];
        if (k === "entlastungsbetrag") return [regularEntPool];
        if (k === "kombileistung" || k === "pflegesachleistung") return [kombiPool];
        if (k === "privat") return []; // PRIVAT ist immer Fallback
        return [];
      });

    // Fehlende Pools in korrekter Default-Reihenfolge als Fallback anhängen
    const hasExpiring = budgetPrio.includes("vorjahresrest_entlastung");
    const hasVP = budgetPrio.includes("verhinderungspflege");
    const hasEntl = budgetPrio.includes("entlastungsbetrag");
    const hasKombi = budgetPrio.some((k) => k === "kombileistung" || k === "pflegesachleistung");
    if (!hasExpiring) pools.push(expiringEntlPool);
    if (!hasVP && vpPool) pools.push(vpPool);
    if (!hasEntl) pools.push(regularEntPool);
    if (!hasKombi) pools.push(kombiPool);

    return pools;
  }

  // Default-Reihenfolge: Vorjahresrest → VP → EB → Kombi
  return [
    expiringEntlPool,                      // Vorjahresrest zuerst (FIFO, verfällt 01.07.)
    ...(vpPool ? [vpPool] : []),           // Verhinderungspflege (nur PG >= 2)
    regularEntPool,                         // Regulärer Entlastungsbetrag
    kombiPool,                              // Kombileistung (letzter Kassentopf)
  ];
}

// ─── Rechnungspositionen aufbauen ─────────────────────────────

function toBillingPositions(
  rawAllocs: Array<{ type: ServiceType; amount: number }>,
  termin: TerminInput,
  baseAmt: number,
  tariffs: Tariff[],
  pg: number,
): BillingPosition[] {
  let remainingHours = termin.hours;

  return rawAllocs.map((alloc, i) => {
    const isLast = i === rawAllocs.length - 1;
    // Proportionale Stunden; letzter Anteil erhält den Rest (Rundungskorrektur)
    const stunden = isLast
      ? r2(remainingHours)
      : r2(baseAmt > 0 ? termin.hours * (alloc.amount / baseAmt) : 0);
    remainingHours = r2(remainingHours - stunden);

    // Fahrtpauschale nur auf der ersten Position
    const visits = i === 0 ? termin.visits : 0;
    const t = getActiveTariff(alloc.type, tariffs);
    const travelFlat = r2(visits * (t?.travel_flat_per_visit ?? 0));
    const mwst = calculateMwst(alloc.amount, pg);

    return {
      serviceType: alloc.type,
      amount: alloc.amount,
      hourlyRate: t?.hourly_rate ?? 0,
      travelFlat,
      stunden,
      ...mwst,
    };
  });
}

// ─── Hauptexport ──────────────────────────────────────────────

/**
 * FIFO-Budgetzuweisung für eine Menge von Terminen.
 * Portiert von computeYearBudgetAllocations in budgetCalculations.ts.
 *
 * Priorität 0: §38 Haushaltshilfe (aktive Verordnung) — bypasses alle regulären Pools.
 * Stunden werden auf max_dauer_stunden der Verordnung gekappt.
 * HH-Termine erzeugen keine budget_transactions (separate Abrechnung zur Krankenkasse).
 *
 * @param preConsumedEnt  Bereits abgerechnete ENTLASTUNG-€ im laufenden Jahr (vor Abrechnungszeitraum)
 * @param preConsumedVP   Bereits abgerechnete VERHINDERUNG-€ im laufenden Jahr (vor Abrechnungszeitraum)
 */
export function allocateTermine(
  termine: TerminInput[],
  kunde: KundeForAllocation,
  tariffs: Tariff[],
  careLevels: CareLevel[],
  year: number,
  preConsumedEnt: number,
  preConsumedVP: number,
): TerminAllocationResult[] {
  const pg = kunde.pflegegrad ?? 0;
  const verordnungen = kunde.haushaltshilfe_verordnungen ?? [];

  // PG 0 oder fehlende Stammdaten → alles Privat (HH §38 setzt PG voraus)
  if (pg === 0 || !tariffs.length || !careLevels.length) {
    return termine.map((t) => {
      const base = calculateAmount(t.hours, t.visits, "ENTLASTUNG", tariffs);
      const mwst = calculateMwst(base.total, pg);
      return {
        terminId: t.id,
        serviceDate: t.serviceDate,
        hours: t.hours,
        visits: t.visits,
        positions: [{
          serviceType: "PRIVAT",
          amount: base.total,
          hourlyRate: base.hourlyRate,
          travelFlat: base.travelFlat,
          stunden: t.hours,
          ...mwst,
        }],
        totalNet: base.total,
        totalMwst: mwst.mwstBetrag,
        totalBrutto: mwst.bruttoBetrag,
      };
    });
  }

  const sorted = [...termine].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));

  // Termine nach Monat gruppieren
  const byMonth = new Map<number, TerminInput[]>();
  for (const t of sorted) {
    const m = parseInt(t.serviceDate.slice(5, 7), 10);
    byMonth.set(m, [...(byMonth.get(m) ?? []), t]);
  }

  const results: TerminAllocationResult[] = [];
  let consumedEnt = preConsumedEnt;
  let consumedVP = preConsumedVP;

  // Monate in aufsteigender Reihenfolge verarbeiten
  for (const [month, monthTermine] of [...byMonth.entries()].sort(([a], [b]) => a - b)) {
    const carryOver = kunde.initial_budget_entlastung ?? 0;
    const entl = entlAvailable(
      pg, carryOver, consumedEnt, month, kunde.entlastung_genehmigt ?? false,
    );
    const km = kombiMonthlyMax(pg, kunde.pflegesachleistung_genehmigt ?? false, careLevels, kunde.pflegesachleistung_budget);
    const vp = vpRemainingYear(pg, kunde.verhinderungspflege_genehmigt ?? false, consumedVP);

    // Pools nur für reguläre Termine (HH-Termine bypasssen alle Pools)
    const pools = buildPools(
      kunde.budget_prioritaet,
      km,
      vp,
      entl.expiringCarryOver,
      Math.max(0, entl.available - entl.expiringCarryOver),
      pg,
    );

    for (const termin of monthTermine) {
      // ── Priorität 0: §38 Haushaltshilfe ────────────────────────────────
      const activeVerordnung = findActiveVerordnung(termin.serviceDate, verordnungen);
      if (activeVerordnung) {
        // Stunden auf max_dauer_stunden kappen (Abrechnung nach Verordnung)
        const hhHours = r2(Math.min(termin.hours, activeVerordnung.max_dauer_stunden));
        const amt = calculateAmount(hhHours, termin.visits, "HAUSHALTSHILFE", tariffs);
        const mwst = calculateMwst(amt.total, pg);
        results.push({
          terminId: termin.id,
          serviceDate: termin.serviceDate,
          hours: hhHours,
          visits: termin.visits,
          positions: [{
            serviceType: "HAUSHALTSHILFE",
            amount: amt.total,
            hourlyRate: amt.hourlyRate,
            travelFlat: amt.travelFlat,
            stunden: hhHours,
            ...mwst,
          }],
          totalNet: amt.total,
          totalMwst: mwst.mwstBetrag,
          totalBrutto: mwst.bruttoBetrag,
        });
        continue; // Reguläre Pools werden nicht belastet
      }

      // ── Reguläre FIFO-Zuweisung ─────────────────────────────────────────
      const baseAmt = calculateAmount(termin.hours, termin.visits, "ENTLASTUNG", tariffs).total;
      const vpAmt = calculateAmount(termin.hours, termin.visits, "VERHINDERUNG", tariffs).total;
      const rawAllocs = fifoAssign(baseAmt, vpAmt, pools);

      // Verbrauch für nächste Monate akkumulieren
      for (const alloc of rawAllocs) {
        if (alloc.type === "ENTLASTUNG") consumedEnt += alloc.amount;
        else if (alloc.type === "VERHINDERUNG") consumedVP += alloc.amount;
      }

      const positions = toBillingPositions(rawAllocs, termin, baseAmt, tariffs, pg);
      const totalNet = r2(positions.reduce((s, p) => s + p.amount, 0));
      const totalMwst = r2(positions.reduce((s, p) => s + p.mwstBetrag, 0));

      results.push({
        terminId: termin.id,
        serviceDate: termin.serviceDate,
        hours: termin.hours,
        visits: termin.visits,
        positions,
        totalNet,
        totalMwst,
        totalBrutto: r2(totalNet + totalMwst),
      });
    }
  }

  return results;
}
