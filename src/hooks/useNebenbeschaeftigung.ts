import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MitarbeiterNebenbeschaeftigung } from '@/types/domain';

const QUERY_KEY = 'nebenbeschaeftigungen';

export function useNebenbeschaeftigungen(mitarbeiterId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, mitarbeiterId],
    queryFn: async () => {
      if (!mitarbeiterId) return [];
      const { data, error } = await supabase
        .from('mitarbeiter_nebenbeschaeftigung')
        .select('*')
        .eq('mitarbeiter_id', mitarbeiterId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as MitarbeiterNebenbeschaeftigung[];
    },
    enabled: !!mitarbeiterId,
  });
}

export function useCreateNebenbeschaeftigung() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      mitarbeiter_id: string;
      arbeitgeber: string;
      art_beschaeftigung?: string | null;
      arbeitszeit_stunden_woche?: number | null;
      gehalt_monatlich?: number | null;
      gehalt_pro_stunde?: number | null;
      sv_pflicht?: boolean;
      rv_pflicht?: boolean | null;
    }) => {
      const { data, error } = await supabase
        .from('mitarbeiter_nebenbeschaeftigung')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, variables.mitarbeiter_id] });
    },
  });
}

export function useUpdateNebenbeschaeftigung() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      mitarbeiter_id: string;
      arbeitgeber?: string;
      art_beschaeftigung?: string | null;
      arbeitszeit_stunden_woche?: number | null;
      gehalt_monatlich?: number | null;
      gehalt_pro_stunde?: number | null;
      sv_pflicht?: boolean;
      rv_pflicht?: boolean | null;
    }) => {
      const { id, mitarbeiter_id, ...rest } = payload;
      const { data, error } = await supabase
        .from('mitarbeiter_nebenbeschaeftigung')
        .update(rest)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, variables.mitarbeiter_id] });
    },
  });
}

export function useDeleteNebenbeschaeftigung() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; mitarbeiter_id: string }) => {
      const { error } = await supabase
        .from('mitarbeiter_nebenbeschaeftigung')
        .delete()
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, variables.mitarbeiter_id] });
    },
  });
}
