-- Add vorname, nachname to pending_registrations
ALTER TABLE public.pending_registrations
ADD COLUMN IF NOT EXISTS vorname TEXT,
ADD COLUMN IF NOT EXISTS nachname TEXT;

-- Update trigger to use vorname/nachname from pending_registrations
-- and always provision benutzer, but mitarbeiter only if approved
CREATE OR REPLACE FUNCTION public.handle_new_user_provisioning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_registration RECORD;
BEGIN
  -- Hole Registrierungsdaten
  SELECT status, vorname, nachname 
  INTO v_registration
  FROM public.pending_registrations
  WHERE email = NEW.email;

  -- Erstelle benutzer Eintrag (immer, auch wenn nicht approved)
  IF NOT EXISTS (SELECT 1 FROM public.benutzer b WHERE b.id = NEW.id) THEN
    INSERT INTO public.benutzer (id, email, vorname, nachname, rolle)
    VALUES (
      NEW.id, 
      NEW.email::citext, 
      COALESCE(v_registration.vorname, ''), 
      COALESCE(v_registration.nachname, ''), 
      'mitarbeiter'::user_rolle
    );
  END IF;

  -- Erstelle mitarbeiter Eintrag NUR wenn approved
  IF v_registration.status = 'approved' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.benutzer b WHERE b.id = NEW.id AND b.rolle = 'admin'::user_rolle
    ) THEN
      IF NOT EXISTS (SELECT 1 FROM public.mitarbeiter m WHERE m.benutzer_id = NEW.id) THEN
        INSERT INTO public.mitarbeiter (benutzer_id, email, ist_aktiv)
        VALUES (NEW.id, NEW.email::citext, TRUE);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;