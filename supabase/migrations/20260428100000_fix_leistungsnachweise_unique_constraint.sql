-- Leistungsnachweise: fehlenden UNIQUE Constraint nachrüsten.
-- Hintergrund: CREATE TABLE IF NOT EXISTS in 20260211073539 wurde übersprungen,
-- weil die Tabelle bereits durch base_schema existierte. Damit fehlt der
-- Unique-Constraint den der Upsert (onConflict: kunden_id,monat,jahr) benötigt.

ALTER TABLE public.leistungsnachweise
  ADD CONSTRAINT IF NOT EXISTS leistungsnachweise_kunden_monat_jahr_unique
  UNIQUE (kunden_id, monat, jahr);
