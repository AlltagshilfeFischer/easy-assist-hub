
-- Permissions-Tabelle
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  beschreibung text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read permissions"
  ON public.permissions FOR SELECT
  USING (public.is_admin_or_higher(auth.uid()));

-- Role-Permissions Zuordnung
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.app_role NOT NULL,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_id)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read role_permissions"
  ON public.role_permissions FOR SELECT
  USING (public.is_admin_or_higher(auth.uid()));

-- Permissions seeden
INSERT INTO public.permissions (name, beschreibung) VALUES
  ('users.create', 'Benutzer erstellen'),
  ('users.deactivate', 'Benutzer deaktivieren'),
  ('users.assign_roles', 'Rollen vergeben'),
  ('einsaetze.planen', 'Einsätze planen'),
  ('einsaetze.lesen', 'Einsätze lesen'),
  ('kunden.verwalten', 'Kunden verwalten (CRUD)'),
  ('kunden.lesen', 'Kunden lesen'),
  ('mitarbeiter.lesen', 'Mitarbeiter lesen'),
  ('reports.lesen', 'Reports einsehen'),
  ('einstellungen.aendern', 'Systemeinstellungen ändern'),
  ('rechnungen.lesen', 'Rechnungen einsehen'),
  ('rechnungen.verwalten', 'Rechnungen Status verwalten'),
  ('zeiterfassung.eigen', 'Eigene Zeiterfassung'),
  ('dokumentation.eigen', 'Eigene Dokumentation')
ON CONFLICT (name) DO NOTHING;

-- StandortSuperadmin (geschaeftsfuehrer): Alles
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'geschaeftsfuehrer'::app_role, id FROM public.permissions
ON CONFLICT DO NOTHING;

-- Disponent (admin): Einsätze planen, Kunden/Mitarbeiter lesen
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::app_role, id FROM public.permissions
WHERE name IN ('einsaetze.planen', 'einsaetze.lesen', 'kunden.lesen', 'mitarbeiter.lesen', 'reports.lesen')
ON CONFLICT DO NOTHING;

-- Mitarbeiter: Eigene Zeiterfassung, eigene Dokumentation, eigene Einsätze
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'mitarbeiter'::app_role, id FROM public.permissions
WHERE name IN ('einsaetze.lesen', 'zeiterfassung.eigen', 'dokumentation.eigen')
ON CONFLICT DO NOTHING;

-- Buchhaltung: Rechnungen lesen/verwalten, Kunden lesen
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'buchhaltung'::app_role, id FROM public.permissions
WHERE name IN ('rechnungen.lesen', 'rechnungen.verwalten', 'kunden.lesen')
ON CONFLICT DO NOTHING;

-- has_permission Security-Definer-Funktion
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND p.name = _permission
  )
$$;

-- is_buchhaltung Funktion
CREATE OR REPLACE FUNCTION public.is_buchhaltung(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'buchhaltung'::app_role
  )
$$;

-- RLS für Buchhaltung
CREATE POLICY "Buchhaltung can read rechnungen"
  ON public.rechnungen FOR SELECT
  USING (public.is_buchhaltung(auth.uid()));

CREATE POLICY "Buchhaltung can update rechnungen status"
  ON public.rechnungen FOR UPDATE
  USING (public.is_buchhaltung(auth.uid()));

CREATE POLICY "Buchhaltung can read rechnungspositionen"
  ON public.rechnungspositionen FOR SELECT
  USING (public.is_buchhaltung(auth.uid()));

CREATE POLICY "Buchhaltung can read abrechnungsregeln"
  ON public.abrechnungsregeln FOR SELECT
  USING (public.is_buchhaltung(auth.uid()));

CREATE POLICY "Buchhaltung can read kunden"
  ON public.kunden FOR SELECT
  USING (public.is_buchhaltung(auth.uid()));

CREATE POLICY "Buchhaltung can read abrechnungs_historie"
  ON public.abrechnungs_historie FOR SELECT
  USING (public.is_buchhaltung(auth.uid()));
