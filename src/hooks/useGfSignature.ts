import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

type EinstellungRow = Database['public']['Tables']['einstellungen']['Row'];

const urlKey = (uid: string) => `gf_unterschrift_url_${uid}`;
const nameKey = (uid: string) => `gf_unterschrift_name_${uid}`;

async function fetchSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('einstellungen')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return (data as Pick<EinstellungRow, 'value'> | null)?.value ?? null;
}

async function upsertSetting(key: string, value: string | null): Promise<void> {
  const { error } = await supabase
    .from('einstellungen')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}

export function useGfSignature() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const queryClient = useQueryClient();

  const qUrl = uid ? ['einstellungen', urlKey(uid)] : null;
  const qName = uid ? ['einstellungen', nameKey(uid)] : null;

  const { data: signaturUrl, isLoading: isUrlLoading } = useQuery({
    queryKey: qUrl!,
    queryFn: () => fetchSetting(urlKey(uid!)),
    enabled: !!uid,
    staleTime: 5 * 60 * 1000,
  });

  const { data: signaturName, isLoading: isNameLoading } = useQuery({
    queryKey: qName!,
    queryFn: () => fetchSetting(nameKey(uid!)),
    enabled: !!uid,
    staleTime: 5 * 60 * 1000,
  });

  const urlMutation = useMutation({
    mutationFn: (url: string | null) => upsertSetting(urlKey(uid!), url),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qUrl! }),
  });

  const nameMutation = useMutation({
    mutationFn: (name: string | null) => upsertSetting(nameKey(uid!), name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qName! }),
  });

  const saveSignature = async (dataUrl: string, name: string) => {
    if (!uid) throw new Error('Nicht eingeloggt');
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'image/png' });
    const storagePath = `gf-unterschriften/${uid}.png`;
    const { error } = await supabase.storage
      .from('avatars')
      .upload(storagePath, blob, { upsert: true, contentType: 'image/png' });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(storagePath);
    await urlMutation.mutateAsync(urlData.publicUrl);
    if (name.trim()) await nameMutation.mutateAsync(name.trim());
  };

  const saveUploadedFile = async (file: File, name: string) => {
    if (!uid) throw new Error('Nicht eingeloggt');
    const storagePath = `gf-unterschriften/${uid}.png`;
    const { error } = await supabase.storage
      .from('avatars')
      .upload(storagePath, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(storagePath);
    await urlMutation.mutateAsync(urlData.publicUrl);
    if (name.trim()) await nameMutation.mutateAsync(name.trim());
  };

  const clearSignature = async () => {
    if (!uid) return;
    await urlMutation.mutateAsync(null);
    await supabase.storage.from('avatars').remove([`gf-unterschriften/${uid}.png`]);
  };

  const saveName = async (name: string) => {
    if (!uid) return;
    await nameMutation.mutateAsync(name.trim() || null);
  };

  return {
    signaturUrl: signaturUrl ?? null,
    signaturName: signaturName ?? null,
    isLoading: isUrlLoading || isNameLoading,
    isSaving: urlMutation.isPending || nameMutation.isPending,
    saveSignature,
    saveUploadedFile,
    clearSignature,
    saveName,
  };
}
