-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage all dokumente" ON public.dokumente;
DROP POLICY IF EXISTS "Mitarbeiter can read assigned customer dokumente" ON public.dokumente;

-- Create comprehensive policies for dokumente

-- Admins can do everything
CREATE POLICY "Admins full access to dokumente"
ON public.dokumente
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM benutzer
    WHERE benutzer.id = auth.uid()
    AND benutzer.rolle = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM benutzer
    WHERE benutzer.id = auth.uid()
    AND benutzer.rolle = 'admin'
  )
);

-- Managers can read all dokumente
CREATE POLICY "Managers can read all dokumente"
ON public.dokumente
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM benutzer
    WHERE benutzer.id = auth.uid()
    AND benutzer.rolle = 'manager'
  )
);

-- Managers can insert dokumente
CREATE POLICY "Managers can insert dokumente"
ON public.dokumente
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM benutzer
    WHERE benutzer.id = auth.uid()
    AND benutzer.rolle = 'manager'
  )
);

-- Managers can update dokumente
CREATE POLICY "Managers can update dokumente"
ON public.dokumente
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM benutzer
    WHERE benutzer.id = auth.uid()
    AND benutzer.rolle = 'manager'
  )
);

-- Managers can delete dokumente
CREATE POLICY "Managers can delete dokumente"
ON public.dokumente
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM benutzer
    WHERE benutzer.id = auth.uid()
    AND benutzer.rolle = 'manager'
  )
);

-- Mitarbeiter can read their own dokumente and assigned customer dokumente
CREATE POLICY "Mitarbeiter can read own and customer dokumente"
ON public.dokumente
FOR SELECT
USING (
  -- Own mitarbeiter dokumente
  mitarbeiter_id IN (
    SELECT id FROM mitarbeiter WHERE benutzer_id = auth.uid()
  )
  OR
  -- Assigned customer dokumente (through termine)
  kunden_id IN (
    SELECT DISTINCT t.kunden_id 
    FROM termine t
    JOIN mitarbeiter m ON m.id = t.mitarbeiter_id
    WHERE m.benutzer_id = auth.uid()
  )
  OR
  -- Internal dokumente
  kategorie = 'intern'
);