-- Rename column kopie_lw_vorhanden to kopie_lw in kunden table
ALTER TABLE public.kunden 
RENAME COLUMN kopie_lw_vorhanden TO kopie_lw;