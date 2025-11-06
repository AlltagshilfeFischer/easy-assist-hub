-- Add kategorie and mitarbeiter_id columns to dokumente table
ALTER TABLE public.dokumente 
ADD COLUMN IF NOT EXISTS kategorie text NOT NULL DEFAULT 'kunde' CHECK (kategorie IN ('kunde', 'mitarbeiter', 'intern')),
ADD COLUMN IF NOT EXISTS mitarbeiter_id uuid REFERENCES public.mitarbeiter(id) ON DELETE CASCADE;

-- Add comment for clarity
COMMENT ON COLUMN public.dokumente.kategorie IS 'Dokumentkategorie: kunde (für Kunden), mitarbeiter (für Mitarbeiter), intern (für Geschäftsführung)';
COMMENT ON COLUMN public.dokumente.mitarbeiter_id IS 'Referenz auf Mitarbeiter, nur relevant wenn kategorie=mitarbeiter';

-- Make kunden_id nullable since not all documents are customer-related
ALTER TABLE public.dokumente 
ALTER COLUMN kunden_id DROP NOT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_dokumente_kategorie ON public.dokumente(kategorie);
CREATE INDEX IF NOT EXISTS idx_dokumente_mitarbeiter_id ON public.dokumente(mitarbeiter_id);