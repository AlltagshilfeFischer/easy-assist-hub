import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface KundenZeitfensterRow {
  id: string;
  kunden_id: string;
  wochentag: number;
  von: string;
  bis: string;
  prioritaet: number | null;
}

export function useAllKundenZeitfenster() {
  return useQuery({
    queryKey: ['kunden-zeitfenster-all'],
    staleTime: 10 * 60 * 1000, // 10 minutes
    queryFn: async (): Promise<KundenZeitfensterRow[]> => {
      const { data, error } = await supabase
        .from('kunden_zeitfenster')
        .select('id, kunden_id, wochentag, von, bis, prioritaet')
        .order('kunden_id')
        .order('wochentag')
        .order('von');
      if (error) throw error;
      // PostgreSQL TIME columns return "HH:MM:SS" — normalize to "HH:MM"
      return (data ?? []).map(z => ({ ...z, von: z.von.slice(0, 5), bis: z.bis.slice(0, 5) }));
    },
  });
}
