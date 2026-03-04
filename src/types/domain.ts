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
  haushalt_id?: string | null;
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
export interface CalendarAppointment {
  id: string;
  titel: string;
  kunden_id: string;
  mitarbeiter_id: string | null;
  start_at: string;
  end_at: string;
  status?: TerminStatus;
  customer?: { id: string; name: string | null; farbe_kalender?: string; email?: string | null; telefonnr?: string | null; strasse?: string | null; plz?: string | null; stadt?: string | null; stadtteil?: string | null };
  employee?: { id: string; name: string; farbe_kalender: string };
  vorlage_id?: string | null;
  ist_ausnahme?: boolean | null;
  ausnahme_grund?: string | null;
}

/** Full appointment with all fields */
export interface Appointment extends CalendarAppointment {
  status: TerminStatus;
  customer?: CustomerSummary & Partial<Customer>;
  employee?: EmployeeSummary & Partial<Employee>;
  notizen?: string | null;
  iststunden?: number | null;
  einsatzort_id?: string | null;
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
}

// ─── Haushalt ───────────────────────────────────────────────
export interface Haushalt {
  id: string;
  name: string;
  notfall_name?: string | null;
  notfall_telefon?: string | null;
  angehoerige_ansprechpartner?: string | null;
  rechnungsempfaenger_name?: string | null;
  rechnungsempfaenger_strasse?: string | null;
  rechnungsempfaenger_plz?: string | null;
  rechnungsempfaenger_stadt?: string | null;
  sonstiges?: string | null;
}

// ─── Recurring Template ─────────────────────────────────────
export interface TerminVorlage {
  id: string;
  kunden_id: string;
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
