-- Entferne den Trigger zuerst
DROP TRIGGER IF EXISTS on_auth_user_created_provisioning ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Dann die Funktion
DROP FUNCTION IF EXISTS public.handle_new_user_provisioning() CASCADE;