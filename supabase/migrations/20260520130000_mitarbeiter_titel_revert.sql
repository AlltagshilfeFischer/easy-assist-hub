-- Titel-Feld gehört nur zu Kunden, nicht zu Mitarbeitern — Spalte entfernen
ALTER TABLE mitarbeiter DROP COLUMN IF EXISTS titel;
