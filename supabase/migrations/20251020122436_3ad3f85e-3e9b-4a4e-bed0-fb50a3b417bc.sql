-- Lösche alle bearbeiteten Benutzer (approved/rejected) aus der benutzer Tabelle
-- Dies setzt die Verlauf-Liste zurück

DELETE FROM public.benutzer 
WHERE status IN ('approved', 'rejected');