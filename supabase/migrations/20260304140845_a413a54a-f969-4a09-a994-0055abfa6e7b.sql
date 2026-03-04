-- Create the dokumente storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('dokumente', 'dokumente', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage.objects on dokumente bucket
CREATE POLICY "Admins can manage dokumente files"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'dokumente' AND public.is_admin_or_higher(auth.uid()))
WITH CHECK (bucket_id = 'dokumente' AND public.is_admin_or_higher(auth.uid()));

CREATE POLICY "Mitarbeiter can upload dokumente"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dokumente' AND
  EXISTS (
    SELECT 1 FROM public.mitarbeiter m
    WHERE m.benutzer_id = auth.uid()
  )
);

CREATE POLICY "Mitarbeiter can read dokumente"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'dokumente' AND
  (
    public.is_admin_or_higher(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.mitarbeiter m
      WHERE m.benutzer_id = auth.uid()
    )
  )
);