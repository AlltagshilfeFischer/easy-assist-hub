
-- Fix admin user ID mismatch between auth.users and benutzer table
-- Delete incorrect entry
DELETE FROM public.benutzer WHERE email = 'admin@af-verwaltung.de';

-- Insert correct entry with matching auth.users ID
INSERT INTO public.benutzer (id, email, rolle, vorname, nachname)
VALUES ('14f3dde0-e2ae-4259-b0e5-0149042e2717', 'admin@af-verwaltung.de', 'admin', 'Admin', 'AF Verwaltung')
ON CONFLICT (id) DO UPDATE 
SET rolle = 'admin', 
    email = 'admin@af-verwaltung.de',
    vorname = 'Admin',
    nachname = 'AF Verwaltung';
