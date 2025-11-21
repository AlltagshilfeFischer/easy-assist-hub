-- Split adresse field into strasse, stadt, plz for mitarbeiter table
ALTER TABLE public.mitarbeiter 
  ADD COLUMN strasse TEXT,
  ADD COLUMN stadt TEXT,
  ADD COLUMN plz TEXT;

-- Migrate existing data if possible (simple split by comma)
UPDATE public.mitarbeiter 
SET strasse = adresse 
WHERE adresse IS NOT NULL;

-- Keep old adresse column for now for data safety
-- ALTER TABLE public.mitarbeiter DROP COLUMN adresse;

-- Split adresse field into strasse, stadt, plz for kunden table
ALTER TABLE public.kunden 
  ADD COLUMN strasse TEXT,
  ADD COLUMN stadt TEXT,
  ADD COLUMN plz TEXT;

-- Migrate existing data if possible
UPDATE public.kunden 
SET strasse = adresse 
WHERE adresse IS NOT NULL;

-- Keep old adresse column for now for data safety
-- ALTER TABLE public.kunden DROP COLUMN adresse;