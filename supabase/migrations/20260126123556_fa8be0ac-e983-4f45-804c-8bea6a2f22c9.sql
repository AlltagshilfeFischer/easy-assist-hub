-- ============================================
-- EASYASSIST HUB - VOLLSTÄNDIGES SCHEMA
-- ============================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 2. ENUMS
DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE benutzer_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE recurrence_interval AS ENUM ('none', 'weekly', 'biweekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE standort AS ENUM ('Hannover');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE termin_status AS ENUM ('unassigned', 'scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_rolle AS ENUM ('admin', 'manager', 'mitarbeiter');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. TABELLEN

-- Benutzer
CREATE TABLE IF NOT EXISTS public.benutzer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  rolle user_rolle NOT NULL,
  status benutzer_status NOT NULL DEFAULT 'pending',
  vorname TEXT,
  nachname TEXT,
  geburtsdatum DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mitarbeiter
CREATE TABLE IF NOT EXISTS public.mitarbeiter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  benutzer_id UUID UNIQUE REFERENCES public.benutzer(id) ON DELETE SET NULL,
  vorname TEXT,
  nachname TEXT,
  telefon TEXT,
  strasse TEXT,
  plz TEXT,
  stadt TEXT,
  adresse TEXT,
  standort standort DEFAULT 'Hannover',
  zustaendigkeitsbereich TEXT,
  farbe_kalender TEXT DEFAULT '#3B82F6',
  ist_aktiv BOOLEAN NOT NULL DEFAULT true,
  soll_wochenstunden NUMERIC,
  max_termine_pro_tag INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Kunden
CREATE TABLE IF NOT EXISTS public.kunden (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  vorname TEXT,
  nachname TEXT,
  email TEXT,
  telefonnr TEXT,
  strasse TEXT,
  plz TEXT,
  stadt TEXT,
  stadtteil TEXT,
  adresse TEXT,
  geburtsdatum DATE,
  pflegegrad SMALLINT,
  pflegekasse TEXT,
  versichertennummer TEXT,
  kasse_privat TEXT,
  kategorie TEXT DEFAULT 'Kunde',
  status TEXT,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  startdatum DATE,
  eintritt DATE,
  austritt DATE,
  sollstunden SMALLINT,
  stunden_kontingent_monat NUMERIC DEFAULT 0,
  mitarbeiter UUID REFERENCES public.mitarbeiter(id) ON DELETE SET NULL,
  notfall_name TEXT,
  notfall_telefon TEXT,
  angehoerige_ansprechpartner TEXT,
  begruendung TEXT,
  verhinderungspflege_status TEXT,
  kopie_lw TEXT,
  tage TEXT,
  sonstiges TEXT,
  column1 TEXT,
  farbe_kalender TEXT DEFAULT '#10B981',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Kunden Zeitfenster
CREATE TABLE IF NOT EXISTS public.kunden_zeitfenster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kunden_id UUID NOT NULL REFERENCES public.kunden(id) ON DELETE CASCADE,
  wochentag SMALLINT,
  von TIME,
  bis TIME,
  prioritaet SMALLINT DEFAULT 3
);

-- Mitarbeiter Verfügbarkeit
CREATE TABLE IF NOT EXISTS public.mitarbeiter_verfuegbarkeit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mitarbeiter_id UUID NOT NULL REFERENCES public.mitarbeiter(id) ON DELETE CASCADE,
  wochentag SMALLINT NOT NULL,
  von TIME NOT NULL,
  bis TIME NOT NULL
);

