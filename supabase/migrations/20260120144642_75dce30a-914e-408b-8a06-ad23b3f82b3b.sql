-- First, create a security definer function to check user role (avoiding RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_rolle(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rolle::text FROM public.benutzer WHERE id = p_user_id
$$;

-- Drop existing policies on dokumente
DROP POLICY IF EXISTS "Admins full access to dokumente" ON public.dokumente;
DROP POLICY IF EXISTS "Managers can read all dokumente" ON public.dokumente;
DROP POLICY IF EXISTS "Managers can insert dokumente" ON public.dokumente;
DROP POLICY IF EXISTS "Managers can update dokumente" ON public.dokumente;
DROP POLICY IF EXISTS "Managers can delete dokumente" ON public.dokumente;
DROP POLICY IF EXISTS "Mitarbeiter can read own and customer dokumente" ON public.dokumente;

-- Create new policies using the security definer function

-- Admins have full access
CREATE POLICY "Admins full access to dokumente"
ON public.dokumente
FOR ALL
USING (public.get_user_rolle(auth.uid()) = 'admin')
WITH CHECK (public.get_user_rolle(auth.uid()) = 'admin');

-- Managers can read all
CREATE POLICY "Managers can read all dokumente"
ON public.dokumente
FOR SELECT
USING (public.get_user_rolle(auth.uid()) = 'manager');

-- Managers can insert
CREATE POLICY "Managers can insert dokumente"
ON public.dokumente
FOR INSERT
WITH CHECK (public.get_user_rolle(auth.uid()) = 'manager');

-- Managers can update
CREATE POLICY "Managers can update dokumente"
ON public.dokumente
FOR UPDATE
USING (public.get_user_rolle(auth.uid()) = 'manager');

-- Managers can delete
CREATE POLICY "Managers can delete dokumente"
ON public.dokumente
FOR DELETE
USING (public.get_user_rolle(auth.uid()) = 'manager');

-- Mitarbeiter can read their own and assigned customer dokumente
CREATE POLICY "Mitarbeiter can read dokumente"
ON public.dokumente
FOR SELECT
USING (
  public.get_user_rolle(auth.uid()) = 'mitarbeiter'
  AND (
    -- Own mitarbeiter dokumente
    mitarbeiter_id IN (SELECT id FROM mitarbeiter WHERE benutzer_id = auth.uid())
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
  )
);