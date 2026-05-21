-- is_geschaeftsfuehrer() enthielt globaladmin nicht, obwohl globaladmin alle
-- Rechte eines Geschäftsführers haben soll. DELETE-Policies auf mehreren
-- Tabellen nutzen diese Funktion → globaladmin konnte nichts löschen.

CREATE OR REPLACE FUNCTION public.is_geschaeftsfuehrer(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('geschaeftsfuehrer'::app_role, 'globaladmin'::app_role)
  )
$$;
