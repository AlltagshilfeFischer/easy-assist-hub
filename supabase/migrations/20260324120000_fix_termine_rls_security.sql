-- =====================================================
-- FIX: Termine RLS Security
-- =====================================================
-- Removes dangerous legacy policies that were never cleaned up:
-- 1. "Public can read termine" (anon access!)
-- 2. "Authenticated can modify termine" (any user can modify any termin!)
-- 3. "Authenticated users can read termine" (any user can read all)
-- 4. "Admins can manage all termine" (redundant with current policies)
-- Adds missing policy:
-- 5. "Buchhaltung can read termine" (read-only access for accounting)

BEGIN;

-- =====================================================
-- 1. DROP dangerous legacy policies
-- =====================================================

-- From 20250908111820 — test policies that were never removed
DROP POLICY IF EXISTS "Public can read termine" ON public.termine;
DROP POLICY IF EXISTS "Authenticated can modify termine" ON public.termine;

-- From 20250908110337 — broad auth policy never removed
DROP POLICY IF EXISTS "Authenticated users can read termine" ON public.termine;

-- From 20251013081931 — redundant with current is_admin_or_higher policies
DROP POLICY IF EXISTS "Admins can manage all termine" ON public.termine;

-- Also fix termin_aenderungen — same legacy issue
DROP POLICY IF EXISTS "Authenticated can modify termin_aenderungen" ON public.termin_aenderungen;

-- =====================================================
-- 2. ADD missing Buchhaltung policy
-- =====================================================

CREATE POLICY "Buchhaltung can read termine"
  ON public.termine
  FOR SELECT
  USING (public.is_buchhaltung(auth.uid()));

-- =====================================================
-- Summary of active termine policies after this migration:
-- =====================================================
-- "Admins can read termine"          → SELECT for globaladmin + gf
-- "Admins can insert termine"        → INSERT for globaladmin + gf
-- "Admins can update termine"        → UPDATE for globaladmin + gf
-- "Only GF can delete termine"       → DELETE for globaladmin + gf
-- "Employees can read own termine"   → SELECT for MA (own only)
-- "Employees can update own termine" → UPDATE for MA (own only)
-- "Buchhaltung can read termine"     → SELECT for buchhaltung (NEW)

COMMIT;
