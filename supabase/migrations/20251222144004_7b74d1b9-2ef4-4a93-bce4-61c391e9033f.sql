-- Allow users to update their own pending registration (to add names)
CREATE POLICY "Users can update their own pending registration"
ON public.pending_registrations
FOR UPDATE
USING (email = ((auth.jwt() ->> 'email'::text))::citext)
WITH CHECK (email = ((auth.jwt() ->> 'email'::text))::citext);