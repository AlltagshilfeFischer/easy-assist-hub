-- Migration: Haushaltshilfe §38 Verordnungen
-- Stundenkontingent-basierte Verordnungen (kein Geldbudget)

CREATE TABLE haushaltshilfe_verordnungen (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kunden_id UUID NOT NULL REFERENCES kunden(id) ON DELETE CASCADE,
  gueltig_von DATE NOT NULL,
  gueltig_bis DATE NOT NULL,
  termine_pro_woche INTEGER NOT NULL DEFAULT 3,
  max_dauer_stunden NUMERIC(4,2) NOT NULL DEFAULT 2.0,
  notizen TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gueltig_von_vor_bis CHECK (gueltig_von <= gueltig_bis)
);

CREATE INDEX IF NOT EXISTS haushaltshilfe_verordnungen_kunden_id_idx
  ON haushaltshilfe_verordnungen(kunden_id);

CREATE INDEX IF NOT EXISTS haushaltshilfe_verordnungen_zeitraum_idx
  ON haushaltshilfe_verordnungen(gueltig_von, gueltig_bis);

ALTER TABLE haushaltshilfe_verordnungen ENABLE ROW LEVEL SECURITY;

-- Nur geschaeftsfuehrer und globaladmin können lesen
CREATE POLICY "GF und GlobalAdmin können haushaltshilfe_verordnungen lesen"
  ON haushaltshilfe_verordnungen FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('globaladmin', 'geschaeftsfuehrer', 'admin')
    )
  );

-- Nur geschaeftsfuehrer und globaladmin können schreiben
CREATE POLICY "GF und GlobalAdmin können haushaltshilfe_verordnungen einfügen"
  ON haushaltshilfe_verordnungen FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('globaladmin', 'geschaeftsfuehrer', 'admin')
    )
  );

CREATE POLICY "GF und GlobalAdmin können haushaltshilfe_verordnungen aktualisieren"
  ON haushaltshilfe_verordnungen FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('globaladmin', 'geschaeftsfuehrer', 'admin')
    )
  );

CREATE POLICY "GF und GlobalAdmin können haushaltshilfe_verordnungen löschen"
  ON haushaltshilfe_verordnungen FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('globaladmin', 'geschaeftsfuehrer', 'admin')
    )
  );
