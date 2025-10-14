-- Erweitere freischalte_mitarbeiter um automatische Mitarbeiter-Erstellung
CREATE OR REPLACE FUNCTION public.freischalte_mitarbeiter(p_user_id uuid, p_email citext)
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

  -- Insert in benutzer Tabelle
  INSERT INTO public.benutzer (id, email, rolle)
  VALUES (p_user_id, p_email, 'mitarbeiter')
  ON CONFLICT (id) DO NOTHING;
  
  -- Insert in mitarbeiter Tabelle mit Verknüpfung zu benutzer_id
  INSERT INTO public.mitarbeiter (benutzer_id, email)
  VALUES (p_user_id, p_email)
  ON CONFLICT (benutzer_id) DO NOTHING;
END;
$function$;