import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BudgetManuellerEintrag } from '@/types/domain';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type InsertPayload = Database['public']['Tables']['budget_manuelle_eintraege']['Insert'];
type UpdatePayload = Database['public']['Tables']['budget_manuelle_eintraege']['Update'] & { id: string };

const QUERY_KEY = (kundenId: string) => ['budget_manuelle_eintraege', kundenId] as const;

// ─── Query ───────────────────────────────────────────────────

export function useBudgetManuelleEintraege(kundenId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEY(kundenId ?? ''),
    queryFn: async (): Promise<BudgetManuellerEintrag[]> => {
      const { data, error } = await supabase
        .from('budget_manuelle_eintraege')
        .select('*')
        .eq('kunden_id', kundenId!)
        .order('verfaellt_am', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BudgetManuellerEintrag[];
    },
    enabled: !!kundenId,
  });
}

// ─── Create ──────────────────────────────────────────────────

export function useCreateBudgetManuellerEintrag(kundenId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Omit<InsertPayload, 'kunden_id'>) => {
      const { data, error } = await supabase
        .from('budget_manuelle_eintraege')
        .insert({ ...payload, kunden_id: kundenId })
        .select()
        .single();
      if (error) throw error;
      return data as BudgetManuellerEintrag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY(kundenId) });
      toast.success('Eintrag erfolgreich erstellt.');
    },
    onError: (error: unknown) => {
      console.error(error);
      toast.error('Fehler beim Erstellen des Eintrags.');
    },
  });
}

// ─── Update ──────────────────────────────────────────────────

export function useUpdateBudgetManuellerEintrag(kundenId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdatePayload) => {
      const { data, error } = await supabase
        .from('budget_manuelle_eintraege')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as BudgetManuellerEintrag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY(kundenId) });
      toast.success('Eintrag erfolgreich aktualisiert.');
    },
    onError: (error: unknown) => {
      console.error(error);
      toast.error('Fehler beim Aktualisieren des Eintrags.');
    },
  });
}

// ─── Delete ──────────────────────────────────────────────────

export function useDeleteBudgetManuellerEintrag(kundenId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('budget_manuelle_eintraege')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY(kundenId) });
      toast.success('Eintrag gelöscht.');
    },
    onError: (error: unknown) => {
      console.error(error);
      toast.error('Fehler beim Löschen des Eintrags.');
    },
  });
}
