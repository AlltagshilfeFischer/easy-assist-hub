-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Anyone can create registration request" ON public.pending_registrations;

-- Create a new policy that allows anyone (even unauthenticated users) to insert registration requests
CREATE POLICY "Allow public registration requests"
ON public.pending_registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);