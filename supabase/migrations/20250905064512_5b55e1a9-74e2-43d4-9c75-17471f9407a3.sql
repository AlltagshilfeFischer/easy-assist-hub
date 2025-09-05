-- Insert dummy employees
INSERT INTO public.mitarbeiter (id, vorname, nachname, email, telefon, ist_aktiv, max_termine_pro_tag, soll_wochenstunden) VALUES
('11111111-1111-1111-1111-111111111111', 'Anna', 'Schmidt', 'anna.schmidt@example.com', '+49 170 1234567', true, 8, 40),
('22222222-2222-2222-2222-222222222222', 'Thomas', 'Müller', 'thomas.mueller@example.com', '+49 170 2345678', true, 6, 32),
('33333333-3333-3333-3333-333333333333', 'Sarah', 'Weber', 'sarah.weber@example.com', '+49 170 3456789', true, 7, 38);

-- Insert dummy customers
INSERT INTO public.kunden (id, vorname, nachname, email, telefon, notfall_name, notfall_telefon, aktiv) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Maria', 'Fischer', 'maria.fischer@example.com', '+49 171 1111111', 'Hans Fischer', '+49 171 2222222', true),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Klaus', 'Bauer', 'klaus.bauer@example.com', '+49 171 3333333', 'Ingrid Bauer', '+49 171 4444444', true),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Petra', 'Schneider', 'petra.schneider@example.com', '+49 171 5555555', 'Michael Schneider', '+49 171 6666666', true),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Hans', 'Wagner', 'hans.wagner@example.com', '+49 171 7777777', 'Elisabeth Wagner', '+49 171 8888888', true),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Gisela', 'Koch', 'gisela.koch@example.com', '+49 171 9999999', 'Franz Koch', '+49 171 1010101', true);

-- Insert employee availability (Monday to Friday for all employees)
INSERT INTO public.mitarbeiter_verfuegbarkeit (mitarbeiter_id, wochentag, von, bis) VALUES
-- Anna Schmidt (Mo-Fr 8:00-16:00)
('11111111-1111-1111-1111-111111111111', 1, '08:00', '16:00'),
('11111111-1111-1111-1111-111111111111', 2, '08:00', '16:00'),
('11111111-1111-1111-1111-111111111111', 3, '08:00', '16:00'),
('11111111-1111-1111-1111-111111111111', 4, '08:00', '16:00'),
('11111111-1111-1111-1111-111111111111', 5, '08:00', '16:00'),
-- Thomas Müller (Mo-Fr 9:00-17:00)
('22222222-2222-2222-2222-222222222222', 1, '09:00', '17:00'),
('22222222-2222-2222-2222-222222222222', 2, '09:00', '17:00'),
('22222222-2222-2222-2222-222222222222', 3, '09:00', '17:00'),
('22222222-2222-2222-2222-222222222222', 4, '09:00', '17:00'),
('22222222-2222-2222-2222-222222222222', 5, '09:00', '17:00'),
-- Sarah Weber (Mo-Fr 7:30-15:30)
('33333333-3333-3333-3333-333333333333', 1, '07:30', '15:30'),
('33333333-3333-3333-3333-333333333333', 2, '07:30', '15:30'),
('33333333-3333-3333-3333-333333333333', 3, '07:30', '15:30'),
('33333333-3333-3333-3333-333333333333', 4, '07:30', '15:30'),
('33333333-3333-3333-3333-333333333333', 5, '07:30', '15:30');

-- Insert customer time preferences
INSERT INTO public.kunden_zeitfenster (kunden_id, wochentag, von, bis, prioritaet) VALUES
-- Maria Fischer prefers mornings Mon-Wed
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, '08:00', '12:00', 1),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, '08:00', '12:00', 1),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3, '08:00', '12:00', 1),
-- Klaus Bauer prefers afternoons Tue-Thu
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2, '13:00', '17:00', 1),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 3, '13:00', '17:00', 1),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 4, '13:00', '17:00', 1),
-- Petra Schneider flexible Mon-Fri
('cccccccc-cccc-cccc-cccc-cccccccccccc', 1, '09:00', '16:00', 2),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 2, '09:00', '16:00', 2),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 3, '09:00', '16:00', 2),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 4, '09:00', '16:00', 2),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 5, '09:00', '16:00', 2);

-- Insert appointment templates
INSERT INTO public.termin_vorlagen (id, titel, kunden_id, mitarbeiter_id, wochentag, start_zeit, dauer_minuten, intervall, gueltig_von, gueltig_bis, ist_aktiv) VALUES
-- Maria Fischer with Anna Schmidt every Monday at 10:00
('t1111111-1111-1111-1111-111111111111', 'Physiotherapie Standardtermin', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 1, '10:00', 60, 'weekly', CURRENT_DATE, NULL, true),
-- Klaus Bauer with Thomas Müller every Tuesday at 14:00
('t2222222-2222-2222-2222-222222222222', 'Massage Therapie', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 2, '14:00', 90, 'weekly', CURRENT_DATE, NULL, true),
-- Petra Schneider with Sarah Weber every Wednesday at 11:00
('t3333333-3333-3333-3333-333333333333', 'Rehabilitation Training', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 3, '11:00', 75, 'weekly', CURRENT_DATE, NULL, true),
-- Hans Wagner with Anna Schmidt every other Friday at 09:00
('t4444444-4444-4444-4444-444444444444', 'Kontrolltermin', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 5, '09:00', 45, 'biweekly', CURRENT_DATE, NULL, true),
-- Gisela Koch with Thomas Müller monthly first Thursday at 15:00
('t5555555-5555-5555-5555-555555555555', 'Monatliche Beratung', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 4, '15:00', 120, 'monthly', CURRENT_DATE, NULL, true);

-- Generate some actual appointments from templates for the next 4 weeks
SELECT generate_termine_from_vorlagen(CURRENT_DATE, CURRENT_DATE + INTERVAL '28 days');