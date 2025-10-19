-- Add fields to termine table for recurring appointment support
ALTER TABLE public.termine 
ADD COLUMN vorlage_id uuid REFERENCES public.termin_vorlagen(id) ON DELETE SET NULL,
ADD COLUMN ist_ausnahme boolean DEFAULT false,
ADD COLUMN ausnahme_grund text;

-- Create index for faster lookups
CREATE INDEX idx_termine_vorlage_id ON public.termine(vorlage_id) WHERE vorlage_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.termine.vorlage_id IS 'Reference to the template if this appointment was generated from a recurring template';
COMMENT ON COLUMN public.termine.ist_ausnahme IS 'True if this appointment was manually modified from its template';
COMMENT ON COLUMN public.termine.ausnahme_grund IS 'Reason why this appointment differs from its template (e.g., time changed, employee changed)';