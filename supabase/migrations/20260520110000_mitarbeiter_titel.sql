-- Akademischen Titel / Namenspräfix als optionales Feld hinzufügen
ALTER TABLE mitarbeiter ADD COLUMN IF NOT EXISTS titel TEXT NULL;
