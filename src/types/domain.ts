// =============================================================
// Shared Domain Types — single source of truth for all interfaces
// =============================================================

import type { Database } from '@/integrations/supabase/types';

// Re-export DB enum types for convenience
export type TerminStatus = Database['public']['Enums']['termin_status'];
export type AppRole = Database['public']['Enums']['app_role'];
export type LeistungsStatus = Database['public']['Enums']['leistungs_status'];
export type Leistungsart = Database['public']['Enums']['leistungsart'];
export type KostentraegerTyp = Database['public']['Enums']['kostentraeger_typ'];
export type RechnungStatus = Database['public']['Enums']['rechnung_status'];
export type RecurrenceInterval = Database['public']['Enums']['recurrence_interval'];
export type BenutzerStatus = Database['public']['Enums']['benutzer_status'];
export type ApprovalStatus = Database['public']['Enums']['approval_status'];

// ─── Employee ───────────────────────────────────────────────
export interface Employee {
  id: string;
  vorname?: string | null;
  nachname?: string | null;
  name: string;
  telefon?: string | null;
  ist_aktiv: boolean;
  max_termine_pro_tag?: number | null;
  farbe_kalender: string;
  workload?: number;
  soll_wochenstunden?: number | null;
  qualification?: string | null;
  employment_type?: string | null;
  is_bookable?: boolean;
  hourly_rate?: number | null;
  avatar_url?: string | null;
  benutzer_id?: string | null;
  strasse?: string | null;
  plz?: string | null;
  stadt?: string | null;
  zustaendigkeitsbereich?: string | null;
  benutzer?: {
    email: string;
    vorname: string;
    nachname: string;
  };
  rolle?: string;
}

/** Minimal employee for lists / dropdowns */
export interface EmployeeSummary {
  id: string;
  name: string;
  farbe_kalender: string;
  vorname?: string | null;
  nachname?: string | null;
}

// ─── Customer ───────────────────────────────────────────────
export interface Customer {
  id: string;
  name: string | null;
  vorname?: string | null;
  nachname?: string | null;
  email: string | null;
  telefonnr: string | null;
  geburtsdatum: string | null;
  pflegegrad: number | null;
  adresse: string | null;
  strasse?: string | null;
  plz?: string | null;
  stadt?: string | null;
  stadtteil: string | null;
  aktiv: boolean;
  status: string | null;
  pflegekasse: string | null;
  versichertennummer: string | null;
  stunden_kontingent_monat: number | null;
  tage?: string | null;
  mitarbeiter: string | null;
  angehoerige_ansprechpartner: string | null;
  farbe_kalender?: string;
  kunden_nummer?: number;
  sollstunden?: number | null;
  termindauer_stunden?: number | null;
  terminfrequenz?: string | null;
  kontaktweg?: string | null;
  geschlecht?: string | null;
  eintritt?: string | null;
  austritt?: string | null;
  startdatum?: string | null;
  kategorie?: string | null;
  sonstiges?: string | null;
  // Versicherung & Abrechnung
  kasse_privat?: string | null;
  kopie_lw?: string | null;
  rechnungskopie?: string[] | null;
  rechnungskopie_adresse_name?: string | null;
  rechnungskopie_adresse_strasse?: string | null;
  rechnungskopie_adresse_plz?: string | null;
  rechnungskopie_adresse_stadt?: string | null;
  budget_prioritaet?: string[] | null;
  // Notfall-Kontakt
  notfall_name?: string | null;
  notfall_telefon?: string | null;
  // Verhinderungspflege
  verhinderungspflege_aktiv?: boolean | null;
  verhinderungspflege_beantragt?: boolean | null;
  verhinderungspflege_genehmigt?: boolean | null;
  verhinderungspflege_budget?: number | null;
  verhinderungspflege_status?: string | null;
  // Pflegesachleistung
  pflegesachleistung_aktiv?: boolean | null;
  pflegesachleistung_beantragt?: boolean | null;
  pflegesachleistung_budget?: number | null;
  pflegesachleistung_genehmigt?: boolean | null;
}

