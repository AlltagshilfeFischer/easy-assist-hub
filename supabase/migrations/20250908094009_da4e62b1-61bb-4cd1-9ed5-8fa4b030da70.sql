-- Insert dummy users (Benutzer) with correct enum values
INSERT INTO public.benutzer (id, email, rolle, vorname, nachname, passwort_hash) VALUES
('11111111-1111-1111-1111-111111111111', 'admin@example.com', 'admin', 'Max', 'Mustermann', 'dummy_hash'),
('22222222-2222-2222-2222-222222222222', 'manager@example.com', 'manager', 'Anna', 'Schmidt', 'dummy_hash'),
('33333333-3333-3333-3333-333333333333', 'mitarbeiter@example.com', 'mitarbeiter', 'Thomas', 'Weber', 'dummy_hash');

-- Insert dummy customers (Kunden)
INSERT INTO public.kunden (id, vorname, nachname, email, telefon, notfall_name, notfall_telefon, aktiv) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Maria', 'Müller', 'maria.mueller@email.com', '+49 123 456789', 'Peter Müller', '+49 987 654321', true),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Hans', 'Schneider', 'hans.schneider@email.com', '+49 234 567890', 'Petra Schneider', '+49 876 543210', true),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Lisa', 'Fischer', 'lisa.fischer@email.com', '+49 345 678901', 'Michael Fischer', '+49 765 432109', true),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Klaus', 'Wagner', 'klaus.wagner@email.com', '+49 456 789012', 'Sabine Wagner', '+49 654 321098', true),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Emma', 'Bauer', 'emma.bauer@email.com', '+49 567 890123', 'Stefan Bauer', '+49 543 210987', true);

-- Insert dummy employees (Mitarbeiter)
INSERT INTO public.mitarbeiter (id, vorname, nachname, email, telefon, ist_aktiv, soll_wochenstunden, max_termine_pro_tag, farbe_kalender, benutzer_id) VALUES
('44444444-4444-4444-4444-444444444444', 'Sarah', 'Klein', 'sarah.klein@company.com', '+49 111 222333', true, 40.0, 8, '#3B82F6', '22222222-2222-2222-2222-222222222222'),
('55555555-5555-5555-5555-555555555555', 'Michael', 'Hoffmann', 'michael.hoffmann@company.com', '+49 222 333444', true, 35.0, 6, '#10B981', '33333333-3333-3333-3333-333333333333'),
('66666666-6666-6666-6666-666666666666', 'Julia', 'Richter', 'julia.richter@company.com', '+49 333 444555', true, 40.0, 7, '#F59E0B', null),
('77777777-7777-7777-7777-777777777777', 'Daniel', 'Koch', 'daniel.koch@company.com', '+49 444 555666', true, 30.0, 5, '#EF4444', null),
('88888888-8888-8888-8888-888888888888', 'Sandra', 'Zimmermann', 'sandra.zimmermann@company.com', '+49 555 666777', false, 40.0, 8, '#8B5CF6', null);

-- Insert employee availability (Mitarbeiter Verfügbarkeit)
INSERT INTO public.mitarbeiter_verfuegbarkeit (mitarbeiter_id, wochentag, von, bis) VALUES
-- Sarah Klein (Mo-Fr 8-17)
('44444444-4444-4444-4444-444444444444', 1, '08:00', '17:00'),
('44444444-4444-4444-4444-444444444444', 2, '08:00', '17:00'),
('44444444-4444-4444-4444-444444444444', 3, '08:00', '17:00'),
('44444444-4444-4444-4444-444444444444', 4, '08:00', '17:00'),
('44444444-4444-4444-4444-444444444444', 5, '08:00', '17:00'),
-- Michael Hoffmann (Mo-Do 9-16)
('55555555-5555-5555-5555-555555555555', 1, '09:00', '16:00'),
('55555555-5555-5555-5555-555555555555', 2, '09:00', '16:00'),
('55555555-5555-5555-5555-555555555555', 3, '09:00', '16:00'),
('55555555-5555-5555-5555-555555555555', 4, '09:00', '16:00'),
-- Julia Richter (Mo-Fr 7-15)
('66666666-6666-6666-6666-666666666666', 1, '07:00', '15:00'),
('66666666-6666-6666-6666-666666666666', 2, '07:00', '15:00'),
('66666666-6666-6666-6666-666666666666', 3, '07:00', '15:00'),
('66666666-6666-6666-6666-666666666666', 4, '07:00', '15:00'),
('66666666-6666-6666-6666-666666666666', 5, '07:00', '15:00'),
-- Daniel Koch (Di-Fr 10-18)
('77777777-7777-7777-7777-777777777777', 2, '10:00', '18:00'),
('77777777-7777-7777-7777-777777777777', 3, '10:00', '18:00'),
('77777777-7777-7777-7777-777777777777', 4, '10:00', '18:00'),
('77777777-7777-7777-7777-777777777777', 5, '10:00', '18:00');

