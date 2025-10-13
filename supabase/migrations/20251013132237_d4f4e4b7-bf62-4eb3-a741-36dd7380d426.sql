-- Füge INSERT Policy für benutzer hinzu (für Service Role im Edge Function)
-- Die Service Role kann RLS umgehen, aber wir fügen trotzdem eine explizite Policy hinzu
CREATE POLICY "Service role can insert benutzer"
ON public.benutzer
FOR INSERT
TO service_role
WITH CHECK (true);

-- Füge INSERT Policy für mitarbeiter hinzu (für Service Role im Edge Function)
CREATE POLICY "Service role can insert mitarbeiter"
ON public.mitarbeiter
FOR INSERT
TO service_role
WITH CHECK (true);