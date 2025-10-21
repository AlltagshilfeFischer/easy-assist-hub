-- Add zustaendigkeitsbereich column to mitarbeiter table
ALTER TABLE public.mitarbeiter 
ADD COLUMN zustaendigkeitsbereich text;

COMMENT ON COLUMN public.mitarbeiter.zustaendigkeitsbereich IS 'Geographical area of responsibility for the employee (e.g., "Hannover Nord", "Linden", etc.)';

-- Add adresse column to mitarbeiter table for proximity matching
ALTER TABLE public.mitarbeiter 
ADD COLUMN adresse text;

COMMENT ON COLUMN public.mitarbeiter.adresse IS 'Full address of the employee for proximity calculations';