-- =====================================================
-- VOLLSTÄNDIGE MIGRATION - ALLE POLICIES UND FUNKTIONEN ENTFERNEN
-- =====================================================

-- STORAGE POLICIES
DROP POLICY IF EXISTS "Admins can delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Only GF can delete avatars" ON storage.objects;

-- BENUTZER POLICIES (alle löschen inkl. älteren Versionen)
DROP POLICY IF EXISTS "Allow registration insert" ON public.benutzer;
DROP POLICY IF EXISTS "Admins can read all benutzer" ON public.benutzer;
DROP POLICY IF EXISTS "Admins can update benutzer" ON public.benutzer;
DROP POLICY IF EXISTS "Users can read own benutzer" ON public.benutzer;
DROP POLICY IF EXISTS "Admins can insert benutzer" ON public.benutzer;
DROP POLICY IF EXISTS "Only GF can delete benutzer" ON public.benutzer;
DROP POLICY IF EXISTS "benutzer_authenticated_all" ON public.benutzer;
DROP POLICY IF EXISTS "Authenticated users can read benutzer" ON public.benutzer;
DROP POLICY IF EXISTS "Authenticated users can update their own benutzer" ON public.benutzer;
DROP POLICY IF EXISTS "Admins can update benutzer status" ON public.benutzer;
DROP POLICY IF EXISTS "Allow public registration in benutzer" ON public.benutzer;
DROP POLICY IF EXISTS "Authenticated employees can view benutzer" ON public.benutzer;

-- USER_ROLES POLICIES  
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only GF can delete roles" ON public.user_roles;

-- MITARBEITER POLICIES
DROP POLICY IF EXISTS "Admins can manage mitarbeiter" ON public.mitarbeiter;
DROP POLICY IF EXISTS "Mitarbeiter can read own data" ON public.mitarbeiter;
DROP POLICY IF EXISTS "Admins can read mitarbeiter" ON public.mitarbeiter;
DROP POLICY IF EXISTS "Admins can insert mitarbeiter" ON public.mitarbeiter;
DROP POLICY IF EXISTS "Admins can update mitarbeiter" ON public.mitarbeiter;
DROP POLICY IF EXISTS "Only GF can delete mitarbeiter" ON public.mitarbeiter;

-- KUNDEN POLICIES
DROP POLICY IF EXISTS "Admins can manage kunden" ON public.kunden;
DROP POLICY IF EXISTS "Mitarbeiter can read assigned kunden" ON public.kunden;
DROP POLICY IF EXISTS "Admins can read kunden" ON public.kunden;
DROP POLICY IF EXISTS "Admins can insert kunden" ON public.kunden;
DROP POLICY IF EXISTS "Admins can update kunden" ON public.kunden;
DROP POLICY IF EXISTS "Only GF can delete kunden" ON public.kunden;

-- TERMINE POLICIES
DROP POLICY IF EXISTS "Admins can manage termine" ON public.termine;
DROP POLICY IF EXISTS "Employees can read own termine" ON public.termine;
DROP POLICY IF EXISTS "Employees can update own termine" ON public.termine;
DROP POLICY IF EXISTS "Admins can read termine" ON public.termine;
DROP POLICY IF EXISTS "Admins can insert termine" ON public.termine;
DROP POLICY IF EXISTS "Admins can update termine" ON public.termine;
DROP POLICY IF EXISTS "Only GF can delete termine" ON public.termine;

-- TERMIN_AENDERUNGEN POLICIES
DROP POLICY IF EXISTS "Admins can manage termin_aenderungen" ON public.termin_aenderungen;
DROP POLICY IF EXISTS "Mitarbeiter can read own requests" ON public.termin_aenderungen;
DROP POLICY IF EXISTS "Admins can read termin_aenderungen" ON public.termin_aenderungen;
DROP POLICY IF EXISTS "Admins can insert termin_aenderungen" ON public.termin_aenderungen;
DROP POLICY IF EXISTS "Admins can update termin_aenderungen" ON public.termin_aenderungen;
DROP POLICY IF EXISTS "Only GF can delete termin_aenderungen" ON public.termin_aenderungen;
DROP POLICY IF EXISTS "Mitarbeiter can insert own requests" ON public.termin_aenderungen;

-- KUNDEN_ZEITFENSTER POLICIES
DROP POLICY IF EXISTS "Admins manage kunden_zeitfenster" ON public.kunden_zeitfenster;
DROP POLICY IF EXISTS "Admins can read kunden_zeitfenster" ON public.kunden_zeitfenster;
DROP POLICY IF EXISTS "Admins can insert kunden_zeitfenster" ON public.kunden_zeitfenster;
DROP POLICY IF EXISTS "Admins can update kunden_zeitfenster" ON public.kunden_zeitfenster;
DROP POLICY IF EXISTS "Only GF can delete kunden_zeitfenster" ON public.kunden_zeitfenster;

