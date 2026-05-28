import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BudgetUpdate {
  kundenId: string;
  pflegegrad: number;
  entlastung_genehmigt: boolean;
  initial_budget_entlastung: number | null;
  pflegesachleistung_genehmigt: boolean;
  pflegesachleistung_budget: number | null;
  verhinderungspflege_genehmigt: boolean;
}

export function useUpdateKundenBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ kundenId, ...fields }: BudgetUpdate) => {
      const { error } = await supabase
        .from('kunden')
        .update(fields)
        .eq('id', kundenId);
      if (error) throw error;
    },
    onSuccess: (_, { kundenId }) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['termine_budget', kundenId] });
      queryClient.invalidateQueries({ queryKey: ['termine_budget_all'] });
      toast.success('Budget-Konfiguration gespeichert');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Fehler beim Speichern der Budget-Konfiguration');
    },
  });
}
