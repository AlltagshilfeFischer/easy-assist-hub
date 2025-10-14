-- Remove the two admin registration entries from pending_registrations
-- These are admin accounts, not employee registration requests
DELETE FROM public.pending_registrations 
WHERE email IN ('luca@alltagshilfe-fischer.de', 'florian@alltagshilfe-fischer.de');