-- MITARBEITER_VERFUEGBARKEIT POLICIES
DROP POLICY IF EXISTS "Admins manage mitarbeiter_verfuegbarkeit" ON public.mitarbeiter_verfuegbarkeit;
DROP POLICY IF EXISTS "Admins can read mitarbeiter_verfuegbarkeit" ON public.mitarbeiter_verfuegbarkeit;
DROP POLICY IF EXISTS "Admins can insert mitarbeiter_verfuegbarkeit" ON public.mitarbeiter_verfuegbarkeit;
DROP POLICY IF EXISTS "Admins can update mitarbeiter_verfuegbarkeit" ON public.mitarbeiter_verfuegbarkeit;
DROP POLICY IF EXISTS "Only GF can delete mitarbeiter_verfuegbarkeit" ON public.mitarbeiter_verfuegbarkeit;

-- MITARBEITER_ABWESENHEITEN POLICIES
DROP POLICY IF EXISTS "Admins manage mitarbeiter_abwesenheiten" ON public.mitarbeiter_abwesenheiten;
DROP POLICY IF EXISTS "Admins can read mitarbeiter_abwesenheiten" ON public.mitarbeiter_abwesenheiten;
DROP POLICY IF EXISTS "Admins can insert mitarbeiter_abwesenheiten" ON public.mitarbeiter_abwesenheiten;
DROP POLICY IF EXISTS "Admins can update mitarbeiter_abwesenheiten" ON public.mitarbeiter_abwesenheiten;
DROP POLICY IF EXISTS "Only GF can delete mitarbeiter_abwesenheiten" ON public.mitarbeiter_abwesenheiten;

-- TERMIN_VORLAGEN POLICIES
DROP POLICY IF EXISTS "Admins manage termin_vorlagen" ON public.termin_vorlagen;
DROP POLICY IF EXISTS "Admins can read termin_vorlagen" ON public.termin_vorlagen;
DROP POLICY IF EXISTS "Admins can insert termin_vorlagen" ON public.termin_vorlagen;
DROP POLICY IF EXISTS "Admins can update termin_vorlagen" ON public.termin_vorlagen;
DROP POLICY IF EXISTS "Only GF can delete termin_vorlagen" ON public.termin_vorlagen;

-- DOKUMENTE POLICIES
DROP POLICY IF EXISTS "Admins manage dokumente" ON public.dokumente;
DROP POLICY IF EXISTS "Admins can read dokumente" ON public.dokumente;
DROP POLICY IF EXISTS "Admins can insert dokumente" ON public.dokumente;
DROP POLICY IF EXISTS "Admins can update dokumente" ON public.dokumente;
DROP POLICY IF EXISTS "Only GF can delete dokumente" ON public.dokumente;
DROP POLICY IF EXISTS "Mitarbeiter can read assigned customer dokumente" ON public.dokumente;
DROP POLICY IF EXISTS "Mitarbeiter can upload dokumente for assigned customers" ON public.dokumente;

-- PENDING_REGISTRATIONS POLICIES
DROP POLICY IF EXISTS "Admins can view registrations" ON public.pending_registrations;
DROP POLICY IF EXISTS "Admins can update registrations" ON public.pending_registrations;
DROP POLICY IF EXISTS "Anyone can request registration" ON public.pending_registrations;

-- HAUSHALTE POLICIES
DROP POLICY IF EXISTS "Admins can manage haushalte" ON public.haushalte;
DROP POLICY IF EXISTS "Mitarbeiter can read haushalte via termine" ON public.haushalte;
DROP POLICY IF EXISTS "Admins can read haushalte" ON public.haushalte;
DROP POLICY IF EXISTS "Admins can insert haushalte" ON public.haushalte;
DROP POLICY IF EXISTS "Admins can update haushalte" ON public.haushalte;
DROP POLICY IF EXISTS "Only GF can delete haushalte" ON public.haushalte;

-- EINSATZORTE POLICIES
DROP POLICY IF EXISTS "Admins can manage einsatzorte" ON public.einsatzorte;
DROP POLICY IF EXISTS "Mitarbeiter can read einsatzorte via termine" ON public.einsatzorte;
DROP POLICY IF EXISTS "Admins can read einsatzorte" ON public.einsatzorte;
DROP POLICY IF EXISTS "Admins can insert einsatzorte" ON public.einsatzorte;
DROP POLICY IF EXISTS "Admins can update einsatzorte" ON public.einsatzorte;
DROP POLICY IF EXISTS "Only GF can delete einsatzorte" ON public.einsatzorte;

-- KOSTENTRAEGER POLICIES
DROP POLICY IF EXISTS "Admins can manage kostentraeger" ON public.kostentraeger;
DROP POLICY IF EXISTS "Authenticated can read kostentraeger" ON public.kostentraeger;
DROP POLICY IF EXISTS "Admins can read kostentraeger" ON public.kostentraeger;
DROP POLICY IF EXISTS "Admins can insert kostentraeger" ON public.kostentraeger;
DROP POLICY IF EXISTS "Admins can update kostentraeger" ON public.kostentraeger;
DROP POLICY IF EXISTS "Only GF can delete kostentraeger" ON public.kostentraeger;

