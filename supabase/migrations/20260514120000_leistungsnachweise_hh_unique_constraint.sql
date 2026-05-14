-- Haushaltshilfe §38: Separater Leistungsnachweis pro Kunde × Monat ermöglichen.
--
-- Vorher: UNIQUE(kunden_id, monat, jahr) → nur ein LN pro Monat möglich.
-- Nachher: UNIQUE(kunden_id, monat, jahr, cb_haushaltshilfe) → max. 2 LNs pro Monat:
--   cb_haushaltshilfe = false → reguläre Budgets (§45b / §39 / §45a)
--   cb_haushaltshilfe = true  → Haushaltshilfe §38 (Stundenkontingent, Krankenkasse)
--
-- Hintergrund: Wenn eine §38-Verordnung mitten im Monat endet, entstehen
-- zwei getrennte Abrechnungsperioden: Verordnungszeitraum (HH) + Restmonat (regulär).

ALTER TABLE public.leistungsnachweise
  DROP CONSTRAINT IF EXISTS leistungsnachweise_kunden_monat_jahr_unique;

ALTER TABLE public.leistungsnachweise
  ADD CONSTRAINT leistungsnachweise_kunden_monat_jahr_hh_unique
  UNIQUE (kunden_id, monat, jahr, cb_haushaltshilfe);
