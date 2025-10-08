-- Ensure SELECT visibility for own registration status to authenticated users
DROP POLICY IF EXISTS "Users can view their own registration" ON public.pending_registrations;
CREATE POLICY "Users can view their own registration"
ON public.pending_registrations
FOR SELECT
TO authenticated
USING (email = (auth.jwt() ->> 'email')::citext);

-- Also allow admins to view all registrations (idempotent recreate)
DROP POLICY IF EXISTS "Admins can view all registrations" ON public.pending_registrations;
CREATE POLICY "Admins can view all registrations"
ON public.pending_registrations
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));
