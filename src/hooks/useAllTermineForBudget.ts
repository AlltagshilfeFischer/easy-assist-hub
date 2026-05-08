import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TerminRow } from '@/lib/pflegebudget/budgetCalculations';

const BILLABLE_STATUSES = ['completed', 'cancelled', 'abgerechnet', 'bezahlt'];

type TerminWithClient = TerminRow & { kunden_id: string };

export function useAllTermineForBudget(year: number): {
  data: Record<string, TerminRow[]>;
  isLoading: boolean;
} {
  const { data: raw = [], isLoading } = useQuery({
    queryKey: ['termine_budget_all', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('termine')
        .select('id, start_at, end_at, iststunden, status, kunden_id')
        .in('status', BILLABLE_STATUSES)
        .gte('start_at', `${year}-01-01`)
        .lte('start_at', `${year}-12-31T23:59:59`)
        .order('start_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TerminWithClient[];
    },
  });

  const grouped = useMemo(() => {
    const result: Record<string, TerminRow[]> = {};
    for (const t of raw) {
      if (!result[t.kunden_id]) result[t.kunden_id] = [];
      result[t.kunden_id].push(t);
    }
    return result;
  }, [raw]);

  return { data: grouped, isLoading };
}
