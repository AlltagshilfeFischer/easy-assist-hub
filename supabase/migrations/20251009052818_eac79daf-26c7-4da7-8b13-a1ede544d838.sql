-- Fix registration permission denied: explicit GRANTs and clear RLS policies for anon/auth

-- Ensure schema access (idempotent)
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Explicit table privileges (RLS still applies)
GRANT INSERT ON TABLE public.pending_registrations TO anon, authenticated;
GRANT SELECT ON TABLE public.pending_registrations TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

-- Recreate public insert policy for clarity
DROP POLICY IF EXISTS "Allow public registration requests" ON public.pending_registrations;
CREATE POLICY "Allow public registration requests"
ON public.pending_registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Recreate SELECT policies (idempotent)
DROP POLICY IF EXISTS "Users can view their own registration" ON public.pending_registrations;
CREATE POLICY "Users can view their own registration"
ON public.pending_registrations
FOR SELECT
TO authenticated
USING (email = (auth.jwt() ->> 'email')::citext);

DROP POLICY IF EXISTS "Admins can view all registrations" ON public.pending_registrations;
CREATE POLICY "Admins can view all registrations"
ON public.pending_registrations
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));