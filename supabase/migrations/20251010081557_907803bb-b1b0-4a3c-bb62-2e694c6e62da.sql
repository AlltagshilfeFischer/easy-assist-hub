-- Create a security definer function to get pending registration details
-- This bypasses RLS and can be called from the edge function
CREATE OR REPLACE FUNCTION public.get_pending_registration(p_registration_id uuid)
RETURNS TABLE (
  email citext,
  vorname text,
  nachname text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT pr.email, pr.vorname, pr.nachname
  FROM public.pending_registrations pr
  WHERE pr.id = p_registration_id AND pr.status = 'pending';
END;
$$;

-- Create a security definer function to update pending registration status
CREATE OR REPLACE FUNCTION public.update_registration_status(
  p_registration_id uuid,
  p_reviewer_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pending_registrations
  SET 
    status = 'approved',
    reviewed_by = p_reviewer_id,
    reviewed_at = now()
  WHERE id = p_registration_id;
END;
$$;