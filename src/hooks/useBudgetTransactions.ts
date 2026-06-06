import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BudgetTransaction, ServiceType } from '@/types/domain';
import type { TerminBudgetAllocation } from '@/lib/pflegebudget/budgetCalculations';
import { buildBudgetTransactionRows } from '@/lib/pflegebudget/billingTransactionRows';
import { toast } from 'sonner';

type BudgetTransactionInsert = Omit<BudgetTransaction, 'id' | 'created_at'>;

// ─── Query: Transaktionen für einen Monat ────────────────────

export function useBudgetTransactionsByMonth(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return useQuery({
    queryKey: ['budget_transactions', 'month', year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_transactions' as never)
        .select('*')
        .gte('service_date', from)
        .lte('service_date', to)
        .order('service_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BudgetTransaction[];
    },
  });
}

// ─── Query: Transaktionen für einen Kunden im Jahr ──────────

export function useBudgetTransactionsByClientYear(clientId: string | undefined, year: number) {
  return useQuery({
    queryKey: ['budget_transactions', 'client', clientId, 'year', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_transactions' as never)
        .select('*')
        .eq('client_id', clientId!)
        .gte('service_date', `${year}-01-01`)
        .lte('service_date', `${year}-12-31`)
        .order('service_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BudgetTransaction[];
    },
    enabled: !!clientId,
  });
}

// ─── Query: Transaktionen für einen Kunden im Monat ─────────

export function useBudgetTransactionsByClientMonth(
  clientId: string | undefined,
  year: number,
  month: number,
) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return useQuery({
    queryKey: ['budget_transactions', 'client', clientId, 'month', year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_transactions' as never)
        .select('*')
        .eq('client_id', clientId!)
        .gte('service_date', from)
        .lte('service_date', to)
        .order('service_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BudgetTransaction[];
    },
    enabled: !!clientId,
  });
}

// ─── Query: Alle Transaktionen eines Jahres (für Budgettracker) ─

export function useBudgetTransactionsByYear(year: number) {
  return useQuery({
    queryKey: ['budget_transactions', 'year', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_transactions' as never)
        .select('*')
        .gte('service_date', `${year}-01-01`)
        .lte('service_date', `${year}-12-31`)
        .order('service_date', { ascending: true });
      // Tabelle existiert noch nicht (Migration ausstehend) → leere Liste
      if (error) {
        console.warn('budget_transactions nicht verfügbar:', error.message);
        return [] as BudgetTransaction[];
      }
      return (data ?? []) as BudgetTransaction[];
    },
  });
}

// ─── Mutation: Masseneinfügung (Aplano Import) ───────────────

export function useInsertBudgetTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transactions: BudgetTransactionInsert[]) => {
      const { data, error } = await supabase
        .from('budget_transactions' as never)
        .insert(transactions as never[])
        .select();
      if (error) throw error;
      return data as BudgetTransaction[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget_transactions'] });
    },
    onError: (error) => {
      console.error('Fehler beim Einfügen der Transaktionen:', error);
      toast.error('Fehler beim Importieren der Termine');
    },
  });
}

// ─── Mutation: Budgettopf manuell ändern ─────────────────────

export function useUpdateTransactionAllocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      serviceType,
      hourlyRate,
      travelFlatTotal,
      totalAmount,
    }: {
      id: string;
      serviceType: ServiceType;
      hourlyRate: number;
      travelFlatTotal: number;
      totalAmount: number;
    }) => {
      const { error } = await supabase
        .from('budget_transactions' as never)
        .update({
          service_type: serviceType,
          hourly_rate: hourlyRate,
          travel_flat_total: travelFlatTotal,
          total_amount: totalAmount,
          allocation_type: 'MANUAL',
        } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget_transactions'] });
      toast.success('Budgettopf geändert');
    },
    onError: (error) => {
      console.error('Fehler beim Ändern des Budgettopfs:', error);
      toast.error('Fehler beim Speichern');
    },
  });
}

// ─── Mutation: Monat abschließen (billed=true setzen) ────────

export function useCloseBillingMonth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transactionUpdates,
    }: {
      transactionUpdates: Array<{
        id: string;
        service_type: ServiceType;
        hourly_rate: number;
        travel_flat_total: number;
        total_amount: number;
      }>;
    }) => {
      // Batch-Update mit billed=true und finalen Beträgen
      for (const update of transactionUpdates) {
        const { error } = await supabase
          .from('budget_transactions' as never)
          .update({
            billed: true,
            service_type: update.service_type,
            hourly_rate: update.hourly_rate,
            travel_flat_total: update.travel_flat_total,
            total_amount: update.total_amount,
          } as never)
          .eq('id', update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget_transactions'] });
      toast.success('Monat erfolgreich abgeschlossen');
    },
    onError: (error) => {
      console.error('Fehler beim Abschließen des Monats:', error);
      toast.error('Fehler beim Abschließen');
    },
  });
}

// ─── Mutation: Monat aus BudgetTracker abschließen ────────────
// Schreibt budget_transactions (Kassentöpfe) und setzt Termine auf abgerechnet.
// Haushaltshilfe-Allokationen werden nicht in budget_transactions geschrieben
// (§38 geht zur Krankenkasse), aber die Termine werden trotzdem auf abgerechnet gesetzt.

export function useAbschliessenMonth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      kundenId,
      allocations,
    }: {
      kundenId: string;
      allocations: TerminBudgetAllocation[];
    }) => {
      // 1. budget_transactions für Kassentöpfe (kein HH, Privat oder Nullstunden)
      const txInserts = buildBudgetTransactionRows(kundenId, allocations);

      if (txInserts.length > 0) {
        const { error } = await supabase
          .from('budget_transactions' as never)
          .insert(txInserts as never[]);
        if (error) throw error;
      }

      // 2. Alle Termine (inkl. HH) auf abgerechnet setzen
      const terminIds = allocations.map((a) => a.terminId);
      if (terminIds.length > 0) {
        const { error } = await supabase
          .from('termine')
          .update({ status: 'abgerechnet' })
          .in('id', terminIds);
        if (error) throw error;
      }
    },
    onSuccess: (_, { kundenId }) => {
      queryClient.invalidateQueries({ queryKey: ['termine_budget', kundenId] });
      queryClient.invalidateQueries({ queryKey: ['termine_budget_all'] });
      queryClient.invalidateQueries({ queryKey: ['budget_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['termine'] });
      toast.success('Monat erfolgreich abgeschlossen');
    },
    onError: (error) => {
      console.error('Fehler beim Abschließen des Monats:', error);
      toast.error('Fehler beim Abschließen des Monats');
    },
  });
}
