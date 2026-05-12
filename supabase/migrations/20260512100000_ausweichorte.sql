-- Tabelle für gespeicherte Ausweichorte (nicht Kundenwohnung)
CREATE TABLE public.ausweichorte (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  strasse    TEXT,
  plz        TEXT,
  stadt      TEXT,
  notizen    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.ausweichorte ENABLE ROW LEVEL SECURITY;

-- Alle authentifizierten Nutzer dürfen lesen
CREATE POLICY "ausweichorte_select"
  ON public.ausweichorte FOR SELECT TO authenticated
  USING (true);

-- Nur Admins/GF dürfen anlegen, ändern, löschen
CREATE POLICY "ausweichorte_insert"
  ON public.ausweichorte FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_secure(auth.uid()));

CREATE POLICY "ausweichorte_update"
  ON public.ausweichorte FOR UPDATE TO authenticated
  USING (public.is_admin_secure(auth.uid()))
  WITH CHECK (public.is_admin_secure(auth.uid()));

CREATE POLICY "ausweichorte_delete"
  ON public.ausweichorte FOR DELETE TO authenticated
  USING (public.is_admin_secure(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER set_ausweichorte_updated_at
  BEFORE UPDATE ON public.ausweichorte
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FK in termine
ALTER TABLE public.termine
  ADD COLUMN ausweichort_id UUID
  REFERENCES public.ausweichorte(id) ON DELETE SET NULL;

-- FK in termin_vorlagen
ALTER TABLE public.termin_vorlagen
  ADD COLUMN ausweichort_id UUID
  REFERENCES public.ausweichorte(id) ON DELETE SET NULL;
