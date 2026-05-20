-- Akademischen Titel / Namenspräfix für Kunden als optionales Feld hinzufügen
ALTER TABLE kunden ADD COLUMN IF NOT EXISTS titel TEXT NULL;
