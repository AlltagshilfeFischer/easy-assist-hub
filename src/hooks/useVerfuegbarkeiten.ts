import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Verfuegbarkeit {
  id: string;
  mitarbeiter_id: string;
  wochentag: number; // 0=Mo, 1=Di, ..., 6=So
  von: string;       // "08:00"
  bis: string;       // "17:00"
}

const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'] as const;
export { WOCHENTAGE };

/** Fetch availability slots for a specific employee */
export function useVerfuegbarkeiten(mitarbeiterId: string | null) {
  return useQuery({
    queryKey: ['verfuegbarkeiten', mitarbeiterId],
    enabled: !!mitarbeiterId,
    queryFn: async (): Promise<Verfuegbarkeit[]> => {
      const { data, error } = await supabase
        .from('mitarbeiter_verfuegbarkeit')
        .select('id, mitarbeiter_id, wochentag, von, bis')
        .eq('mitarbeiter_id', mitarbeiterId!)
        .order('wochentag')
        .order('von');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Save all availability slots for an employee (replace all) */
export function useSaveVerfuegbarkeiten() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mitarbeiterId, slots }: { mitarbeiterId: string; slots: Omit<Verfuegbarkeit, 'id' | 'mitarbeiter_id'>[] }) => {
      // Delete existing
      const { error: deleteError } = await supabase
        .from('mitarbeiter_verfuegbarkeit')
        .delete()
        .eq('mitarbeiter_id', mitarbeiterId);
      if (deleteError) throw deleteError;

      // Insert new
      if (slots.length > 0) {
        const rows = slots.map((s) => ({
          mitarbeiter_id: mitarbeiterId,
          wochentag: s.wochentag,
          von: s.von,
          bis: s.bis,
        }));
        const { error: insertError } = await supabase
          .from('mitarbeiter_verfuegbarkeit')
          .insert(rows);
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['verfuegbarkeiten', variables.mitarbeiterId] });
    },
  });
}
