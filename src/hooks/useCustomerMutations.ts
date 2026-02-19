import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useCustomerMutations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateCustomerMutation = useMutation({
    mutationFn: async (customerData: any) => {
      const { zeitfenster, hauptbetreuer, ...kundenData } = customerData;

      const { error: kundenError } = await supabase
        .from('kunden')
        .update(kundenData)
        .eq('id', kundenData.id);
      if (kundenError) throw kundenError;

      if (zeitfenster && Array.isArray(zeitfenster)) {
        await supabase.from('kunden_zeitfenster').delete().eq('kunden_id', kundenData.id);
        if (zeitfenster.length > 0) {
          const windowsToInsert = zeitfenster.map((w: any) => ({
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
      toast({ title: 'Erfolg', description: 'Kundendaten wurden aktualisiert' });
    },
    onError: () => {
      toast({ title: 'Fehler', description: 'Kundendaten konnten nicht aktualisiert werden', variant: 'destructive' });
    },
  });

  const convertToCustomerMutation = useMutation({
    mutationFn: async (kundenId: string) => {
      const { error } = await supabase.from('kunden').update({ kategorie: 'Kunde' }).eq('id', kundenId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Erfolg', description: 'Interessent wurde zu Kunde umgewandelt' });
    },
    onError: () => {
      toast({ title: 'Fehler', description: 'Umwandlung fehlgeschlagen', variant: 'destructive' });
    },
  });

  const toggleCustomerStatusMutation = useMutation({
    mutationFn: async ({ kundenId, currentStatus }: { kundenId: string; currentStatus: boolean }) => {
      const { error } = await supabase.from('kunden').update({ aktiv: !currentStatus }).eq('id', kundenId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: 'Erfolg',
        description: variables.currentStatus ? 'Kunde wurde deaktiviert' : 'Kunde wurde aktiviert',
      });
    },
    onError: () => {
      toast({ title: 'Fehler', description: 'Status konnte nicht geändert werden', variant: 'destructive' });
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (kundenId: string) => {
      await supabase.from('dokumente').delete().eq('kunden_id', kundenId);
      await supabase.from('termine').delete().eq('kunden_id', kundenId);
      await supabase.from('kunden_zeitfenster').delete().eq('kunden_id', kundenId);
      const { error } = await supabase.from('kunden').delete().eq('id', kundenId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Erfolg', description: 'Kunde wurde erfolgreich gelöscht' });
    },
    onError: () => {
      toast({ title: 'Fehler', description: 'Kunde konnte nicht gelöscht werden', variant: 'destructive' });
    },
  });

  return {
    updateCustomerMutation,
    convertToCustomerMutation,
    toggleCustomerStatusMutation,
    deleteCustomerMutation,
  };
}
