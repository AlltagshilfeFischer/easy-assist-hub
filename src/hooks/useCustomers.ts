import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Customer } from '@/types/domain';

/**
 * Fetches all customers (optionally only active).
 */
export function useCustomers(options?: { onlyActive?: boolean }) {
  return useQuery({
    queryKey: ['customers', { onlyActive: options?.onlyActive }],
    queryFn: async (): Promise<Customer[]> => {
      let query = supabase
        .from('kunden')
        .select('*')
        .order('name');

      if (options?.onlyActive) {
        query = query.eq('aktiv', true);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((c) => ({
        ...c,
        farbe_kalender: c.farbe_kalender ?? '#10B981',
      })) as Customer[];
    },
  });
}
