-- Add kategorie column to kunden table to distinguish between Interessent and Kunde
ALTER TABLE kunden 
ADD COLUMN kategorie TEXT DEFAULT 'Kunde' CHECK (kategorie IN ('Interessent', 'Kunde'));