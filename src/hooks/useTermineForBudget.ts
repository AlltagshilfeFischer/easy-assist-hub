import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TerminRow } from '@/lib/pflegebudget/budgetCalculations';

const BILLABLE_STATUSES = ['completed', 'cancelled', 'abgerechnet', 'bezahlt'];

export function useTermineForBudget(kundenId: string | undefined, year: number) {
  return useQuery({
    queryKey: ['termine_budget', kundenId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('termine')
        .select('id, start_at, end_at, iststunden, status')
        .eq('kunden_id', kundenId!)
        .in('status', BILLABLE_STATUSES)
        .gte('start_at', `${year}-01-01`)
        .lte('start_at', `${year}-12-31T23:59:59`)
        .order('start_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TerminRow[];
    },
    enabled: !!kundenId,
  });
}