-- Insert customer time preferences (Kunden Zeitfenster)
INSERT INTO public.kunden_zeitfenster (kunden_id, wochentag, von, bis, prioritaet) VALUES
-- Maria Müller prefers mornings
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, '08:00', '12:00', 1),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3, '08:00', '12:00', 1),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 5, '08:00', '12:00', 1),
-- Hans Schneider prefers afternoons
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2, '14:00', '18:00', 2),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 4, '14:00', '18:00', 2),
-- Lisa Fischer flexible
('cccccccc-cccc-cccc-cccc-cccccccccccc', 1, '09:00', '17:00', 3),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 2, '09:00', '17:00', 3),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 3, '09:00', '17:00', 3);

-- Insert some appointments (Termine)
INSERT INTO public.termine (id, titel, kunden_id, mitarbeiter_id, start_at, end_at, status) VALUES
('f1111111-1111-1111-1111-111111111111', 'Hausbesuch Maria Müller', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', '2025-01-13 09:00:00+00', '2025-01-13 10:30:00+00', 'confirmed'),
('f2222222-2222-2222-2222-222222222222', 'Beratung Hans Schneider', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', '2025-01-14 15:00:00+00', '2025-01-14 16:00:00+00', 'scheduled'),
('f3333333-3333-3333-3333-333333333333', 'Kontrolle Lisa Fischer', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '66666666-6666-6666-6666-666666666666', '2025-01-15 11:00:00+00', '2025-01-15 12:00:00+00', 'scheduled'),
('f4444444-4444-4444-4444-444444444444', 'Notfall Klaus Wagner', 'dddddddd-dddd-dddd-dddd-dddddddddddd', null, '2025-01-16 14:00:00+00', '2025-01-16 15:30:00+00', 'unassigned'),
('f5555555-5555-5555-5555-555555555555', 'Emma Bauer Termin', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '77777777-7777-7777-7777-777777777777', '2025-01-17 11:00:00+00', '2025-01-17 12:30:00+00', 'scheduled');

-- Insert appointment templates (Termin Vorlagen)
INSERT INTO public.termin_vorlagen (id, titel, kunden_id, mitarbeiter_id, wochentag, start_zeit, dauer_minuten, intervall, gueltig_von, gueltig_bis, ist_aktiv) VALUES
('t1111111-1111-1111-1111-111111111111', 'Wöchentliche Betreuung Maria', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 1, '09:00', 90, 'weekly', '2025-01-01', '2025-12-31', true),
('t2222222-2222-2222-2222-222222222222', '14-tägige Kontrolle Hans', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 2, '15:00', 60, 'biweekly', '2025-01-01', '2025-12-31', true),
('t3333333-3333-3333-3333-333333333333', 'Monatlicher Check Lisa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '66666666-6666-6666-6666-666666666666', 3, '11:00', 60, 'monthly', '2025-01-01', '2025-12-31', true);

-- Insert some appointment change requests (Termin Änderungen)
INSERT INTO public.termin_aenderungen (id, termin_id, requested_by, old_start_at, old_end_at, old_mitarbeiter_id, old_kunden_id, new_start_at, new_end_at, new_mitarbeiter_id, new_kunden_id, reason, status) VALUES
('c1111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '2025-01-13 09:00:00+00', '2025-01-13 10:30:00+00', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-13 10:00:00+00', '2025-01-13 11:30:00+00', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Kunde hat um Verschiebung gebeten', 'pending'),
('c2222222-2222-2222-2222-222222222222', 'f2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '2025-01-14 15:00:00+00', '2025-01-14 16:00:00+00', '55555555-5555-5555-5555-555555555555', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2025-01-14 15:00:00+00', '2025-01-14 16:00:00+00', '66666666-6666-6666-6666-666666666666', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Mitarbeiter wechsel erforderlich', 'pending');