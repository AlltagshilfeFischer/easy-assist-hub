import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AbwesenheitEntry } from '@/lib/schedule/checkAbwesenheit';

/** Fetch all approved absences for all employees (cached 2 min). */
export function useAllAbwesenheiten() {
  return useQuery({
    queryKey: ['alle-abwesenheiten'],
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<AbwesenheitEntry[]> => {
      const { data, error } = await supabase
        .from('mitarbeiter_abwesenheiten')
        .select('mitarbeiter_id, von, bis')
        .eq('status', 'approved');
      if (error) throw error;
      return data ?? [];
    },
  });
}
