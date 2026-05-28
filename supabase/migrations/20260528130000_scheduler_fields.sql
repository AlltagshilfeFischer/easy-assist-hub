-- Scheduler-Felder für Aplano→Kitech Migration

-- 1. mitarbeiter.in_scheduling_pool
--    true = MA erscheint in Vorschlägen (Pool-MA)
--    false = MA wird nur als GF-Fallback vorgeschlagen
ALTER TABLE mitarbeiter
  ADD COLUMN IF NOT EXISTS in_scheduling_pool BOOLEAN NOT NULL DEFAULT true;

-- 2. kunden.zone_farbe
--    Hex-Farbe für das 26-Zonen-System des Aplano-Schedulers
--    Default: '#aad1ff' = "Sonstige / Intern" Zone
ALTER TABLE kunden
  ADD COLUMN IF NOT EXISTS zone_farbe TEXT NOT NULL DEFAULT '#aad1ff';

-- RLS: Keine neuen Policies nötig, Felder sind Teil bestehender Tabellen
-- und erben bestehende RLS-Policies.
