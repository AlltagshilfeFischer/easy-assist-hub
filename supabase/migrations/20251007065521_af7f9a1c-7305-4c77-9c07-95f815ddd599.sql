-- Drop the trigger on auth.users (not allowed on reserved schemas)
DROP TRIGGER IF EXISTS on_auth_user_created_registration ON auth.users;

-- Drop and recreate RLS policies for pending_registrations
DROP POLICY IF EXISTS "Admins can manage pending_registrations" ON public.pending_registrations;

-- Allow anyone to insert their registration request
CREATE POLICY "Anyone can create registration request"
ON public.pending_registrations
FOR INSERT
TO public
WITH CHECK (true);

-- Only admins can view all registrations
CREATE POLICY "Admins can view all registrations"
ON public.pending_registrations
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
);

-- Only admins can update registrations
CREATE POLICY "Admins can update registrations"
ON public.pending_registrations
FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid())
)
WITH CHECK (
  public.is_admin(auth.uid())
);

-- Only admins can delete registrations
CREATE POLICY "Admins can delete registrations"
ON public.pending_registrations
FOR DELETE
TO authenticated
USING (
  public.is_admin(auth.uid())
);