-- Mitarbeiter Abwesenheiten
CREATE TABLE IF NOT EXISTS public.mitarbeiter_abwesenheiten (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mitarbeiter_id UUID NOT NULL REFERENCES public.mitarbeiter(id) ON DELETE CASCADE,
  zeitraum TSTZRANGE NOT NULL,
  grund TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Termin Vorlagen
CREATE TABLE IF NOT EXISTS public.termin_vorlagen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titel TEXT NOT NULL,
  kunden_id UUID NOT NULL REFERENCES public.kunden(id) ON DELETE CASCADE,
  mitarbeiter_id UUID REFERENCES public.mitarbeiter(id) ON DELETE SET NULL,
  wochentag SMALLINT NOT NULL,
  start_zeit TIME NOT NULL,
  dauer_minuten INTEGER NOT NULL DEFAULT 60,
  intervall recurrence_interval NOT NULL DEFAULT 'weekly',
  gueltig_von DATE NOT NULL DEFAULT CURRENT_DATE,
  gueltig_bis DATE,
  ist_aktiv BOOLEAN NOT NULL DEFAULT true,
  notizen TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Termine
CREATE TABLE IF NOT EXISTS public.termine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titel TEXT NOT NULL,
  kunden_id UUID NOT NULL REFERENCES public.kunden(id) ON DELETE CASCADE,
  mitarbeiter_id UUID REFERENCES public.mitarbeiter(id) ON DELETE SET NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status termin_status NOT NULL DEFAULT 'unassigned',
  vorlage_id UUID REFERENCES public.termin_vorlagen(id) ON DELETE SET NULL,
  ist_ausnahme BOOLEAN DEFAULT false,
  ausnahme_grund TEXT,
  iststunden NUMERIC DEFAULT 0,
  notizen TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Termin Änderungen
CREATE TABLE IF NOT EXISTS public.termin_aenderungen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  termin_id UUID NOT NULL REFERENCES public.termine(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.benutzer(id) ON DELETE CASCADE,
  status approval_status NOT NULL DEFAULT 'pending',
  old_start_at TIMESTAMPTZ,
  old_end_at TIMESTAMPTZ,
  old_kunden_id UUID REFERENCES public.kunden(id),
  old_mitarbeiter_id UUID REFERENCES public.mitarbeiter(id),
  new_start_at TIMESTAMPTZ,
  new_end_at TIMESTAMPTZ,
  new_kunden_id UUID REFERENCES public.kunden(id),
  new_mitarbeiter_id UUID REFERENCES public.mitarbeiter(id),
  reason TEXT,
  approver_id UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dokumente
CREATE TABLE IF NOT EXISTS public.dokumente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titel TEXT NOT NULL,
  dateiname TEXT NOT NULL,
  dateipfad TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  groesse_bytes BIGINT NOT NULL,
  beschreibung TEXT,
  kategorie TEXT NOT NULL DEFAULT 'kunde',
  kunden_id UUID REFERENCES public.kunden(id) ON DELETE SET NULL,
  mitarbeiter_id UUID REFERENCES public.mitarbeiter(id) ON DELETE SET NULL,
  hochgeladen_von UUID NOT NULL REFERENCES public.benutzer(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pending Registrations
CREATE TABLE IF NOT EXISTS public.pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  vorname TEXT,
  nachname TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  ignored BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID REFERENCES public.benutzer(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  row_id UUID,
  old_data JSONB,
  new_data JSONB,
  actor_benutzer_id UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. INDIZES
CREATE INDEX IF NOT EXISTS idx_termine_mitarbeiter ON public.termine(mitarbeiter_id);
CREATE INDEX IF NOT EXISTS idx_termine_kunden ON public.termine(kunden_id);
CREATE INDEX IF NOT EXISTS idx_termine_start_at ON public.termine(start_at);
CREATE INDEX IF NOT EXISTS idx_kunden_aktiv ON public.kunden(aktiv);
CREATE INDEX IF NOT EXISTS idx_mitarbeiter_aktiv ON public.mitarbeiter(ist_aktiv);

-- 5. ENABLE RLS
ALTER TABLE public.benutzer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mitarbeiter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kunden ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kunden_zeitfenster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mitarbeiter_verfuegbarkeit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mitarbeiter_abwesenheiten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.termin_vorlagen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.termine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.termin_aenderungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dokumente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 6. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.benutzer
    WHERE id = user_id AND rolle = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_rolle(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT rolle::text FROM public.benutzer WHERE id = p_user_id
$$;

-- 7. RLS POLICIES

-- Benutzer policies
CREATE POLICY "Users can read own benutzer" ON public.benutzer
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admins can read all benutzer" ON public.benutzer
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update benutzer" ON public.benutzer
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Allow registration insert" ON public.benutzer
  FOR INSERT WITH CHECK (status = 'pending' AND rolle = 'mitarbeiter');

-- Mitarbeiter policies
CREATE POLICY "Mitarbeiter can read own data" ON public.mitarbeiter
  FOR SELECT USING (benutzer_id = auth.uid());

CREATE POLICY "Admins can manage mitarbeiter" ON public.mitarbeiter
  FOR ALL USING (is_admin(auth.uid()));

-- Kunden policies
CREATE POLICY "Admins can manage kunden" ON public.kunden
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Mitarbeiter can read assigned kunden" ON public.kunden
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM mitarbeiter m
    JOIN termine t ON t.mitarbeiter_id = m.id
    WHERE m.benutzer_id = auth.uid() AND t.kunden_id = kunden.id
  ));

-- Termine policies
CREATE POLICY "Admins can manage termine" ON public.termine
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Employees can read own termine" ON public.termine
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM mitarbeiter m
    WHERE m.benutzer_id = auth.uid() AND m.id = termine.mitarbeiter_id
  ));

CREATE POLICY "Employees can update own termine" ON public.termine
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM mitarbeiter m
    WHERE m.benutzer_id = auth.uid() AND m.id = termine.mitarbeiter_id
  ));

-- Termin Änderungen policies
CREATE POLICY "Admins can manage termin_aenderungen" ON public.termin_aenderungen
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Mitarbeiter can read own requests" ON public.termin_aenderungen
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM benutzer b
    WHERE b.id = auth.uid() AND b.id = termin_aenderungen.requested_by
  ));

-- Other admin-managed tables
CREATE POLICY "Admins manage kunden_zeitfenster" ON public.kunden_zeitfenster
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Admins manage mitarbeiter_verfuegbarkeit" ON public.mitarbeiter_verfuegbarkeit
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Admins manage mitarbeiter_abwesenheiten" ON public.mitarbeiter_abwesenheiten
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Admins manage termin_vorlagen" ON public.termin_vorlagen
  FOR ALL USING (is_admin(auth.uid()));

-- Dokumente policies
CREATE POLICY "Admins manage dokumente" ON public.dokumente
  FOR ALL USING (is_admin(auth.uid()));

-- Pending registrations policies
CREATE POLICY "Anyone can request registration" ON public.pending_registrations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view registrations" ON public.pending_registrations
  FOR SELECT USING (is_admin(auth.uid()) AND ignored = false);

CREATE POLICY "Admins can update registrations" ON public.pending_registrations
  FOR UPDATE USING (is_admin(auth.uid()));

-- Audit log policies
CREATE POLICY "Authenticated can read audit_log" ON public.audit_log
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert audit_log" ON public.audit_log
  FOR INSERT WITH CHECK (true);