-- Fix freischalte_mitarbeiter function to not reference email column in mitarbeiter table
CREATE OR REPLACE FUNCTION public.freischalte_mitarbeiter(
  p_user_id uuid, 
  p_email citext, 
  p_vorname text DEFAULT NULL::text, 
  p_nachname text DEFAULT NULL::text, 
  p_geburtsdatum date DEFAULT NULL::date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Prüfung: der aufrufende User muss Admin sein
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Nicht autorisiert';
  END IF;

  -- Insert in benutzer Tabelle mit allen Informationen
  INSERT INTO public.benutzer (id, email, rolle, vorname, nachname, geburtsdatum)
  VALUES (p_user_id, p_email, 'mitarbeiter', p_vorname, p_nachname, p_geburtsdatum)
  ON CONFLICT (id) DO UPDATE
  SET vorname = COALESCE(p_vorname, benutzer.vorname),
      nachname = COALESCE(p_nachname, benutzer.nachname),
      geburtsdatum = COALESCE(p_geburtsdatum, benutzer.geburtsdatum);
  
  -- Insert in mitarbeiter Tabelle nur mit benutzer_id Verknüpfung
  -- Email column no longer exists in mitarbeiter table
  INSERT INTO public.mitarbeiter (benutzer_id, vorname, nachname)
  VALUES (p_user_id, p_vorname, p_nachname)
  ON CONFLICT (benutzer_id) DO UPDATE
  SET vorname = COALESCE(p_vorname, mitarbeiter.vorname),
      nachname = COALESCE(p_nachname, mitarbeiter.nachname);
END;
$function$;