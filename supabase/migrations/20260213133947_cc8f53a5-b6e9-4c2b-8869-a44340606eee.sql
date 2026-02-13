
-- Add approval workflow columns to mitarbeiter_abwesenheiten
ALTER TABLE public.mitarbeiter_abwesenheiten 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES public.benutzer(id),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.benutzer(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS typ text NOT NULL DEFAULT 'urlaub',
  ADD COLUMN IF NOT EXISTS von date,
  ADD COLUMN IF NOT EXISTS bis date;

-- Allow employees to INSERT their own absence requests
CREATE POLICY "Mitarbeiter can request own absences"
ON public.mitarbeiter_abwesenheiten
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM mitarbeiter m
    WHERE m.id = mitarbeiter_abwesenheiten.mitarbeiter_id
    AND m.benutzer_id = auth.uid()
  )
);

-- Allow employees to read their own absences
CREATE POLICY "Mitarbeiter can read own absences"
ON public.mitarbeiter_abwesenheiten
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM mitarbeiter m
    WHERE m.id = mitarbeiter_abwesenheiten.mitarbeiter_id
    AND m.benutzer_id = auth.uid()
  )
);
