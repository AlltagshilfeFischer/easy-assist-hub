-- Extend termin_status enum with two new values
ALTER TYPE public.termin_status ADD VALUE IF NOT EXISTS 'nicht_angetroffen';
ALTER TYPE public.termin_status ADD VALUE IF NOT EXISTS 'abgesagt_rechtzeitig';