/** Minimal customer for comboboxes */
export interface CustomerSummary {
  id: string;
  name: string | null;
  vorname?: string | null;
  nachname?: string | null;
  farbe_kalender?: string;
}

// ─── Appointment / Termin ───────────────────────────────────

/** Minimal appointment fields used by calendar/grid components */
export type TerminKategorie = 'Kundentermin' | 'Erstgespräch' | 'Schulung' | 'Meeting' | 'Bewerbungsgespräch' | 'Blocker' | 'Intern' | 'Regelbesuch' | 'Ausfall (abrechenbar)' | 'Ausfall (nicht abrechenbar)' | 'Sonstiges';
export type AbsageKanal = 'Telefonisch' | 'E-Mail' | 'Persönlich' | 'WhatsApp' | 'Sonstiges';

export interface CalendarAppointment {
  id: string;
  titel: string;
  kunden_id: string | null;
  mitarbeiter_id: string | null;
  start_at: string;
  end_at: string;
  status?: TerminStatus;
  notizen?: string | null;
  kategorie?: TerminKategorie | null;
  customer?: { id: string; name: string | null; farbe_kalender?: string; email?: string | null; telefonnr?: string | null; strasse?: string | null; plz?: string | null; stadt?: string | null; stadtteil?: string | null; pflegegrad?: number | null; pflegekasse?: string | null; versichertennummer?: string | null; sonstiges?: string | null; vorname?: string | null; nachname?: string | null };
  employee?: { id: string; name: string; farbe_kalender: string };
  vorlage_id?: string | null;
  ist_ausnahme?: boolean | null;
  ausnahme_grund?: string | null;
  ma_kommentar?: string | null;
}

/** Full appointment with all fields */
export interface Appointment extends CalendarAppointment {
  status: TerminStatus;
  customer?: CustomerSummary & Partial<Customer>;
  employee?: EmployeeSummary & Partial<Employee>;
  notizen?: string | null;
  iststunden?: number | null;
  absage_datum?: string | null;
  absage_kanal?: AbsageKanal | null;
}

// ─── Time Windows ───────────────────────────────────────────
export interface CustomerTimeWindow {
  id?: string;
  kunden_id?: string;
  wochentag: number;
  von: string;
  bis: string;
  prioritaet?: number;
}

export interface EmployeeAvailability {
  id?: string;
  mitarbeiter_id: string;
  wochentag: number;
  von: string;
  bis: string;
}

// ─── Absence ────────────────────────────────────────────────
export interface EmployeeAbsence {
  id: string;
  mitarbeiter_id: string;
  von: string | null;
  bis: string | null;
  typ: string;
  grund: string | null;
  status: string;
  requested_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
}

// ─── Benutzer ───────────────────────────────────────────────
export interface Benutzer {
  id: string;
  email: string;
  vorname: string | null;
  nachname: string | null;
  rolle: AppRole;
  status: BenutzerStatus;
  geburtsdatum?: string | null;
  created_at?: string;
}

// ─── Mitarbeiter (DB row shape, used in admin views) ────────
export interface MitarbeiterRow {
  id: string;
  vorname: string | null;
  nachname: string | null;
  telefon: string | null;
  ist_aktiv: boolean;
  farbe_kalender: string | null;
  benutzer_id: string | null;
  soll_wochenstunden: number | null;
  max_termine_pro_tag: number | null;
  qualification: string | null;
  employment_type: string | null;
  is_bookable: boolean;
  hourly_rate: number | null;
  avatar_url: string | null;
  strasse: string | null;
  plz: string | null;
  stadt: string | null;
  zustaendigkeitsbereich: string | null;
  // Reiter 1: Persoenliche Daten & Vertrag
  gehalt_pro_monat: number | null;
  vertragsstunden_pro_monat: number | null;
  geburtsdatum: string | null;
  geburtsname: string | null;
  geburtsort: string | null;
  geburtsland: string | null;
  geschlecht: string | null;
  konfession: string | null;
  email: string | null;
  bank_institut: string | null;
  iban: string | null;
  // Reiter 2: Steuer & Sozialversicherung
  steuer_id: string | null;
  steuerklasse: number | null;
  kinderfreibetrag: number | null;
  sv_rv_nummer: string | null;
  krankenkasse: string | null;
  // Reiter 3: Weitere Beschaeftigungsverhaeltnisse
  weitere_beschaeftigung: boolean | null;
}

