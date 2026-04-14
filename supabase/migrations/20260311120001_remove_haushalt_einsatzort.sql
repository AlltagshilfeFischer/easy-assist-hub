-- Remove Haushalt/Einsatzort concept — not needed in this application

-- Drop audit trigger for haushalte before dropping the table
DROP TRIGGER IF EXISTS audit_haushalte ON public.haushalte;

-- Drop FK columns from dependent tables
ALTER TABLE public.termine DROP COLUMN IF EXISTS einsatzort_id CASCADE;
ALTER TABLE public.kunden DROP COLUMN IF EXISTS haushalt_id CASCADE;

-- Drop tables (einsatzorte first because it has FK → haushalte)
DROP TABLE IF EXISTS public.einsatzorte CASCADE;
DROP TABLE IF EXISTS public.haushalte CASCADE;
