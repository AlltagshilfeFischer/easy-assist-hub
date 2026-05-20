-- Nebenbeschäftigung: Stundenlohn + RV-Pflicht für Minijobber
ALTER TABLE mitarbeiter_nebenbeschaeftigung
  ADD COLUMN IF NOT EXISTS gehalt_pro_stunde numeric(10,2),
  ADD COLUMN IF NOT EXISTS rv_pflicht boolean;
