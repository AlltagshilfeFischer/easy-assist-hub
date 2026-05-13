-- MwSt-Spalten für rechnungspositionen
-- batch-billing schreibt diese Felder bereits; bisher wurden sie vom DB-Schema ignoriert.
ALTER TABLE rechnungspositionen
  ADD COLUMN IF NOT EXISTS mwst_satz     NUMERIC(5,4)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mwst_betrag   NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brutto_betrag NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Bestehende Zeilen: 0% MwSt, brutto = netto
UPDATE rechnungspositionen
SET brutto_betrag = einzelbetrag
WHERE brutto_betrag = 0 AND einzelbetrag > 0;
