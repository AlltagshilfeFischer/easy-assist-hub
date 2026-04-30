-- Pflegesachleistungs-Budget (§ 45a SGB XI) als gespeicherter Monatsbetrag
-- 40 % des Sachleistungsbetrags je Pflegegrad (PG2: 304€, PG3: 573€, PG4: 711€, PG5: 880€)
ALTER TABLE public.kunden
  ADD COLUMN IF NOT EXISTS pflegesachleistung_budget FLOAT8;

COMMENT ON COLUMN public.kunden.pflegesachleistung_budget
  IS 'Genehmigter monatlicher Sachleistungsbetrag (40% gem. §45a SGB XI)';
