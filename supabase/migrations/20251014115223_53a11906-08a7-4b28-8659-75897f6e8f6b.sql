-- Remove unnecessary fields from benutzer table (password now handled by Supabase Auth)
ALTER TABLE public.benutzer DROP COLUMN IF EXISTS passwort_hash;

-- Remove redundant email field from mitarbeiter table (available via benutzer_id -> benutzer.email)
ALTER TABLE public.mitarbeiter DROP COLUMN IF EXISTS email;

-- Add comment to document the relationship
COMMENT ON COLUMN public.mitarbeiter.benutzer_id IS 'References benutzer.id to get user data including email from benutzer table';