// ─── Budget-Priorisierung: Konstanten & Hilfsfunktionen ─────────────────────
// Separate Datei, damit der React Fast Refresh funktioniert.

export type BudgetBucketKey =
  | 'kombileistung'
  | 'vorjahresrest_entlastung'
  | 'verhinderungspflege'
  | 'entlastungsbetrag'
  | 'privat';

export interface BudgetBucketMeta {
  key: BudgetBucketKey;
  label: string;
  description: string;
  alwaysEnabled: boolean;
}

export const BUDGET_BUCKETS: BudgetBucketMeta[] = [
  {
    key: 'kombileistung',
    label: 'Kombileistung (§ 45a)',
    description: 'Umwandlung Pflegesachleistung, monatlich, verfällt',
    alwaysEnabled: false,
  },
  {
    key: 'vorjahresrest_entlastung',
    label: 'Vorjahresrest Entlastung',
    description: 'FIFO, verfällt am 01.07. des Folgejahres',
    alwaysEnabled: false,
  },
  {
    key: 'verhinderungspflege',
    label: 'Verhinderungspflege (§ 39)',
    description: 'Jährliches Budget, max. 3.539 €',
    alwaysEnabled: false,
  },
  {
    key: 'entlastungsbetrag',
    label: 'Entlastungsbetrag (§ 45b)',
    description: 'Monatlich 131 €, kumulierbar im Kalenderjahr',
    alwaysEnabled: false,
  },
  {
    key: 'privat',
    label: 'Privat',
    description: 'Fallback – unbegrenzt',
    alwaysEnabled: false,
  },
];

/** Standard-Reihenfolge gemäß Abrechnungsregeln */
export const DEFAULT_BUDGET_ORDER: BudgetBucketKey[] = [
  'vorjahresrest_entlastung',
  'verhinderungspflege',
  'entlastungsbetrag',
  'kombileistung',
  'privat',
];

/**
 * Normalisiert alte (2-Bucket) und neue (5-Bucket) budget_prioritaet auf
 * die vollständige 5-Einträge-Reihenfolge.
 * Migriert legacy keys: 'pflegesachleistung' → 'kombileistung'.
 */
export function normalizeBudgetOrder(raw: string[] | null | undefined): BudgetBucketKey[] {
  if (!raw || raw.length === 0) return [...DEFAULT_BUDGET_ORDER];

  // Legacy: 'pflegesachleistung' → 'kombileistung'
  const mapped = raw.map((k) =>
    k === 'pflegesachleistung' ? 'kombileistung' : k
  );

  // Nur gültige Keys behalten
  const valid = mapped.filter((k): k is BudgetBucketKey =>
    DEFAULT_BUDGET_ORDER.includes(k as BudgetBucketKey)
  );

  // Fehlende Keys am Ende ergänzen (in Default-Reihenfolge)
  const missing = DEFAULT_BUDGET_ORDER.filter((k) => !valid.includes(k));
  return [...valid, ...missing];
}
