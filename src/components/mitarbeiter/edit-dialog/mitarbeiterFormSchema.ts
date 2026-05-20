import { z } from 'zod';

// Leere Strings und undefined/null werden für Zahlenfelder zu null konvertiert,
// damit optionale Inputs nicht die Zod-Validierung (.positive) fehlschlagen lassen.
function toNullableNum(val: unknown) {
  if (val === '' || val == null) return null;
  return val;
}

// ─── Reiter 1: Persoenliche Daten & Vertrag ─────────────────
const personalDataSchema = z.object({
  vorname: z.string().min(1, 'Vorname ist erforderlich').trim(),
  nachname: z.string().min(1, 'Nachname ist erforderlich').trim(),
  strasse: z.string().trim().optional().or(z.literal('')),
  plz: z.string().regex(/^\d{5}$/, 'PLZ muss 5 Ziffern haben').optional().or(z.literal('')),
  stadt: z.string().trim().optional().or(z.literal('')),
  telefon: z.string().trim().optional().or(z.literal('')),
  email: z.string().email('Ungültige E-Mail-Adresse').optional().or(z.literal('')),
  geburtsdatum: z.string().optional().or(z.literal('')),
  geburtsname: z.string().trim().optional().or(z.literal('')),
  geburtsort: z.string().trim().optional().or(z.literal('')),
  geburtsland: z.string().trim().optional().or(z.literal('')),
  geschlecht: z.enum(['m', 'w', 'd', '']).optional(),
  konfession: z.string().trim().optional().or(z.literal('')),
  bank_institut: z.string().trim().optional().or(z.literal('')),
  iban: z.string()
    .regex(/^([A-Z]{2}\d{2}[A-Z0-9]{4,30})?$/, 'Ungültiges IBAN-Format')
    .optional()
    .or(z.literal('')),
  // Vertragsdaten — preprocess verhindert Fehler bei leerem Input
  gehalt_pro_monat: z.preprocess(toNullableNum, z.number().positive('Gehalt muss positiv sein').nullable().optional()),
  hourly_rate: z.preprocess(toNullableNum, z.number().positive('Stundenlohn muss positiv sein').nullable().optional()),
  vertragsstunden_pro_monat: z.preprocess(toNullableNum, z.number().positive('Stunden müssen positiv sein').nullable().optional()),
  employment_type: z.string().optional().or(z.literal('')),
  soll_wochenstunden: z.preprocess(toNullableNum, z.number().min(0).nullable().optional()),
  max_termine_pro_tag: z.preprocess(toNullableNum, z.number().int().min(0).nullable().optional()),
  // Kalender / Standort
  farbe_kalender: z.string().default('#3B82F6'),
  standort: z.string().default('Hannover'),
  zustaendigkeitsbereich: z.string().trim().optional().or(z.literal('')),
});

// ─── Reiter 2: Steuer & Sozialversicherung ──────────────────
const taxSocialSchema = z.object({
  steuer_id: z.string()
    .regex(/^(\d{11})?$/, 'Steuer-ID muss 11 Ziffern haben')
    .optional()
    .or(z.literal('')),
  steuerklasse: z.preprocess(toNullableNum, z.number().int().min(1).max(6).nullable().optional()),
  kinderfreibetrag: z.preprocess(toNullableNum, z.number().min(0).nullable().optional()),
  sv_rv_nummer: z.string().trim().optional().or(z.literal('')),
  krankenkasse: z.string().trim().optional().or(z.literal('')),
  rv_befreiung: z.boolean().default(false),
});

// ─── Reiter 3: Weitere Beschaeftigungsverhaeltnisse ─────────
const sideEmploymentSchema = z.object({
  weitere_beschaeftigung: z.boolean().default(false),
});

// ─── Kombiniertes Schema ────────────────────────────────────
export const mitarbeiterFormSchema = personalDataSchema
  .merge(taxSocialSchema)
  .merge(sideEmploymentSchema);

export type MitarbeiterFormValues = z.infer<typeof mitarbeiterFormSchema>;

// ─── Nebenbeschaeftigung-Eintrag ────────────────────────────
export const nebenbeschaeftigungSchema = z.object({
  arbeitgeber: z.string().min(1, 'Arbeitgeber ist erforderlich').trim(),
  art_beschaeftigung: z.enum(['minijob', 'sv_pflichtig', 'kurzfristig', 'ehrenamt', '']).optional(),
  arbeitszeit_stunden_woche: z.coerce.number().min(0).nullable().optional(),
  gehalt_monatlich: z.coerce.number().min(0).nullable().optional(),
  sv_pflicht: z.boolean().default(false),
});

export type NebenbeschaeftigungFormValues = z.infer<typeof nebenbeschaeftigungSchema>;

// ─── Pflichtfeld-Pruefung fuer Einsatzplanung ───────────────
export function checkStammdatenVollstaendig(data: Partial<MitarbeiterFormValues>): boolean {
  const isMinijob = data.employment_type === 'Minijob';
  const hasGehalt = isMinijob ? !!data.hourly_rate : !!data.gehalt_pro_monat;
  return !!(
    data.vorname &&
    data.nachname &&
    data.strasse &&
    data.plz &&
    data.stadt &&
    hasGehalt &&
    data.vertragsstunden_pro_monat
  );
}
