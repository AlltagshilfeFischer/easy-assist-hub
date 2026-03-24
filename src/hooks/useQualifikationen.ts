import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Qualifikation {
  id: string;
  name: string;
  kategorie: string;
}

/** Fetch all available qualification tags */
export function useQualifikationen() {
  return useQuery({
    queryKey: ['qualifikationen'],
    queryFn: async (): Promise<Qualifikation[]> => {
      const { data, error } = await (supabase
        .from('qualifikationen' as any)
        .select('id, name, kategorie')
        .order('kategorie')
        .order('name')) as any;
      if (error) throw error;
      return (data ?? []) as Qualifikation[];
    },
  });
}

/** Fetch qualification IDs assigned to a specific employee */
export function useMitarbeiterQualifikationen(mitarbeiterId: string | null) {
  return useQuery({
    queryKey: ['mitarbeiter_qualifikationen', mitarbeiterId],
    enabled: !!mitarbeiterId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await (supabase
        .from('mitarbeiter_qualifikationen' as any)
        .select('qualifikation_id')
        .eq('mitarbeiter_id', mitarbeiterId!)) as any;
      if (error) throw error;
      return ((data ?? []) as any[]).map((d: any) => d.qualifikation_id);
    },
  });
}

/** Save qualification assignments for an employee (replace all) */
export function useSaveMitarbeiterQualifikationen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mitarbeiterId, qualifikationIds }: { mitarbeiterId: string; qualifikationIds: string[] }) => {
      // Delete existing
      const { error: deleteError } = await (supabase
        .from('mitarbeiter_qualifikationen' as any)
        .delete()
        .eq('mitarbeiter_id', mitarbeiterId)) as any;
      if (deleteError) throw deleteError;

      if (qualifikationIds.length > 0) {
        const rows = qualifikationIds.map((qId) => ({
          mitarbeiter_id: mitarbeiterId,
          qualifikation_id: qId,
        }));
        const { error: insertError } = await (supabase
          .from('mitarbeiter_qualifikationen' as any)
          .insert(rows as any)) as any;
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mitarbeiter_qualifikationen', variables.mitarbeiterId] });
    },
  });
}

/** Create a new custom qualification tag */
export function useCreateQualifikation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, kategorie = 'Allgemein' }: { name: string; kategorie?: string }) => {
      const { data, error } = await supabase
        .from('qualifikationen')
        .insert({ name, kategorie })
        .select('id, name, kategorie')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qualifikationen'] });
    },
  });
}
