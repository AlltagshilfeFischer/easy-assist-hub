import type { TerminBudgetAllocation } from '@/lib/pflegebudget/budgetCalculations';
import type { ServiceType } from '@/types/domain';

type BillableServiceType = Exclude<ServiceType, 'PRIVAT' | 'HAUSHALTSHILFE'>;

export interface BudgetTransactionRow {
  client_id: string;
  service_date: string;
  hours: number;
  visits: number;
  service_type: BillableServiceType;
  hourly_rate: number;
  travel_flat_total: number;
  total_amount: number;
  allocation_type: 'AUTO';
  source: 'MANUAL';
  billed: true;
}

export function buildBudgetTransactionRows(
  kundenId: string,
  allocations: TerminBudgetAllocation[],
): BudgetTransactionRow[] {
  return allocations.flatMap((allocation) => {
    if (
      allocation.hours <= 0 ||
      allocation.totalAmount <= 0 ||
      allocation.serviceType === 'HAUSHALTSHILFE' ||
      allocation.serviceType === 'PRIVAT'
    ) {
      return [];
    }

    if (allocation.splitAllocations && allocation.splitAllocations.length > 1) {
      return allocation.splitAllocations
        .filter(
          (split): split is typeof split & { type: BillableServiceType } =>
            split.type !== 'HAUSHALTSHILFE' &&
            split.type !== 'PRIVAT' &&
            split.amount > 0,
        )
        .map((split, index) => ({
          client_id: kundenId,
          service_date: allocation.serviceDate,
          hours: allocation.hours * (split.amount / allocation.totalAmount),
          visits: 1,
          service_type: split.type,
          hourly_rate: allocation.hourlyRate,
          travel_flat_total: index === 0 ? allocation.travelFlatTotal : 0,
          total_amount: split.amount,
          allocation_type: 'AUTO' as const,
          source: 'MANUAL' as const,
          billed: true as const,
        }));
    }

    return [{
      client_id: kundenId,
      service_date: allocation.serviceDate,
      hours: allocation.hours,
      visits: 1,
      service_type: allocation.serviceType,
      hourly_rate: allocation.hourlyRate,
      travel_flat_total: allocation.travelFlatTotal,
      total_amount: allocation.totalAmount,
      allocation_type: 'AUTO' as const,
      source: 'MANUAL' as const,
      billed: true as const,
    }];
  });
}
