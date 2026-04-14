-- Development Progress Dashboard
-- Modules (Hauptbereiche) - add missing columns if table already exists
ALTER TABLE public.dev_modules ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE public.dev_modules ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS public.dev_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Features within modules
ALTER TABLE public.dev_features ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES public.dev_modules(id) ON DELETE CASCADE;
ALTER TABLE public.dev_features ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE public.dev_features ADD COLUMN IF NOT EXISTS progress_percent int NOT NULL DEFAULT 0;
ALTER TABLE public.dev_features ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'geplant';
ALTER TABLE public.dev_features ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS public.dev_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.dev_modules(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  progress_percent int NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  status text NOT NULL DEFAULT 'geplant' CHECK (status IN ('geplant', 'in_entwicklung', 'testphase', 'fertig')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Notes per feature
ALTER TABLE public.dev_notes ADD COLUMN IF NOT EXISTS feature_id uuid REFERENCES public.dev_features(id) ON DELETE CASCADE;
ALTER TABLE public.dev_notes ADD COLUMN IF NOT EXISTS author text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS public.dev_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id uuid NOT NULL REFERENCES public.dev_features(id) ON DELETE CASCADE,
  text text NOT NULL,
  author text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.dev_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_notes ENABLE ROW LEVEL SECURITY;

-- dev_modules policies
DROP POLICY IF EXISTS "GF and GlobalAdmin can read dev_modules" ON public.dev_modules;
CREATE POLICY "GF and GlobalAdmin can read dev_modules"
  ON public.dev_modules FOR SELECT TO authenticated
  USING (is_geschaeftsfuehrer(auth.uid()) OR is_globaladmin(auth.uid()));

DROP POLICY IF EXISTS "GF and GlobalAdmin can insert dev_modules" ON public.dev_modules;
CREATE POLICY "GF and GlobalAdmin can insert dev_modules"
  ON public.dev_modules FOR INSERT TO authenticated
  WITH CHECK (is_geschaeftsfuehrer(auth.uid()) OR is_globaladmin(auth.uid()));

DROP POLICY IF EXISTS "GF and GlobalAdmin can update dev_modules" ON public.dev_modules;
CREATE POLICY "GF and GlobalAdmin can update dev_modules"
  ON public.dev_modules FOR UPDATE TO authenticated
  USING (is_geschaeftsfuehrer(auth.uid()) OR is_globaladmin(auth.uid()));

DROP POLICY IF EXISTS "GF and GlobalAdmin can delete dev_modules" ON public.dev_modules;
CREATE POLICY "GF and GlobalAdmin can delete dev_modules"
  ON public.dev_modules FOR DELETE TO authenticated
  USING (is_geschaeftsfuehrer(auth.uid()) OR is_globaladmin(auth.uid()));

-- dev_features policies
DROP POLICY IF EXISTS "GF and GlobalAdmin can read dev_features" ON public.dev_features;
CREATE POLICY "GF and GlobalAdmin can read dev_features"
  ON public.dev_features FOR SELECT TO authenticated
  USING (is_geschaeftsfuehrer(auth.uid()) OR is_globaladmin(auth.uid()));

DROP POLICY IF EXISTS "GF and GlobalAdmin can insert dev_features" ON public.dev_features;
CREATE POLICY "GF and GlobalAdmin can insert dev_features"
  ON public.dev_features FOR INSERT TO authenticated
  WITH CHECK (is_geschaeftsfuehrer(auth.uid()) OR is_globaladmin(auth.uid()));

DROP POLICY IF EXISTS "GF and GlobalAdmin can update dev_features" ON public.dev_features;
CREATE POLICY "GF and GlobalAdmin can update dev_features"
  ON public.dev_features FOR UPDATE TO authenticated
  USING (is_geschaeftsfuehrer(auth.uid()) OR is_globaladmin(auth.uid()));

DROP POLICY IF EXISTS "GF and GlobalAdmin can delete dev_features" ON public.dev_features;
CREATE POLICY "GF and GlobalAdmin can delete dev_features"
  ON public.dev_features FOR DELETE TO authenticated
  USING (is_geschaeftsfuehrer(auth.uid()) OR is_globaladmin(auth.uid()));

-- dev_notes policies
DROP POLICY IF EXISTS "GF and GlobalAdmin can read dev_notes" ON public.dev_notes;
CREATE POLICY "GF and GlobalAdmin can read dev_notes"
  ON public.dev_notes FOR SELECT TO authenticated
  USING (is_geschaeftsfuehrer(auth.uid()) OR is_globaladmin(auth.uid()));

DROP POLICY IF EXISTS "GF and GlobalAdmin can insert dev_notes" ON public.dev_notes;
CREATE POLICY "GF and GlobalAdmin can insert dev_notes"
  ON public.dev_notes FOR INSERT TO authenticated
  WITH CHECK (is_geschaeftsfuehrer(auth.uid()) OR is_globaladmin(auth.uid()));

DROP POLICY IF EXISTS "GF and GlobalAdmin can delete dev_notes" ON public.dev_notes;
CREATE POLICY "GF and GlobalAdmin can delete dev_notes"
  ON public.dev_notes FOR DELETE TO authenticated
  USING (is_geschaeftsfuehrer(auth.uid()) OR is_globaladmin(auth.uid()));

-- Seed: Hauptmodule aus bestehendem System
INSERT INTO public.dev_modules (name, sort_order) VALUES
  ('Dienstplan & Terminplanung', 1),
  ('Kundenverwaltung', 2),
  ('Mitarbeiterverwaltung', 3),
  ('Dokumentenverwaltung', 4),
  ('Leistungsnachweise', 5),
  ('Abrechnung / Billing', 6),
  ('Benutzerverwaltung & Rollen', 7),
  ('Dashboard & Statistiken', 8),
  ('Mitarbeiter-Portal', 9),
  ('Sonstiges', 10);
