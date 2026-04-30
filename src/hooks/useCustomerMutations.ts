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
      // 1. termin_aenderungen – FK auf termin_id UND kunden_id (muss vor termine gelöscht werden)
      const { error: terminAenderungenError } = await supabase
        .from('termin_aenderungen')
        .delete()
        .or(`new_kunden_id.eq.${kundenId},old_kunden_id.eq.${kundenId}`);
      if (terminAenderungenError) throw terminAenderungenError;

      // 2. rechnungspositionen – FK auf kunden_id UND termin_id
      const { error: rPosError } = await supabase.from('rechnungspositionen').delete().eq('kunden_id', kundenId);
      if (rPosError) throw rPosError;

      // 3. leistungsnachweise – FK auf kunden_id
      const { error: leistungsnachweiseError } = await supabase.from('leistungsnachweise').delete().eq('kunden_id', kundenId);
      if (leistungsnachweiseError) throw leistungsnachweiseError;

      // 4. budget_transactions – FK auf client_id (= kunden.id)
      const { error: budgetError } = await supabase.from('budget_transactions').delete().eq('client_id', kundenId);
      if (budgetError) throw budgetError;

      // 4b. budget_manuelle_eintraege – FK auf kunden_id (ON DELETE CASCADE, aber explizit für Konsistenz)
      const { error: budgetManuelleError } = await supabase.from('budget_manuelle_eintraege').delete().eq('kunden_id', kundenId);
      if (budgetManuelleError) throw budgetManuelleError;

      // 5. leistungen – FK auf kunden_id
      const { error: leistungenError } = await supabase.from('leistungen').delete().eq('kunden_id', kundenId);
      if (leistungenError) throw leistungenError;

      // 6. notfallkontakte – FK auf kunden_id
      const { error: notfallkontakteError } = await supabase.from('notfallkontakte').delete().eq('kunden_id', kundenId);
      if (notfallkontakteError) throw notfallkontakteError;

      // 7. dokumente – FK auf kunden_id
      const { error: dokumenteError } = await supabase.from('dokumente').delete().eq('kunden_id', kundenId);
      if (dokumenteError) throw dokumenteError;

      // 8. termin_vorlagen – FK auf kunden_id (muss vor termine gelöscht werden)
      const { error: vorlagenError } = await supabase.from('termin_vorlagen').delete().eq('kunden_id', kundenId);
      if (vorlagenError) throw vorlagenError;

      // 9. termine – FK auf kunden_id
      const { error: termineError } = await supabase.from('termine').delete().eq('kunden_id', kundenId);
      if (termineError) throw termineError;

      // 10. kunden_zeitfenster – FK auf kunden_id
      const { error: zeitfensterError } = await supabase.from('kunden_zeitfenster').delete().eq('kunden_id', kundenId);
      if (zeitfensterError) throw zeitfensterError;

      // 11. kunden – letzter Schritt
      const { error } = await supabase.from('kunden').delete().eq('id', kundenId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Kunde wurde erfolgreich gelöscht');
    },
    onError: (error: Error) => {
      console.error('[deleteCustomer]', error);
      toast.error('Kunde konnte nicht gelöscht werden');
    },
  });

  const bulkDeleteCustomersMutation = useMutation({
    mutationFn: async (kundenIds: string[]) => {
      const BATCH = 50;
      const chunks: string[][] = [];
      for (let i = 0; i < kundenIds.length; i += BATCH) {
        chunks.push(kundenIds.slice(i, i + BATCH));
      }

      for (const chunk of chunks) {
        // 1. termin_aenderungen – FK auf termin_id UND kunden_id
        const { error: terminAenderungenNewError } = await supabase
          .from('termin_aenderungen')
          .delete()
          .in('new_kunden_id', chunk);
        if (terminAenderungenNewError) throw terminAenderungenNewError;
        const { error: terminAenderungenOldError } = await supabase
          .from('termin_aenderungen')
          .delete()
          .in('old_kunden_id', chunk);
        if (terminAenderungenOldError) throw terminAenderungenOldError;

        // 2. rechnungspositionen – FK auf kunden_id UND termin_id
        const { error: rPosError } = await supabase.from('rechnungspositionen').delete().in('kunden_id', chunk);
        if (rPosError) throw rPosError;

        // 3. leistungsnachweise – FK auf kunden_id
        const { error: leistungsnachweiseError } = await supabase.from('leistungsnachweise').delete().in('kunden_id', chunk);
        if (leistungsnachweiseError) throw leistungsnachweiseError;

        // 4. budget_transactions – FK auf client_id (= kunden.id)
        const { error: budgetError } = await supabase.from('budget_transactions').delete().in('client_id', chunk);
        if (budgetError) throw budgetError;

        // 4b. budget_manuelle_eintraege – FK auf kunden_id (ON DELETE CASCADE, aber explizit für Konsistenz)
        const { error: budgetManuelleError } = await supabase.from('budget_manuelle_eintraege').delete().in('kunden_id', chunk);
        if (budgetManuelleError) throw budgetManuelleError;

        // 5. leistungen – FK auf kunden_id
        const { error: leistungenError } = await supabase.from('leistungen').delete().in('kunden_id', chunk);
        if (leistungenError) throw leistungenError;

        // 6. notfallkontakte – FK auf kunden_id
        const { error: notfallkontakteError } = await supabase.from('notfallkontakte').delete().in('kunden_id', chunk);
        if (notfallkontakteError) throw notfallkontakteError;

        // 7. dokumente – FK auf kunden_id
        const { error: dokumenteError } = await supabase.from('dokumente').delete().in('kunden_id', chunk);
        if (dokumenteError) throw dokumenteError;

        // 8. termin_vorlagen – FK auf kunden_id
        const { error: vorlagenError } = await supabase.from('termin_vorlagen').delete().in('kunden_id', chunk);
        if (vorlagenError) throw vorlagenError;

        // 9. termine – FK auf kunden_id
        const { error: termineError } = await supabase.from('termine').delete().in('kunden_id', chunk);
        if (termineError) throw termineError;

        // 10. kunden_zeitfenster – FK auf kunden_id
        const { error: zeitfensterError } = await supabase.from('kunden_zeitfenster').delete().in('kunden_id', chunk);
        if (zeitfensterError) throw zeitfensterError;

        // 11. kunden – letzter Schritt
        const { error } = await supabase.from('kunden').delete().in('id', chunk);
        if (error) throw error;
      }
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(`${ids.length} Kunden wurden erfolgreich gelöscht`);
    },
    onError: (error: Error) => {
      console.error('[bulkDeleteCustomers]', error);
      toast.error('Kunden konnten nicht gelöscht werden', { description: error.message });
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
