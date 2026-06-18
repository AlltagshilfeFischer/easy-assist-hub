-- Beihilfeberechtigung für Beamte
-- Beihilfestelle zahlt einen prozentualen Anteil (30/50/70/80 %)
-- LN muss mehrfach ausgestellt werden: Kasse, Beihilfestelle, persönliche Unterlagen
ALTER TABLE kunden
  ADD COLUMN IF NOT EXISTS ist_beihilfeberechtigt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS beihilfe_anteil_prozent integer NULL
    CHECK (beihilfe_anteil_prozent IN (30, 50, 70, 80));
