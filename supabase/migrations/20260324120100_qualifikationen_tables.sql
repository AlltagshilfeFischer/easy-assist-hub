-- =====================================================
-- Qualifikationen Tag-System
-- =====================================================
-- Vordefinierte Tags die Mitarbeitern zugeordnet werden koennen.
-- Erweiterbar durch GF/Admin.

BEGIN;

-- 1. Qualifikationen-Katalog
CREATE TABLE IF NOT EXISTS public.qualifikationen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  kategorie text DEFAULT 'Allgemein',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Join-Tabelle Mitarbeiter <-> Qualifikationen (m:n)
CREATE TABLE IF NOT EXISTS public.mitarbeiter_qualifikationen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mitarbeiter_id uuid NOT NULL REFERENCES public.mitarbeiter(id) ON DELETE CASCADE,
  qualifikation_id uuid NOT NULL REFERENCES public.qualifikationen(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(mitarbeiter_id, qualifikation_id)
);

-- 3. RLS aktivieren
ALTER TABLE public.qualifikationen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mitarbeiter_qualifikationen ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies - Qualifikationen-Katalog
CREATE POLICY "Everyone authenticated can read qualifikationen"
  ON public.qualifikationen FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage qualifikationen"
  ON public.qualifikationen FOR ALL
  USING (public.is_admin_or_higher(auth.uid()))
  WITH CHECK (public.is_admin_or_higher(auth.uid()));

-- 5. RLS Policies - Mitarbeiter-Qualifikationen
CREATE POLICY "Admins can manage mitarbeiter_qualifikationen"
  ON public.mitarbeiter_qualifikationen FOR ALL
  USING (public.is_admin_or_higher(auth.uid()))
  WITH CHECK (public.is_admin_or_higher(auth.uid()));

CREATE POLICY "Employees can read own qualifikationen"
  ON public.mitarbeiter_qualifikationen FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.mitarbeiter m WHERE m.id = mitarbeiter_qualifikationen.mitarbeiter_id AND m.benutzer_id = auth.uid())
  );

CREATE POLICY "Buchhaltung can read mitarbeiter_qualifikationen"
  ON public.mitarbeiter_qualifikationen FOR SELECT
  USING (public.is_buchhaltung(auth.uid()));

-- 6. Seed: Vordefinierte Qualifikationen
INSERT INTO public.qualifikationen (name, kategorie) VALUES
  ('Demenzbetreuung', 'Pflege'),
  ('Hauswirtschaft', 'Hauswirtschaft'),
  ('Grundpflege', 'Pflege'),
  ('Alltagsbegleitung', 'Betreuung'),
  ('Erste-Hilfe-Kurs', 'Zertifikate'),
  ('Mobilisation', 'Pflege'),
  ('Kochen & Ernaehrung', 'Hauswirtschaft'),
  ('Behoerdengaenge', 'Betreuung'),
  ('Einkaufsbegleitung', 'Betreuung'),
  ('Fahrdienst', 'Mobilitaet'),
  ('Gartenarbeit', 'Hauswirtschaft'),
  ('Kinderbetreuung', 'Betreuung')
ON CONFLICT (name) DO NOTHING;

-- 7. RLS fuer mitarbeiter_verfuegbarkeit erweitern (MA soll eigene lesen/schreiben)
-- Bestehende Policy "Admins can manage mitarbeiter_verfuegbarkeit" bleibt
CREATE POLICY "Employees can read own verfuegbarkeit"
  ON public.mitarbeiter_verfuegbarkeit FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.mitarbeiter m WHERE m.id = mitarbeiter_verfuegbarkeit.mitarbeiter_id AND m.benutzer_id = auth.uid())
  );

COMMIT;
