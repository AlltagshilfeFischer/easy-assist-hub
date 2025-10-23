-- Make mitarbeiter_id nullable in termin_vorlagen table to allow unassigned appointments
ALTER TABLE termin_vorlagen 
ALTER COLUMN mitarbeiter_id DROP NOT NULL;