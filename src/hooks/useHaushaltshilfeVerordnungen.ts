import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// TODO: Typen aus src/integrations/supabase/types.ts ergänzen sobald auto-generiert
export interface HaushaltshilfeVerordnung {
  id: string;
  kunden_id: string;
  gueltig_von: string;
  gueltig_bis: string;
  termine_pro_woche: number;
  max_dauer_stunden: number;
  notizen: string | null;
  created_at: string;
  updated_at: string;
}

export type HaushaltshilfeVerordnungInsert = Omit<
  HaushaltshilfeVerordnung,
  'id' | 'created_at' | 'updated_at'
>;

export type HaushaltshilfeVerordnungUpdate = Partial<
  Omit<HaushaltshilfeVerordnung, 'id' | 'kunden_id' | 'created_at' | 'updated_at'>
>;

// ─── Query: Alle Verordnungen eines Kunden ───────────────────

export function useHaushaltshilfeVerordnungen(kundenId: string | undefined) {
  return useQuery({
    queryKey: ['haushaltshilfe_verordnungen', kundenId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('haushaltshilfe_verordnungen' as never)
        .select('*')
        .eq('kunden_id', kundenId!)
        .order('gueltig_von', { ascending: false });
      if (error) throw error;
      return (data ?? []) as HaushaltshilfeVerordnung[];
    },
    enabled: !!kundenId,
  });
}

// ─── Mutation: Verordnung erstellen ─────────────────────────

export function useCreateHaushaltshilfeVerordnung() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (verordnung: HaushaltshilfeVerordnungInsert) => {
      const { data, error } = await supabase
        .from('haushaltshilfe_verordnungen' as never)
        .insert(verordnung as never)
        .select()
        .single();
      if (error) throw error;
      return data as HaushaltshilfeVerordnung;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['haushaltshilfe_verordnungen', variables.kunden_id],
      });
      toast.success('Verordnung wurde erstellt');
    },
    onError: (error) => {
      console.error('Fehler beim Erstellen der Verordnung:', error);
      toast.error('Fehler beim Erstellen der Verordnung');
    },
  });
}

// ─── Mutation: Verordnung aktualisieren ──────────────────────

export function useUpdateHaushaltshilfeVerordnung() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      kundenId,
      updates,
    }: {
      id: string;
      kundenId: string;
      updates: HaushaltshilfeVerordnungUpdate;
    }) => {
      const { data, error } = await supabase
        .from('haushaltshilfe_verordnungen' as never)
        .update({ ...updates, updated_at: new Date().toISOString() } as never)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as HaushaltshilfeVerordnung;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['haushaltshilfe_verordnungen', variables.kundenId],
      });
      toast.success('Verordnung wurde gespeichert');
    },
    onError: (error) => {
      console.error('Fehler beim Speichern der Verordnung:', error);
      toast.error('Fehler beim Speichern der Verordnung');
    },
  });
}

// ─── Mutation: Verordnung löschen ────────────────────────────

export function useDeleteHaushaltshilfeVerordnung() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, kundenId }: { id: string; kundenId: string }) => {
      const { error } = await supabase
        .from('haushaltshilfe_verordnungen' as never)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['haushaltshilfe_verordnungen', variables.kundenId],
      });
      toast.success('Verordnung wurde gelöscht');
    },
    onError: (error) => {
      console.error('Fehler beim Löschen der Verordnung:', error);
      toast.error('Fehler beim Löschen der Verordnung');
    },
  });
}
