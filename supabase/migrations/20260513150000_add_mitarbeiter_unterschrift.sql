-- Separate Mitarbeiter-Unterschrift-Felder für Leistungsnachweise
-- Bisher wurde die Mitarbeiter-Unterschrift fälschlicherweise als Kunden-Unterschrift gespeichert.
ALTER TABLE leistungsnachweise
  ADD COLUMN IF NOT EXISTS unterschrift_mitarbeiter_bild TEXT,
  ADD COLUMN IF NOT EXISTS unterschrift_mitarbeiter_zeitstempel TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unterschrift_mitarbeiter_durch TEXT;
