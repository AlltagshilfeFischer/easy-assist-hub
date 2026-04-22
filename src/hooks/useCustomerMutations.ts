import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import type { CustomerTimeWindow } from '@/types/domain';

type KundenUpdate = Database['public']['Tables']['kunden']['Update'];

interface UpdateCustomerPayload extends KundenUpdate {
  id: string;
  zeitfenster?: CustomerTimeWindow[];
  hauptbetreuer?: string;
}

export function useCustomerMutations() {
  const queryClient = useQueryClient();

  const updateCustomerMutation = useMutation({
    mutationFn: async (customerData: UpdateCustomerPayload) => {
      const { zeitfenster, hauptbetreuer, ...kundenData } = customerData;

      const { error: kundenError } = await supabase
        .from('kunden')
        .update(kundenData)
        .eq('id', kundenData.id);
      if (kundenError) throw kundenError;

      if (zeitfenster && Array.isArray(zeitfenster)) {
        await supabase.from('kunden_zeitfenster').delete().eq('kunden_id', kundenData.id);
        if (zeitfenster.length > 0) {
          const windowsToInsert = zeitfenster.map((w) => ({
            kunden_id: kundenData.id,
            wochentag: w.wochentag,
            von: w.von,
            bis: w.bis,
          }));
          const { error: zeitfensterError } = await supabase
            .from('kunden_zeitfenster')
            .insert(windowsToInsert);
          if (zeitfensterError) throw zeitfensterError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Kundendaten wurden aktualisiert');
    },
    onError: (error: Error) => {
      console.error('[useCustomerMutations] Update-Fehler:', error);
      toast.error('Fehler', { description: error.message || 'Kundendaten konnten nicht aktualisiert werden' });
    },
  });

  const convertToCustomerMutation = useMutation({
    mutationFn: async (kundenId: string) => {
      const { error } = await supabase.from('kunden').update({ kategorie: 'Kunde' }).eq('id', kundenId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Interessent wurde zu Kunde umgewandelt');
    },
    onError: () => {
      toast.error('Umwandlung fehlgeschlagen');
    },
  });

  const toggleCustomerStatusMutation = useMutation({
    mutationFn: async ({ kundenId, currentStatus }: { kundenId: string; currentStatus: boolean }) => {
      const { error } = await supabase.from('kunden').update({ aktiv: !currentStatus }).eq('id', kundenId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(variables.currentStatus ? 'Kunde wurde deaktiviert' : 'Kunde wurde aktiviert');
    },
    onError: () => {
      toast.error('Status konnte nicht geändert werden');
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (kundenId: string) => {
      const { error: dokumenteError } = await supabase.from('dokumente').delete().eq('kunden_id', kundenId);
      if (dokumenteError) throw dokumenteError;
      const { error: termineError } = await supabase.from('termine').delete().eq('kunden_id', kundenId);
      if (termineError) throw termineError;
      const { error: zeitfensterError } = await supabase.from('kunden_zeitfenster').delete().eq('kunden_id', kundenId);
      if (zeitfensterError) throw zeitfensterError;
      const { error } = await supabase.from('kunden').delete().eq('id', kundenId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Kunde wurde erfolgreich gelöscht');
    },
    onError: () => {
      toast.error('Kunde konnte nicht gelöscht werden');
    },
  });

  const bulkDeleteCustomersMutation = useMutation({
    mutationFn: async (kundenIds: string[]) => {
      const { error: dokumenteError } = await supabase.from('dokumente').delete().in('kunden_id', kundenIds);
      if (dokumenteError) throw dokumenteError;
      const { error: termineError } = await supabase.from('termine').delete().in('kunden_id', kundenIds);
      if (termineError) throw termineError;
      const { error: zeitfensterError } = await supabase.from('kunden_zeitfenster').delete().in('kunden_id', kundenIds);
      if (zeitfensterError) throw zeitfensterError;
      const { error } = await supabase.from('kunden').delete().in('id', kundenIds);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(`${ids.length} Kunden wurden erfolgreich gelöscht`);
    },
    onError: () => {
      toast.error('Kunden konnten nicht gelöscht werden');
    },
  });

  return {
    updateCustomerMutation,
    convertToCustomerMutation,
    toggleCustomerStatusMutation,
    deleteCustomerMutation,
    bulkDeleteCustomersMutation,
  };
}
