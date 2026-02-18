
-- Add billing/budget fields to kunden table
ALTER TABLE public.kunden
  ADD COLUMN IF NOT EXISTS verhinderungspflege_aktiv BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verhinderungspflege_beantragt BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verhinderungspflege_genehmigt BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verhinderungspflege_budget NUMERIC DEFAULT 3539,
  ADD COLUMN IF NOT EXISTS pflegesachleistung_aktiv BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pflegesachleistung_beantragt BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pflegesachleistung_genehmigt BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS budget_prioritaet TEXT[] DEFAULT '{}';
