-- updated_at Trigger für haushaltshilfe_verordnungen
-- update_updated_at_column() Funktion existiert bereits (oder wird hier erstellt)

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER haushaltshilfe_verordnungen_updated_at
  BEFORE UPDATE ON haushaltshilfe_verordnungen
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
