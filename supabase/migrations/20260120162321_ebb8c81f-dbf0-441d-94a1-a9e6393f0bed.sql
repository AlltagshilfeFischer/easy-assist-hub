-- Fix missing table privileges that prevent any access regardless of RLS
-- Grant CRUD on dokumente to authenticated users (dashboard usage)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dokumente TO authenticated;

-- Optional: allow approved flows that might still run as anon? (keep locked down)
REVOKE ALL ON TABLE public.dokumente FROM anon;

-- Ensure functions used inside RLS policies are executable
GRANT EXECUTE ON FUNCTION public.get_user_rolle(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;