-- Verschärfe RLS Policies für mitarbeiter Tabelle
-- Nur Admins dürfen Mitarbeiter verwalten

DROP POLICY IF EXISTS "Authenticated users can delete mitarbeiter" ON public.mitarbeiter;
DROP POLICY IF EXISTS "Authenticated users can insert mitarbeiter" ON public.mitarbeiter;
DROP POLICY IF EXISTS "Authenticated users can update mitarbeiter" ON public.mitarbeiter;

-- Admins können alle Mitarbeiter verwalten
CREATE POLICY "Admins can manage mitarbeiter"
ON public.mitarbeiter
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Mitarbeiter können ihre eigenen Daten lesen
CREATE POLICY "Mitarbeiter can read their own data"
ON public.mitarbeiter
FOR SELECT
TO authenticated
USING (benutzer_id = auth.uid());

-- Verschärfe RLS für benutzer Tabelle
DROP POLICY IF EXISTS "Authenticated users can read benutzer" ON public.benutzer;

-- Nur Admins können alle Benutzer sehen
CREATE POLICY "Admins can read all benutzer"
ON public.benutzer
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Benutzer können ihre eigenen Daten sehen
CREATE POLICY "Users can read own benutzer"
ON public.benutzer
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Verschärfe mitarbeiter Public Policy
DROP POLICY IF EXISTS "Public can read mitarbeiter" ON public.mitarbeiter;

-- Verschärfe kunden Public Policy
DROP POLICY IF EXISTS "Public can read kunden" ON public.kunden;