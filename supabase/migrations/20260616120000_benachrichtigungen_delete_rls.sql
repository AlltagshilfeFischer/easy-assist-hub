-- Nutzer dürfen eigene Benachrichtigungen löschen (für Auto-Cleanup und manuelle Lösch-Funktion)
CREATE POLICY "Users can delete own benachrichtigungen"
  ON public.benachrichtigungen
  FOR DELETE
  USING (benutzer_id = auth.uid());
