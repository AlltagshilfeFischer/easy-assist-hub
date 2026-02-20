-- Add 'eingeladen' status to benutzer_status enum
ALTER TYPE public.benutzer_status ADD VALUE IF NOT EXISTS 'eingeladen' AFTER 'pending';