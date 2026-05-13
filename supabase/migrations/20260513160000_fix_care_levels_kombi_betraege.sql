-- Fix: Kombileistungsbeträge (kombi_max_40_prozent_monat) auf korrekte 40%-Werte setzen
-- Korrekte Werte laut Kunden-Bestätigung (40% der Pflegesachleistung):
--   PG 1: 0,00 € (keine Kombileistung)
--   PG 2: 318,40 € (40% von 796,00 €)
--   PG 3: 598,80 € (40% von 1.497,00 €)
--   PG 4: 743,60 € (40% von 1.859,00 €)
--   PG 5: 916,60 € (40% von 2.299,00 €)

UPDATE care_levels SET kombi_max_40_prozent_monat = 0     WHERE pflegegrad = 1;
UPDATE care_levels SET kombi_max_40_prozent_monat = 318.40 WHERE pflegegrad = 2;
UPDATE care_levels SET kombi_max_40_prozent_monat = 598.80 WHERE pflegegrad = 3;
UPDATE care_levels SET kombi_max_40_prozent_monat = 743.60 WHERE pflegegrad = 4;
UPDATE care_levels SET kombi_max_40_prozent_monat = 916.60 WHERE pflegegrad = 5;
