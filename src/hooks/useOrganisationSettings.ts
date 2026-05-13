import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type EinstellungRow = Database['public']['Tables']['einstellungen']['Row'];

export const SETTINGS_KEYS = {
  GF_STEMPEL_URL: 'gf_stempel_url',
} as const;

type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

async function fetchSetting(key: SettingsKey): Promise<string | null> {
  const { data, error } = await supabase
    .from('einstellungen')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return (data as Pick<EinstellungRow, 'value'> | null)?.value ?? null;
}

async function upsertSetting(key: SettingsKey, value: string | null): Promise<void> {
  const { error } = await supabase
    .from('einstellungen')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}

/** Liest und schreibt die GF-Stempel-URL aus der einstellungen-Tabelle. */
export function useGfStempelUrl() {
  const queryClient = useQueryClient();

  const { data: stempelUrl, isLoading } = useQuery({
    queryKey: ['einstellungen', SETTINGS_KEYS.GF_STEMPEL_URL],
    queryFn: () => fetchSetting(SETTINGS_KEYS.GF_STEMPEL_URL),
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (url: string | null) => upsertSetting(SETTINGS_KEYS.GF_STEMPEL_URL, url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['einstellungen', SETTINGS_KEYS.GF_STEMPEL_URL] });
    },
  });

  return {
    stempelUrl: stempelUrl ?? null,
    isLoading,
    saveStempelUrl: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
