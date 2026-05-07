import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  aggregateConsumed,
  buildAvailability,
  assignTransactionTypes,
  calculateTransactionAmount,
} from '@/lib/pflegebudget/budgetCalculations';
import type { BudgetTransaction, ServiceType, Tariff, CareLevel } from '@/types/domain';

type KundeForAbrechnungslauf = {
  pflegegrad: number | null;
  entlastung_genehmigt?: boolean | null;
  verhinderungspflege_genehmigt?: boolean | null;
  pflegesachleistung_genehmigt?: boolean | null;
  initial_budget_entlastung?: number | null;
  budget_prioritaet?: string[] | null;
};

interface AbrechnungslaufParams {
  kundenId: string;
  monat: number;
  jahr: number;
  existingYearTransactions: BudgetTransaction[];
  kunde: KundeForAbrechnungslauf;
  tariffs: Tariff[];
  careLevels: CareLevel[];
}

export function useAbrechnungslauf() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      kundenId,
      monat,
      jahr,
      existingYearTransactions,
      kunde,
      tariffs,
      careLevels,
    }: AbrechnungslaufParams) => {
      // 1. Leistungsnachweis prüfen
      const { data: ln, error: lnError } = await supabase
        .from('leistungsnachweise')
        .select('id, status')
        .eq('kunden_id', kundenId)
        .eq('monat', monat)
        .eq('jahr', jahr)
        .maybeSingle();

      if (lnError) throw lnError;
      if (!ln) {
        throw new Error('Kein Leistungsnachweis für diesen Monat gefunden.');
      }
      if (ln.status !== 'unterschrieben' && ln.status !== 'abgeschlossen') {
        throw new Error('Der Leistungsnachweis muss unterschrieben sein, bevor der Abrechnungslauf gestartet werden kann.');
      }

      // 2. Duplikat-Prüfung
      const externalRef = `LN:${kundenId}:${jahr}-${String(monat).padStart(2, '0')}`;
      const { data: existing, error: dupError } = await supabase
        .from('budget_transactions' as never)
        .select('id')
        .eq('client_id', kundenId)
        .eq('external_ref', externalRef)
        .limit(1);

      if (dupError) throw dupError;
      if (existing && (existing as unknown[]).length > 0) {
        throw new Error('Dieser Monat wurde bereits abgerechnet. Bestehende Buchungen zuerst löschen, um erneut abzurechnen.');
      }

      // 3. Abgeschlossene Termine des Monats laden
      const monthStart = `${jahr}-${String(monat).padStart(2, '0')}-01`;
      const lastDay = new Date(jahr, monat, 0).getDate();
      const monthEnd = `${jahr}-${String(monat).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`;

      const { data: termine, error: termineError } = await supabase
        .from('termine')
        .select('id, start_at, end_at, iststunden')
        .eq('kunden_id', kundenId)
        .eq('status', 'completed')
        .gte('start_at', monthStart)
        .lte('start_at', monthEnd)
        .order('start_at', { ascending: true });

      if (termineError) throw termineError;
      if (!termine || termine.length === 0) {
        throw new Error('Keine abgeschlossenen Termine im gewählten Monat gefunden.');
      }

      // 4. Pseudo-Transaktionen für die FIFO-Berechnung aufbauen
      const pseudoTransactions: BudgetTransaction[] = termine.map((t) => {
        const hours =
          t.iststunden != null
            ? t.iststunden
            : (new Date(t.end_at).getTime() - new Date(t.start_at).getTime()) / (1000 * 60 * 60);
        return {
          id: t.id,
          client_id: kundenId,
          service_date: t.start_at.split('T')[0],
          hours: Math.max(0, Math.round(hours * 100) / 100),
          visits: 1,
          service_type: 'ENTLASTUNG' as ServiceType,
          hourly_rate: 0,
          travel_flat_total: 0,
          total_amount: 0,
          allocation_type: 'AUTO' as const,
          billed: false,
          source: 'MANUAL' as const,
          external_ref: externalRef,
          budget_id: null,
          created_at: new Date().toISOString(),
        };
      });

      // 5. Verfügbarkeit berechnen (aus abgerechneten Jahrestransaktionen)
      const billedYearTx = existingYearTransactions.filter((tx) => tx.billed);
      const consumed = aggregateConsumed(billedYearTx, tariffs, true);

      const billedMonthKombi = billedYearTx.filter((tx) => {
        const d = new Date(tx.service_date);
        return d.getMonth() + 1 === monat && tx.service_type === 'KOMBI';
      });
      const consumedKombiMonth = aggregateConsumed(billedMonthKombi, tariffs, true).KOMBI;

      const availability = buildAvailability(
        kunde,
        consumed,
        consumedKombiMonth,
        careLevels,
        monat,
        jahr,
      );

      // 6. FIFO-Zuweisung
      const assigned = assignTransactionTypes(pseudoTransactions, kunde, availability, tariffs);

      // 7. Insert-Daten aufbauen (1 Zeile pro Termin, bei Split 1 Zeile pro Teilbetrag)
      const inserts: object[] = [];

      for (const tx of assigned) {
        if (tx.splitAllocations && tx.splitAllocations.length > 1) {
          const totalSplitAmount = tx.splitAllocations.reduce((s, a) => s + a.amount, 0);
          tx.splitAllocations.forEach((alloc, idx) => {
            const fraction = totalSplitAmount > 0 ? alloc.amount / totalSplitAmount : 1 / tx.splitAllocations!.length;
            const splitHours = Math.round(tx.hours * fraction * 100) / 100;
            const { hourlyRate } = calculateTransactionAmount(splitHours, 1, alloc.type, tariffs);
            inserts.push({
              client_id: kundenId,
              service_date: tx.service_date,
              hours: splitHours,
              visits: idx === 0 ? 1 : 0,
              service_type: alloc.type,
              hourly_rate: hourlyRate,
              travel_flat_total: 0,
              total_amount: Math.round(alloc.amount * 100) / 100,
              allocation_type: 'AUTO',
              billed: false,
              source: 'MANUAL',
              external_ref: externalRef,
            });
          });
        } else {
          const { hourlyRate, travelFlatTotal, totalAmount } = calculateTransactionAmount(
            tx.hours,
            tx.visits,
            tx.suggestedType,
            tariffs,
          );
          inserts.push({
            client_id: kundenId,
            service_date: tx.service_date,
            hours: tx.hours,
            visits: tx.visits,
            service_type: tx.suggestedType,
            hourly_rate: hourlyRate,
            travel_flat_total: travelFlatTotal,
            total_amount: totalAmount,
            allocation_type: 'AUTO',
            billed: false,
            source: 'MANUAL',
            external_ref: externalRef,
          });
        }
      }

      const { error: insertError } = await supabase
        .from('budget_transactions' as never)
        .insert(inserts as never[]);

      if (insertError) throw insertError;

      return inserts.length;
    },

    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['budget_transactions'] });
      toast.success(`${count} Buchung(en) erfolgreich in den Budgettracker übernommen.`);
    },

    onError: (error: Error) => {
      console.error('Abrechnungslauf Fehler:', error);
      toast.error(error.message || 'Fehler beim Abrechnungslauf');
    },
  });
}
