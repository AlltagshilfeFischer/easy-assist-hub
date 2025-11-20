-- Step 1: Add vorname and nachname columns to kunden table
ALTER TABLE public.kunden 
ADD COLUMN vorname TEXT,
ADD COLUMN nachname TEXT;

-- Step 2: Try to intelligently split existing name data
-- This splits on the first space, putting everything before in vorname and everything after in nachname
UPDATE public.kunden
SET 
  vorname = CASE 
    WHEN position(' ' in name) > 0 THEN split_part(name, ' ', 1)
    ELSE name
  END,
  nachname = CASE 
    WHEN position(' ' in name) > 0 THEN substring(name from position(' ' in name) + 1)
    ELSE ''
  END
WHERE name IS NOT NULL;

-- Step 3: Create a generated column for backward compatibility (concatenates vorname and nachname)
-- First drop the existing name column
ALTER TABLE public.kunden DROP COLUMN name;

-- Add it back as a generated column
ALTER TABLE public.kunden 
ADD COLUMN name TEXT GENERATED ALWAYS AS (
  CASE 
    WHEN vorname IS NOT NULL AND nachname IS NOT NULL AND nachname != '' THEN vorname || ' ' || nachname
    WHEN vorname IS NOT NULL THEN vorname
    WHEN nachname IS NOT NULL THEN nachname
    ELSE ''
  END
) STORED;

-- Step 4: Add comment for documentation
COMMENT ON COLUMN public.kunden.name IS 'Auto-generated from vorname and nachname for backward compatibility';
COMMENT ON COLUMN public.kunden.vorname IS 'Customer first name';
COMMENT ON COLUMN public.kunden.nachname IS 'Customer last name';