-- Fix: globaladmin benutzer korrekt mit auth.users verknüpfen
-- Problem: public.benutzer Eintrag fehlt, hat falsche UUID, falsche Rolle oder Status 'pending'
-- Lösung: Eintrag aus auth.users ableiten (korrekte UUID), rolle=globaladmin, status=approved

BEGIN;

-- 1) Globaladmin-Eintrag korrekt setzen (id aus auth.users, nicht hardcodiert)
INSERT INTO public.benutzer (id, email, rolle, status, vorname, nachname)
SELECT
  au.id,
  au.email,
  'globaladmin'::app_role,
  'approved'::benutzer_status,
  COALESCE(b.vorname, 'Admin'),
  COALESCE(b.nachname, 'AF Verwaltung')
FROM auth.users au
LEFT JOIN public.benutzer b ON b.email = au.email::citext
WHERE au.email = 'admin@af-verwaltung.de'
ON CONFLICT (id) DO UPDATE SET
  rolle   = 'globaladmin'::app_role,
  status  = 'approved'::benutzer_status,
  email   = EXCLUDED.email;

-- 2) Falls ein verwaister Eintrag mit alter hardcodierter UUID und gleicher E-Mail noch existiert,
--    wird er durch den UNIQUE-Constraint auf email (CITEXT) verhindert; sicherheitshalber entfernen.
DELETE FROM public.benutzer
WHERE email = 'admin@af-verwaltung.de'
  AND id NOT IN (
    SELECT id FROM auth.users WHERE email = 'admin@af-verwaltung.de'
  );

-- 3) Alle weiteren auth.users die bereits einen public.benutzer-Eintrag haben
--    aber noch 'pending' sind → auf 'approved' setzen
UPDATE public.benutzer b
SET status = 'approved'::benutzer_status
FROM auth.users au
WHERE au.id = b.id
  AND b.status = 'pending';

COMMIT;
