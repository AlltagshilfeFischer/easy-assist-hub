
-- 1. Notfallkontakte-Tabelle (unbegrenzt viele pro Kunde)
CREATE TABLE public.notfallkontakte (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kunden_id UUID NOT NULL REFERENCES public.kunden(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bezug TEXT, -- z.B. Sohn, Tochter, Nachbar, Betreuer
  telefon TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notfallkontakte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read notfallkontakte" ON public.notfallkontakte
  FOR SELECT USING (is_admin_or_higher(auth.uid()));

CREATE POLICY "Admins can insert notfallkontakte" ON public.notfallkontakte
  FOR INSERT WITH CHECK (is_admin_or_higher(auth.uid()));

CREATE POLICY "Admins can update notfallkontakte" ON public.notfallkontakte
  FOR UPDATE USING (is_admin_or_higher(auth.uid()));

CREATE POLICY "Only GF can delete notfallkontakte" ON public.notfallkontakte
  FOR DELETE USING (is_geschaeftsfuehrer(auth.uid()));

CREATE POLICY "Mitarbeiter can read assigned notfallkontakte" ON public.notfallkontakte
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM termine t
      JOIN mitarbeiter m ON m.id = t.mitarbeiter_id
      WHERE t.kunden_id = notfallkontakte.kunden_id AND m.benutzer_id = auth.uid()
    )
  );

-- 2. Neue Felder in kunden-Tabelle
ALTER TABLE public.kunden
  ADD COLUMN IF NOT EXISTS geschlecht TEXT,
  ADD COLUMN IF NOT EXISTS terminfrequenz TEXT,
  ADD COLUMN IF NOT EXISTS termindauer_stunden NUMERIC DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS kontaktweg TEXT,
  ADD COLUMN IF NOT EXISTS rechnungskopie TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rechnungskopie_adresse_name TEXT,
  ADD COLUMN IF NOT EXISTS rechnungskopie_adresse_strasse TEXT,
  ADD COLUMN IF NOT EXISTS rechnungskopie_adresse_plz TEXT,
  ADD COLUMN IF NOT EXISTS rechnungskopie_adresse_stadt TEXT,
  ADD COLUMN IF NOT EXISTS kunden_nummer SERIAL;

-- Index für schnelle Kundennummern-Suche
CREATE UNIQUE INDEX IF NOT EXISTS idx_kunden_nummer ON public.kunden(kunden_nummer);
