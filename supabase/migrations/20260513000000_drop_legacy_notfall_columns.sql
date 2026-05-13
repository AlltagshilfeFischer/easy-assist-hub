-- Drop legacy emergency contact columns (superseded by notfallkontakte table)
ALTER TABLE kunden DROP COLUMN IF EXISTS notfall_name;
ALTER TABLE kunden DROP COLUMN IF EXISTS notfall_telefon;
