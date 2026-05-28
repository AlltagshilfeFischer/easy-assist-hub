-- Entfernt die veraltete permissive Policy, die alle restriktiven Policies für
-- notfallkontakte wirkungslos gemacht hat (Supabase RLS ist additive/permissive).
DROP POLICY IF EXISTS "notfallkontakte_authenticated_all" ON public.notfallkontakte;
