-- Insert dummy customers
INSERT INTO public.kunden (vorname, nachname, email, telefon) VALUES
('Max', 'Mustermann', 'max.mustermann@email.com', '0123 456789'),
('Anna', 'Schmidt', 'anna.schmidt@email.com', '0123 456790'),
('Peter', 'Weber', 'peter.weber@email.com', '0123 456791'),
('Lisa', 'Meyer', 'lisa.meyer@email.com', '0123 456792'),
('Thomas', 'Müller', 'thomas.mueller@email.com', '0123 456793');

-- Insert dummy employees
INSERT INTO public.mitarbeiter (vorname, nachname, email, telefon, farbe_kalender, soll_wochenstunden, max_termine_pro_tag) VALUES
('Sarah', 'Johnson', 'sarah.johnson@company.com', '0123 111111', '#3B82F6', 40, 8),
('Michael', 'Brown', 'michael.brown@company.com', '0123 222222', '#10B981', 35, 6),
('Jennifer', 'Davis', 'jennifer.davis@company.com', '0123 333333', '#F59E0B', 30, 5),
('David', 'Wilson', 'david.wilson@company.com', '0123 444444', '#EF4444', 40, 7),
('Emma', 'Garcia', 'emma.garcia@company.com', '0123 555555', '#8B5CF6', 32, 6);

-- Insert availability for employees (Mon-Fri 8:00-17:00)
INSERT INTO public.mitarbeiter_verfuegbarkeit (mitarbeiter_id, wochentag, von, bis)
SELECT 
  m.id,
  dow,
  '08:00'::time,
  CASE 
    WHEN row_number() OVER (PARTITION BY m.id ORDER BY dow) = 1 THEN '17:00'::time
    WHEN row_number() OVER (PARTITION BY m.id ORDER BY dow) = 2 THEN '16:00'::time
    WHEN row_number() OVER (PARTITION BY m.id ORDER BY dow) = 3 THEN '15:00'::time
    WHEN row_number() OVER (PARTITION BY m.id ORDER BY dow) = 4 THEN '17:00'::time
    ELSE '16:30'::time
  END
FROM public.mitarbeiter m
CROSS JOIN generate_series(1, 5) as dow;

-- Insert unassigned appointments for next week
INSERT INTO public.termine (titel, kunden_id, start_at, end_at, status)
SELECT 
  'Beratungstermin für ' || vorname || ' ' || nachname,
  id,
  date_trunc('week', CURRENT_DATE) + INTERVAL '7 days' + (row_number() OVER () - 1) * INTERVAL '1 day' + INTERVAL '9 hours',
  date_trunc('week', CURRENT_DATE) + INTERVAL '7 days' + (row_number() OVER () - 1) * INTERVAL '1 day' + INTERVAL '10 hours',
  'unassigned'
FROM public.kunden
ORDER BY created_at
LIMIT 5;

-- Insert more unassigned appointments
INSERT INTO public.termine (titel, kunden_id, start_at, end_at, status)
SELECT 
  'Nachfolgetermin ' || vorname || ' ' || nachname,
  id,
  date_trunc('week', CURRENT_DATE) + INTERVAL '7 days' + (row_number() OVER () - 1) * INTERVAL '1 day' + INTERVAL '14 hours',
  date_trunc('week', CURRENT_DATE) + INTERVAL '7 days' + (row_number() OVER () - 1) * INTERVAL '1 day' + INTERVAL '15 hours',
  'unassigned'
FROM public.kunden
ORDER BY created_at
LIMIT 3;

-- Insert current week appointments (some unassigned)
INSERT INTO public.termine (titel, kunden_id, start_at, end_at, status)
SELECT 
  'Aktueller Termin ' || vorname || ' ' || nachname,
  id,
  date_trunc('week', CURRENT_DATE) + (row_number() OVER () - 1) * INTERVAL '1 day' + INTERVAL '10 hours',
  date_trunc('week', CURRENT_DATE) + (row_number() OVER () - 1) * INTERVAL '1 day' + INTERVAL '11 hours',
  'unassigned'
FROM public.kunden
ORDER BY created_at
LIMIT 4;