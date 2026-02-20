-- Allow users to update their own benutzer status from 'eingeladen' to 'approved'
CREATE POLICY "Users can update own status from eingeladen to approved"
ON public.benutzer
FOR UPDATE
USING (id = auth.uid() AND status = 'eingeladen'::benutzer_status)
WITH CHECK (id = auth.uid() AND status = 'approved'::benutzer_status);