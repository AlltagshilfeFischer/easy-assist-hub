-- Extend termin_status enum with billing states per Master-Prompt
-- State machine: unassigned → scheduled → in_progress → completed → abgerechnet → bezahlt (or cancelled)

-- Add 'abgerechnet' (billed) status
ALTER TYPE public.termin_status ADD VALUE IF NOT EXISTS 'abgerechnet';

-- Add 'bezahlt' (paid) status  
ALTER TYPE public.termin_status ADD VALUE IF NOT EXISTS 'bezahlt';

-- Add comment documenting the full state machine
COMMENT ON TYPE public.termin_status IS 'Termin lifecycle: unassigned → scheduled → in_progress → completed → abgerechnet → bezahlt | cancelled at any point';