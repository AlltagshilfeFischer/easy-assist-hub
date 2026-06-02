-- K3-Fix: Alle authenticated_all-Basis-Policies droppen.
--
-- HINTERGRUND: Die Migration 20250101000000_base_schema.sql hat auf jeder Tabelle
-- eine "FOR ALL TO authenticated USING (true)"-Policy gesetzt. Da Supabase
-- permissiv arbeitet (OR-Logik zwischen Policies), sind alle späteren granularen
-- Policies wirkungslos solange diese Basis-Policies existieren — jeder
-- eingeloggte Nutzer kann alles lesen und schreiben.
--
-- SICHERHEIT: Alle 34 Tabellen unten haben granulare Policies in späteren Migrations.
-- Ausnahme: profiles, customers, employees, appointments = Lovable-Legacy-Tabellen,
-- nicht im Code referenziert, kein Funktionsverlust beim Drop.
--
-- DEPLOYMENT-REIHENFOLGE:
--   1. 20260602100300_mitarbeiter_nebenbeschaeftigung_rls.sql (muss vorher deployed sein!)
--   2. Diese Migration
--
-- NACH DEPLOYMENT TESTEN:
--   - GF-Login: Kunden, Mitarbeiter, LN, Termine sichtbar + editierbar
--   - Buchhaltung-Login: Kunden lesbar, keine Schreibrechte auf Stammdaten
--   - Mitarbeiter-Login: Nur eigene Termine sichtbar, keine Kundendaten

-- ── Aktive Tabellen (granulare Policies vorhanden) ─────────────

DROP POLICY IF EXISTS "haushalte_authenticated_all"                         ON public.haushalte;
DROP POLICY IF EXISTS "kostentraeger_authenticated_all"                     ON public.kostentraeger;
DROP POLICY IF EXISTS "benutzer_authenticated_all"                         ON public.benutzer;
DROP POLICY IF EXISTS "permissions_authenticated_all"                      ON public.permissions;
DROP POLICY IF EXISTS "qualifikationen_authenticated_all"                   ON public.qualifikationen;
DROP POLICY IF EXISTS "mitarbeiter_authenticated_all"                      ON public.mitarbeiter;
DROP POLICY IF EXISTS "kunden_authenticated_all"                           ON public.kunden;
DROP POLICY IF EXISTS "einsatzorte_authenticated_all"                      ON public.einsatzorte;
DROP POLICY IF EXISTS "kunden_zeitfenster_authenticated_all"               ON public.kunden_zeitfenster;
DROP POLICY IF EXISTS "mitarbeiter_verfuegbarkeit_authenticated_all"       ON public.mitarbeiter_verfuegbarkeit;
DROP POLICY IF EXISTS "mitarbeiter_abwesenheiten_authenticated_all"        ON public.mitarbeiter_abwesenheiten;
DROP POLICY IF EXISTS "mitarbeiter_qualifikationen_authenticated_all"      ON public.mitarbeiter_qualifikationen;
DROP POLICY IF EXISTS "mitarbeiter_nebenbeschaeftigung_authenticated_all"  ON public.mitarbeiter_nebenbeschaeftigung;
DROP POLICY IF EXISTS "termin_vorlagen_authenticated_all"                  ON public.termin_vorlagen;
DROP POLICY IF EXISTS "termine_authenticated_all"                          ON public.termine;
DROP POLICY IF EXISTS "termin_aenderungen_authenticated_all"               ON public.termin_aenderungen;
DROP POLICY IF EXISTS "dokumente_authenticated_all"                        ON public.dokumente;
DROP POLICY IF EXISTS "notfallkontakte_authenticated_all"                  ON public.notfallkontakte;
DROP POLICY IF EXISTS "pending_registrations_authenticated_all"            ON public.pending_registrations;
DROP POLICY IF EXISTS "user_roles_authenticated_all"                       ON public.user_roles;
DROP POLICY IF EXISTS "role_permissions_authenticated_all"                 ON public.role_permissions;
DROP POLICY IF EXISTS "audit_log_authenticated_all"                        ON public.audit_log;
DROP POLICY IF EXISTS "benachrichtigungen_authenticated_all"               ON public.benachrichtigungen;
DROP POLICY IF EXISTS "leistungen_authenticated_all"                       ON public.leistungen;
DROP POLICY IF EXISTS "leistungs_status_historie_authenticated_all"        ON public.leistungs_status_historie;
DROP POLICY IF EXISTS "rechnungen_authenticated_all"                       ON public.rechnungen;
DROP POLICY IF EXISTS "rechnungspositionen_authenticated_all"              ON public.rechnungspositionen;
DROP POLICY IF EXISTS "abrechnungs_historie_authenticated_all"             ON public.abrechnungs_historie;
DROP POLICY IF EXISTS "abrechnungsregeln_authenticated_all"                ON public.abrechnungsregeln;
DROP POLICY IF EXISTS "leistungsnachweise_authenticated_all"               ON public.leistungsnachweise;
DROP POLICY IF EXISTS "schedule_templates_authenticated_all"               ON public.schedule_templates;

-- ── Dev/Progress-Tabellen ──────────────────────────────────────
DROP POLICY IF EXISTS "development_todos_authenticated_all"                ON public.development_todos;
DROP POLICY IF EXISTS "dev_modules_authenticated_all"                      ON public.dev_modules;
DROP POLICY IF EXISTS "dev_features_authenticated_all"                     ON public.dev_features;
DROP POLICY IF EXISTS "dev_notes_authenticated_all"                        ON public.dev_notes;

-- ── Legacy-Lovable-Tabellen (nicht im App-Code referenziert) ───
-- Diese Policies belassen oder separat behandeln — kein Produktionsrisiko.
-- DROP POLICY IF EXISTS "profiles_authenticated_all"   ON public.profiles;
-- DROP POLICY IF EXISTS "customers_authenticated_all"  ON public.customers;
-- DROP POLICY IF EXISTS "employees_authenticated_all"  ON public.employees;
-- DROP POLICY IF EXISTS "appointments_authenticated_all" ON public.appointments;
