-- Drop the FK constraint that ties user_roles to auth.users
-- This allows roles to be assigned before a user has an auth account
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

-- Add FK to benutzer instead (benutzer records can exist without auth)
-- But make it deferrable so we can create roles even before benutzer exists
ALTER TABLE public.user_roles 
  ADD CONSTRAINT user_roles_user_id_benutzer_fkey 
  FOREIGN KEY (user_id) REFERENCES public.benutzer(id) ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;