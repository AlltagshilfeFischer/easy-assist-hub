import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Ausweichort } from '@/types/domain';

const QUERY_KEY = ['ausweichorte'] as const;

export function useAusweichorte() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<Ausweichort[]> => {
      const { data, error } = await supabase
        .from('ausweichorte')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateAusweichort() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Ausweichort, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('ausweichorte')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return data as Ausweichort;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Ausweichort gespeichert');
    },
    onError: (err: Error) => {
      toast.error(`Fehler: ${err.message}`);
    },
  });
}

export function useDeleteAusweichort() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ausweichorte').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Ausweichort gelöscht');
    },
    onError: (err: Error) => {
      toast.error(`Fehler: ${err.message}`);
    },
  });
}
