import { z } from 'zod';

function toNullableNum(val: unknown) {
  if (val === '' || val == null) return null;
  return val;
}

// WICHTIG: \b (Word-Boundary) funktioniert nicht zuverlässig nach optionalen Sonderzeichen
// wie dem Punkt (z.B. \bDr\.?\b matcht "Dr." NICHT). Deshalb: Lookahead auf Leerzeichen.
const VERBOTENE_TITEL = /(?:^|\s)(?:Dr|Prof|Herr|Frau|Dipl|Mag|Ing)\.?\s/i;
const BINDESTRICH_MIT_LEERZEICHEN = /\s-|-\s/;

function nameRules(fieldLabel: string) {
  return z.string()
    .min(1, `${fieldLabel} ist erforderlich`)
    .trim()
    .refine(v => !VERBOTENE_TITEL.test(v), {
      message: `Kein Titel im ${fieldLabel} (Dr., Prof., Herr, Frau) — nur den Namen eingeben`,
    })
    .refine(v => !BINDESTRICH_MIT_LEERZEICHEN.test(v), {
      message: 'Bindestrich ohne Leerzeichen schreiben (z.B. Müller-Schmidt)',
    });
}

const personalDataSchema = z.object({
  vorname: nameRules('Vorname'),
  nachname: nameRules('Nachname'),
  strasse: z.string().trim().optional().or(z.literal('')),
  plz: z.string().regex(/^\d{5}$/, 'PLZ muss 5 Ziffern haben').optional().or(z.literal('')),
  stadt: z.string().trim().optional().or(z.literal('')),
  telefon: z.string().trim().optional().or(z.literal('')),
  email: z.string().email('Ungültige E-Mail-Adresse').optional().or(z.literal('')),
  geburtsdatum: z.string().optional().or(z.literal('')),
  geburtsname: z.string().trim().optional().or(z.literal('')),
  geburtsort: z.string().trim().optional().or(z.literal('')),
  geburtsland: z.string().trim().optional().or(z.literal('')),
  staatsangehoerigkeit: z.string().trim().optional().or(z.literal('')),
  geschlecht: z.enum(['m', 'w', 'd', '']).optional(),
  konfession: z.string().trim().optional().or(z.literal('')),
  bank_institut: z.string().trim().optional().or(z.literal('')),
  iban: z.string()
    .regex(/^([A-Z]{2}\d{2}[A-Z0-9]{4,30})?$/, 'Ungültiges IBAN-Format')
    .optional()
    .or(z.literal('')),
  lohnart: z.enum(['stundenlohn', 'festgehalt']).default('stundenlohn'),
  gehalt_pro_monat: z.preprocess(toNullableNum, z.number().positive('Gehalt muss positiv sein').nullable().optional()),
  hourly_rate: z.preprocess(toNullableNum, z.number().positive('Stundenlohn muss positiv sein').nullable().optional()),
  vertragsstunden_pro_monat: z.preprocess(toNullableNum, z.number().positive('Stunden müssen positiv sein').nullable().optional()),
  employment_type: z.string().optional().or(z.literal('')),
  soll_wochenstunden: z.preprocess(toNullableNum, z.number().min(0).nullable().optional()),
  max_termine_pro_tag: z.preprocess(toNullableNum, z.number().int().min(0).nullable().optional()),
  farbe_kalender: z.string().default('#3B82F6'),
  standort: z.string().default('Hannover'),
  zustaendigkeitsbereich: z.string().trim().optional().or(z.literal('')),
});

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

export const mitarbeiterFormSchema = personalDataSchema.merge(taxSocialSchema);

export type MitarbeiterFormValues = z.infer<typeof mitarbeiterFormSchema>;

export const nebenbeschaeftigungSchema = z.object({
  arbeitgeber: z.string().min(1, 'Arbeitgeber ist erforderlich').trim(),
  art_beschaeftigung: z.enum(['minijob', 'sv_pflichtig', 'kurzfristig', 'ehrenamt', '']).optional(),
  arbeitszeit_stunden_woche: z.coerce.number().min(0).nullable().optional(),
  gehalt_monatlich: z.coerce.number().min(0).nullable().optional(),
  sv_pflicht: z.boolean().default(false),
});

export type NebenbeschaeftigungFormValues = z.infer<typeof nebenbeschaeftigungSchema>;

export function checkStammdatenVollstaendig(data: Partial<MitarbeiterFormValues>): boolean {
  return !!(
    data.vorname &&
    data.nachname &&
    data.strasse &&
    data.plz &&
    data.stadt &&
    (data.hourly_rate || data.gehalt_pro_monat) &&
    data.vertragsstunden_pro_monat
  );
}
