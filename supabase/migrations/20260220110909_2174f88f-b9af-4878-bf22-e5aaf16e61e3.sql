
-- Fix audit_log RLS: restrict to admins only instead of all authenticated users
DROP POLICY IF EXISTS "Authenticated can read audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Admins can read audit_log" ON public.audit_log;

CREATE POLICY "Admins can read audit_log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.is_admin_or_higher(auth.uid()));

-- Also restrict INSERT on audit_log to be service-level only (triggers run as SECURITY DEFINER)
DROP POLICY IF EXISTS "System can insert audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated can insert audit_log" ON public.audit_log;

CREATE POLICY "System can insert audit_log"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_higher(auth.uid()));
