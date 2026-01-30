-- ============================================
-- DDD-TRENNUNG: Kunde, Haushalt, Einsatzort
-- SCHRITT 1: Tabellen & Basis-Struktur
-- ============================================

-- 0. update_updated_at_column Funktion erstellen
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1. HAUSHALT (Household)
CREATE TABLE public.haushalte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  notfall_name TEXT,
  notfall_telefon TEXT,
  angehoerige_ansprechpartner TEXT,
  rechnungsempfaenger_name TEXT,
  rechnungsempfaenger_strasse TEXT,
  rechnungsempfaenger_plz TEXT,
  rechnungsempfaenger_stadt TEXT,
  sonstiges TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. EINSATZORT (Service Location)
CREATE TABLE public.einsatzorte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  haushalt_id UUID NOT NULL REFERENCES public.haushalte(id) ON DELETE CASCADE,
  bezeichnung TEXT DEFAULT 'Hauptwohnung',
  strasse TEXT,
  plz TEXT,
  stadt TEXT,
  stadtteil TEXT,
  zugangsinformationen TEXT,
  ist_haupteinsatzort BOOLEAN NOT NULL DEFAULT true,
  ist_aktiv BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. KUNDEN erweitern um haushalt_id
ALTER TABLE public.kunden 
  ADD COLUMN IF NOT EXISTS haushalt_id UUID REFERENCES public.haushalte(id);

-- 4. TERMINE erweitern um einsatzort_id
ALTER TABLE public.termine 
  ADD COLUMN IF NOT EXISTS einsatzort_id UUID REFERENCES public.einsatzorte(id);

-- 5. RLS aktivieren
ALTER TABLE public.haushalte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.einsatzorte ENABLE ROW LEVEL SECURITY;

-- 6. Admin Policies (ohne Referenz auf haushalt_id in kunden)
CREATE POLICY "Admins can manage haushalte" ON public.haushalte
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage einsatzorte" ON public.einsatzorte
  FOR ALL USING (is_admin(auth.uid()));

-- 7. Mitarbeiter Policies (vereinfacht - basierend auf termine)
CREATE POLICY "Mitarbeiter can read haushalte via termine" ON public.haushalte
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM termine t
      JOIN mitarbeiter m ON m.id = t.mitarbeiter_id
      JOIN kunden k ON k.id = t.kunden_id
      WHERE k.haushalt_id = haushalte.id
      AND m.benutzer_id = auth.uid()
    )
  );

CREATE POLICY "Mitarbeiter can read einsatzorte via termine" ON public.einsatzorte
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM termine t
      JOIN mitarbeiter m ON m.id = t.mitarbeiter_id
      WHERE t.einsatzort_id = einsatzorte.id
      AND m.benutzer_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM haushalte h
      JOIN kunden k ON k.haushalt_id = h.id
      JOIN termine t ON t.kunden_id = k.id
      JOIN mitarbeiter m ON m.id = t.mitarbeiter_id
      WHERE einsatzorte.haushalt_id = h.id
      AND m.benutzer_id = auth.uid()
    )
  );

-- 8. Trigger für updated_at
CREATE TRIGGER update_haushalte_updated_at
  BEFORE UPDATE ON public.haushalte
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_einsatzorte_updated_at
  BEFORE UPDATE ON public.einsatzorte
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Indizes
CREATE INDEX idx_einsatzorte_haushalt ON public.einsatzorte(haushalt_id);
CREATE INDEX idx_kunden_haushalt ON public.kunden(haushalt_id);
CREATE INDEX idx_termine_einsatzort ON public.termine(einsatzort_id);

-- 10. Dokumentation
COMMENT ON TABLE public.haushalte IS 'DDD: Haushalt-Aggregat - Kontext für Notfallkontakte und Rechnungsempfänger';
COMMENT ON TABLE public.einsatzorte IS 'DDD: Einsatzort-Entity - Physischer Ort der Leistungserbringung';
COMMENT ON COLUMN public.kunden.haushalt_id IS 'DDD: Referenz zum Haushalt-Aggregat';
COMMENT ON COLUMN public.termine.einsatzort_id IS 'DDD: Spezifischer Einsatzort für diesen Termin';