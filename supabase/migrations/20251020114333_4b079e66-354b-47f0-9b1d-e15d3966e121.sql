-- Korrigiere Admin-Einträge: benutzer.id muss mit auth.users.id übereinstimmen
-- Dies ist kritisch für die Authentifizierung

-- Admin 1: info@kitdienstleistungen.de
UPDATE public.benutzer 
SET id = 'a06907d1-04c5-435d-bc79-e3de6cd2fa7b'
WHERE email = 'info@kitdienstleistungen.de';

-- Admin 2: info@alltagshilfe-fischer.de (falls vorhanden, ID aus auth.users übernehmen)
UPDATE public.benutzer b
SET id = (SELECT id FROM auth.users WHERE email = 'info@alltagshilfe-fischer.de')
WHERE b.email = 'info@alltagshilfe-fischer.de' 
  AND EXISTS (SELECT 1 FROM auth.users WHERE email = 'info@alltagshilfe-fischer.de');