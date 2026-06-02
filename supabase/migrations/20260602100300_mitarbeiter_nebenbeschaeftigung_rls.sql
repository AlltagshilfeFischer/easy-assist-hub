-- K3-Vorbereitung: Granulare RLS-Policies für mitarbeiter_nebenbeschaeftigung.
--
-- Diese Tabelle hat nur die Basis-authenticated_all Policy (aus 20250101000000_base_schema.sql)
-- und keine granularen Policies. Muss vor dem Drop der authenticated_all-Policies
-- abgesichert werden, da useNebenbeschaeftigung.ts aktiv SELECT/INSERT/UPDATE/DELETE nutzt.
--
-- Zugriff:
--   SELECT: geschaeftsfuehrer + globaladmin (vollständig), buchhaltung (lesen)
--   INSERT/UPDATE/DELETE: nur geschaeftsfuehrer + globaladmin

-- Lesezugriff für GF, GlobalAdmin und Buchhaltung
CREATE POLICY "nebenbeschaeftigung_gf_select"
  ON public.mitarbeiter_nebenbeschaeftigung
  FOR SELECT
  TO authenticated
  USING (
    public.is_geschaeftsfuehrer(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'buchhaltung'::app_role
    )
  );

-- Schreibzugriff nur für GF und GlobalAdmin
CREATE POLICY "nebenbeschaeftigung_gf_insert"
  ON public.mitarbeiter_nebenbeschaeftigung
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_geschaeftsfuehrer(auth.uid()));

CREATE POLICY "nebenbeschaeftigung_gf_update"
  ON public.mitarbeiter_nebenbeschaeftigung
  FOR UPDATE
  TO authenticated
  USING (public.is_geschaeftsfuehrer(auth.uid()))
  WITH CHECK (public.is_geschaeftsfuehrer(auth.uid()));

CREATE POLICY "nebenbeschaeftigung_gf_delete"
  ON public.mitarbeiter_nebenbeschaeftigung
  FOR DELETE
  TO authenticated
  USING (public.is_geschaeftsfuehrer(auth.uid()));