-- LEISTUNGEN POLICIES
DROP POLICY IF EXISTS "Admins can manage leistungen" ON public.leistungen;
DROP POLICY IF EXISTS "Mitarbeiter can read leistungen of assigned kunden" ON public.leistungen;
DROP POLICY IF EXISTS "Admins can read leistungen" ON public.leistungen;
DROP POLICY IF EXISTS "Admins can insert leistungen" ON public.leistungen;
DROP POLICY IF EXISTS "Admins can update leistungen" ON public.leistungen;
DROP POLICY IF EXISTS "Only GF can delete leistungen" ON public.leistungen;

-- LEISTUNGS_STATUS_HISTORIE POLICIES
DROP POLICY IF EXISTS "Admins can manage leistungs_status_historie" ON public.leistungs_status_historie;
DROP POLICY IF EXISTS "Authenticated can read historie" ON public.leistungs_status_historie;

-- RECHNUNGEN POLICIES
DROP POLICY IF EXISTS "Admins manage rechnungen" ON public.rechnungen;
DROP POLICY IF EXISTS "Admins can read rechnungen" ON public.rechnungen;
DROP POLICY IF EXISTS "Admins can insert rechnungen" ON public.rechnungen;
DROP POLICY IF EXISTS "Admins can update rechnungen" ON public.rechnungen;
DROP POLICY IF EXISTS "Only GF can delete rechnungen" ON public.rechnungen;

-- RECHNUNGSPOSITIONEN POLICIES
DROP POLICY IF EXISTS "Admins manage rechnungspositionen" ON public.rechnungspositionen;
DROP POLICY IF EXISTS "Admins can read rechnungspositionen" ON public.rechnungspositionen;
DROP POLICY IF EXISTS "Admins can insert rechnungspositionen" ON public.rechnungspositionen;
DROP POLICY IF EXISTS "Admins can update rechnungspositionen" ON public.rechnungspositionen;
DROP POLICY IF EXISTS "Only GF can delete rechnungspositionen" ON public.rechnungspositionen;

-- ABRECHNUNGSREGELN POLICIES
DROP POLICY IF EXISTS "Admins manage abrechnungsregeln" ON public.abrechnungsregeln;
DROP POLICY IF EXISTS "Admins can read abrechnungsregeln" ON public.abrechnungsregeln;
DROP POLICY IF EXISTS "Admins can insert abrechnungsregeln" ON public.abrechnungsregeln;
DROP POLICY IF EXISTS "Admins can update abrechnungsregeln" ON public.abrechnungsregeln;
DROP POLICY IF EXISTS "Only GF can delete abrechnungsregeln" ON public.abrechnungsregeln;

-- ABRECHNUNGS_HISTORIE POLICIES
DROP POLICY IF EXISTS "Admins read abrechnungs_historie" ON public.abrechnungs_historie;

-- AUDIT_LOG POLICIES
DROP POLICY IF EXISTS "Authenticated can insert audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated can read audit_log" ON public.audit_log;

-- =====================================================
-- FUNKTIONEN LÖSCHEN
-- =====================================================

DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_roles(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_secure(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_geschaeftsfuehrer(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_or_higher(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_delete(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_authenticated_employee(uuid) CASCADE;

-- =====================================================
-- USER_ROLES ENUM ÄNDERN
-- =====================================================

ALTER TABLE public.user_roles 
  ALTER COLUMN role TYPE text;

UPDATE public.user_roles 
SET role = CASE 
  WHEN role = 'admin' THEN 'geschaeftsfuehrer'
  WHEN role = 'manager' THEN 'admin'
  WHEN role = 'mitarbeiter' THEN 'mitarbeiter'
  ELSE role
END;

DROP TYPE IF EXISTS public.app_role CASCADE;
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('geschaeftsfuehrer', 'admin', 'mitarbeiter'); -- CREATE TYPE
EXCEPTION WHEN duplicate_object THEN
  NULL; -- bereits vorhanden, überspringen
END $$;

ALTER TABLE public.user_roles 
  ALTER COLUMN role TYPE public.app_role USING role::public.app_role;

-- =====================================================
-- BENUTZER TABELLE ENUM ÄNDERN
-- =====================================================

ALTER TABLE public.benutzer 
  ALTER COLUMN rolle TYPE text;

UPDATE public.benutzer 
SET rolle = CASE 
  WHEN rolle = 'admin' THEN 'geschaeftsfuehrer'
  WHEN rolle = 'manager' THEN 'admin'
  WHEN rolle = 'mitarbeiter' THEN 'mitarbeiter'
  ELSE rolle
END;

DROP TYPE IF EXISTS public.user_rolle CASCADE;
DO $$ BEGIN
  CREATE TYPE public.user_rolle AS ENUM ('geschaeftsfuehrer', 'admin', 'mitarbeiter'); -- CREATE TYPE
EXCEPTION WHEN duplicate_object THEN
  NULL; -- bereits vorhanden, überspringen
END $$;

ALTER TABLE public.benutzer 
  ALTER COLUMN rolle TYPE public.user_rolle USING rolle::public.user_rolle;