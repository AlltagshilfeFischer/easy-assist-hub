import { z } from 'zod';

export const customerBaseSchema = z.object({
  kategorie: z.enum(['Interessent', 'Kunde']).default('Kunde'),
  vorname: z.string().min(1, 'Vorname ist erforderlich').trim(),
  nachname: z.string().min(1, 'Nachname ist erforderlich').trim(),
  strasse: z.string().min(1, 'Straße ist erforderlich').trim(),
  plz: z.string().regex(/^\d{5}$/, 'PLZ muss genau 5 Ziffern haben'),
  stadt: z.string().optional().or(z.literal('')),
  telefonnr: z
    .string()
    .min(1, 'Telefonnummer ist erforderlich')
    .trim()
    .regex(/^[+\d][\d\s\-\/()]{4,}$/, 'Ungültige Telefonnummer (nur Ziffern, +, -, / erlaubt)'),
  email: z.string().email('Ungültige E-Mail-Adresse').optional().or(z.literal('')),
  // Optionale Felder
  geburtsdatum: z.string().optional().or(z.literal('')),
  geschlecht: z.string().optional().or(z.literal('')),
  stadtteil: z.string().optional().or(z.literal('')),
  kontaktweg: z.string().optional().or(z.literal('')),
  pflegekasse: z.string().optional().or(z.literal('')),
  versichertennummer: z.string().optional().or(z.literal('')),
  pflegegrad: z.string().optional().or(z.literal('')),
  kasse_privat: z.string().optional().or(z.literal('')),
  verhinderungspflege_status: z.string().optional().or(z.literal('')),
  kopie_lw: z.string().optional().or(z.literal('')),
  terminfrequenz: z.string().optional().or(z.literal('')),
  termindauer_stunden: z.string().optional().default('1.5'),
  stunden_kontingent_monat: z.string().optional().or(z.literal('')),
  eintritt: z.string().optional().or(z.literal('')),
  austritt: z.string().optional().or(z.literal('')),
  startdatum: z.string().optional().or(z.literal('')),
  angehoerige_ansprechpartner: z.string().optional().or(z.literal('')),
  sonstiges: z.string().optional().or(z.literal('')),
  mitarbeiter: z.string().optional().or(z.literal('')),
  // Rechnungskopie
  rechnungskopie: z.array(z.string()).default([]),
  rechnungskopie_adresse_name: z.string().optional().or(z.literal('')),
  rechnungskopie_adresse_strasse: z.string().optional().or(z.literal('')),
  rechnungskopie_adresse_plz: z.string().optional().or(z.literal('')),
  rechnungskopie_adresse_stadt: z.string().optional().or(z.literal('')),
  // Abrechnung
  verhinderungspflege_aktiv: z.boolean().default(false),
  verhinderungspflege_beantragt: z.boolean().default(false),
  verhinderungspflege_genehmigt: z.boolean().default(false),
  verhinderungspflege_budget: z.string().default('3539'),
  pflegesachleistung_aktiv: z.boolean().default(false),
  pflegesachleistung_beantragt: z.boolean().default(false),
  pflegesachleistung_genehmigt: z.boolean().default(false),
  // Meta
  has_regular_appointments: z.boolean().default(false),
}).superRefine((data, ctx) => {
  // Ort ist Pflicht fuer Kunden, optional fuer Interessenten
  if (data.kategorie === 'Kunde' && (!data.stadt || !data.stadt.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Ort ist erforderlich',
      path: ['stadt'],
    });
  }
});

export type CustomerFormValues = z.infer<typeof customerBaseSchema>;
