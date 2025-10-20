-- Ensure service_role has required privileges to perform upserts/updates from Edge Functions
GRANT USAGE ON SCHEMA public TO service_role;

-- benutzer table privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.benutzer TO service_role;

-- mitarbeiter table privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mitarbeiter TO service_role;

-- pending_registrations privileges (updates from approve/reject functions)
GRANT SELECT, UPDATE ON TABLE public.pending_registrations TO service_role;

-- Allow service_role to call required SECURITY DEFINER functions
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_pending_registration(uuid) TO service_role;