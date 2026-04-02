import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Verfuegbarkeit } from '@/hooks/useVerfuegbarkeiten';

/** Fetch availability slots for ALL active employees in one query */
export function useAllVerfuegbarkeiten() {
  return useQuery({
    queryKey: ['verfuegbarkeiten-all'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async (): Promise<Verfuegbarkeit[]> => {
      const { data, error } = await supabase
        .from('mitarbeiter_verfuegbarkeit')
        .select('id, mitarbeiter_id, wochentag, von, bis')
        .order('mitarbeiter_id')
        .order('wochentag')
        .order('von');
      if (error) throw error;
      return data ?? [];
    },
  });
}
