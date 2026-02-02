-- =====================================================
-- ROLLEN-SICHERHEITSARCHITEKTUR
-- Separate user_roles Tabelle mit Security-Definer-Funktionen
-- =====================================================

-- 1. App Role Enum erstellen (falls nicht existiert)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'mitarbeiter');
  END IF;
END$$;

-- 2. User Roles Tabelle erstellen
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- 3. RLS aktivieren
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Security-Definer-Funktion: Hat Benutzer eine bestimmte Rolle?
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. Security-Definer-Funktion: Ist Benutzer Admin?
CREATE OR REPLACE FUNCTION public.is_admin_secure(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'::app_role
  )
$$;

-- 6. Security-Definer-Funktion: Alle Rollen eines Benutzers abrufen
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- 7. RLS Policies für user_roles Tabelle
-- Admins können alle Rollen sehen
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin_secure(auth.uid()));

-- Benutzer können eigene Rollen sehen
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Nur Admins können Rollen zuweisen
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_secure(auth.uid()));

-- Nur Admins können Rollen entfernen
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_admin_secure(auth.uid()));

-- 8. Existierende Rollen aus benutzer-Tabelle migrieren
-- NUR Benutzer die auch in auth.users existieren!
INSERT INTO public.user_roles (user_id, role, granted_at)
SELECT 
  b.id,
  CASE 
    WHEN b.rolle::text = 'admin' THEN 'admin'::app_role
    WHEN b.rolle::text = 'manager' THEN 'manager'::app_role
    ELSE 'mitarbeiter'::app_role
  END,
  b.created_at
FROM public.benutzer b
WHERE b.status = 'approved'
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = b.id)
ON CONFLICT (user_id, role) DO NOTHING;

-- 9. Index für Performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- 10. Audit-Log für Rollenänderungen
CREATE OR REPLACE FUNCTION public.log_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (operation, table_name, row_id, new_data, actor_benutzer_id)
    VALUES ('INSERT', 'user_roles', NEW.id, to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (operation, table_name, row_id, old_data, actor_benutzer_id)
    VALUES ('DELETE', 'user_roles', OLD.id, to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS trigger_log_role_changes ON public.user_roles;
CREATE TRIGGER trigger_log_role_changes
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_role_changes();