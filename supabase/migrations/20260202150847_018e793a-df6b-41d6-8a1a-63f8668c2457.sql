-- Add avatar_url column to mitarbeiter table
ALTER TABLE public.mitarbeiter
ADD COLUMN avatar_url TEXT;

-- Create storage bucket for employee avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload avatars
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

-- Allow public read access to avatars
CREATE POLICY "Public can read avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Allow admins to delete avatars
CREATE POLICY "Admins can delete avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND EXISTS (
  SELECT 1 FROM public.benutzer 
  WHERE id = auth.uid() AND rolle = 'admin'
));

-- Allow admins to update avatars
CREATE POLICY "Admins can update avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND EXISTS (
  SELECT 1 FROM public.benutzer 
  WHERE id = auth.uid() AND rolle = 'admin'
));