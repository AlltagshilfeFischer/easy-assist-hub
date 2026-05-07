-- Mitarbeiter können ihre eigene Verfügbarkeit schreiben
-- Bisher fehlten INSERT, UPDATE, DELETE für die eigene Rolle
-- SELECT war bereits vorhanden (Migration 20260324120100)

CREATE POLICY "Employees can insert own verfuegbarkeit"
  ON public.mitarbeiter_verfuegbarkeit
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mitarbeiter m
      WHERE m.id = mitarbeiter_verfuegbarkeit.mitarbeiter_id
        AND m.benutzer_id = auth.uid()
    )
  );

CREATE POLICY "Employees can update own verfuegbarkeit"
  ON public.mitarbeiter_verfuegbarkeit
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.mitarbeiter m
      WHERE m.id = mitarbeiter_verfuegbarkeit.mitarbeiter_id
        AND m.benutzer_id = auth.uid()
    )
  );

CREATE POLICY "Employees can delete own verfuegbarkeit"
  ON public.mitarbeiter_verfuegbarkeit
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.mitarbeiter m
      WHERE m.id = mitarbeiter_verfuegbarkeit.mitarbeiter_id
        AND m.benutzer_id = auth.uid()
    )
  );
