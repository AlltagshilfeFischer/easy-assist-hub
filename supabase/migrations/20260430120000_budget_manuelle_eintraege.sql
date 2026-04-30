CREATE TABLE IF NOT EXISTS budget_manuelle_eintraege (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kunden_id UUID NOT NULL REFERENCES kunden(id) ON DELETE CASCADE,
  bezeichnung TEXT NOT NULL,
  betrag NUMERIC(10,2) NOT NULL CHECK (betrag > 0),
  verfaellt_am DATE NOT NULL,
  notizen TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE budget_manuelle_eintraege ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON budget_manuelle_eintraege
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
