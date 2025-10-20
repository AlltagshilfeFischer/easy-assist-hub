-- Stelle den Admin-Benutzer wieder her
-- Der Admin wurde versehentlich durch die vorherige Migration gelöscht

INSERT INTO public.benutzer (id, email, rolle, status, vorname, nachname)
VALUES (
  'a06907d1-04c5-435d-bc79-e3de6cd2fa7b',
  'info@kitdienstleistungen.de',
  'admin',
  'approved',
  'Admin',
  'User'
)
ON CONFLICT (id) DO UPDATE
SET rolle = 'admin',
    status = 'approved';