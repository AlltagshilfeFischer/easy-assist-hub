-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

-- Drop possibly conflicting/legacy INSERT policies
DROP POLICY IF EXISTS "Allow public registration requests" ON public.pending_registrations;
DROP POLICY IF EXISTS "Anyone can create registration request" ON public.pending_registrations;

-- Create explicit public (anon + authenticated) INSERT policy
CREATE POLICY "Allow public registration requests"
ON public.pending_registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
