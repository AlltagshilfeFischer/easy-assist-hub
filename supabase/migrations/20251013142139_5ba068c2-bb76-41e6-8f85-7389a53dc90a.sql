-- Fix get_unactivated_users function to handle varchar type properly
CREATE OR REPLACE FUNCTION public.get_unactivated_users()
RETURNS TABLE(user_id uuid, user_email text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Prüfung: der aufrufende User muss Admin sein
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Nicht autorisiert';
  END IF;

  -- Gebe alle auth.users zurück, die NICHT in benutzer sind
  -- Expliziter Cast von email zu text, da auth.users.email varchar(255) ist
  RETURN QUERY
  SELECT 
    au.id as user_id,
    au.email::text as user_email,
    au.created_at
  FROM auth.users au
  WHERE NOT EXISTS (
    SELECT 1 FROM public.benutzer b WHERE b.id = au.id
  )
  ORDER BY au.created_at DESC;
END;
$function$;