// ─── Nebenbeschaeftigung ────────────────────────────────────
export interface MitarbeiterNebenbeschaeftigung {
  id: string;
  mitarbeiter_id: string;
  arbeitgeber: string;
  art_beschaeftigung: string | null;
  arbeitszeit_stunden_woche: number | null;
  gehalt_monatlich: number | null;
  sv_pflicht: boolean;
}

// ─── Budget Manuelle Einträge ────────────────────────────────

export interface BudgetManuellerEintrag {
  id: string;
  kunden_id: string;
  bezeichnung: string;
  betrag: number;
  verfaellt_am: string; // ISO date string
  notizen: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Pflegebudget ───────────────────────────────────────────

export type ServiceType = 'ENTLASTUNG' | 'KOMBI' | 'VERHINDERUNG' | 'PRIVAT';
export type TransactionSource = 'APLANO_IMPORT' | 'MANUAL';
export type AllocationStatus = 'OK' | 'OPTIMIZE' | 'BUDGET_EXCEEDED';

export interface SplitAllocation {
  type: ServiceType;
  amount: number;
}

export interface BudgetTransaction {
  id: string;
  budget_id?: string | null;
  client_id: string;
  service_date: string;
  hours: number;
  visits: number;
  service_type: ServiceType;
  hourly_rate: number;
  travel_flat_total: number;
  total_amount: number;
  source: TransactionSource;
  external_ref?: string | null;
  billed: boolean;
  allocation_type: 'AUTO' | 'MANUAL';
  created_at: string;
}

export interface Tariff {
  id: string;
  service_type: 'ENTLASTUNG' | 'KOMBI' | 'VERHINDERUNG';
  hourly_rate: number;
  travel_flat_per_visit: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CareLevel {
  pflegegrad: number;
  sachleistung_monat: number;
  kombi_max_40_prozent_monat: number;
}

export interface BudgetAvailability {
  entlastungYearlyTotal: number;
  entlastungConsumed: number;
  entlastungAvailable: number;
  kombiMonthlyMax: number;
  kombiConsumed: number;
  kombiAvailable: number;
  vpYearlyTotal: number;
  vpConsumed: number;
  vpRemainingYear: number;
  expiringCarryOver: number;
}

export interface BillingSuggestion {
  entlastung: number;
  kombi: number;
  verhinderung: number;
  privat: number;
  total: number;
  transactions: (BudgetTransaction & { suggestedType: ServiceType; splitAllocations?: SplitAllocation[] })[];
}

export interface AbrechnungsRow {
  kunde: Customer & {
    entlastung_genehmigt?: boolean | null;
    privatrechnung_erlaubt?: boolean | null;
    initial_budget_entlastung?: number | null;
    initial_budget_verhinderung?: number | null;
    verhinderungspflege_genehmigt_am?: string | null;
    kombileistung_genehmigt_am?: string | null;
    archiviert?: boolean | null;
  };
  suggestion: BillingSuggestion;
  availability: BudgetAvailability;
  status: AllocationStatus;
  isPrivate: boolean;
}

// ─── Recurring Template ─────────────────────────────────────
export interface TerminVorlage {
  id: string;
  kunden_id: string | null;
  mitarbeiter_id: string | null;
  wochentag: number;
  start_zeit: string;
  dauer_minuten: number;
  intervall: RecurrenceInterval;
  ist_aktiv: boolean;
  gueltig_von: string;
  gueltig_bis: string | null;
  titel: string;
  notizen: string | null;
}
