import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Appointment } from '@/types/domain';
import { getWeekStart, getWeekEnd } from '@/utils/date';
import { addDays } from 'date-fns';

interface UseAppointmentsOptions {
  /** Filter to a specific week (Mon–Sun). When set, only appointments overlapping this week are returned. */
  week?: Date;
  /** Filter to a specific employee. */
  mitarbeiterId?: string;
  /** Enabled flag (default true). */
  enabled?: boolean;
}

/**
 * Fetches appointments with joined customer and employee data.
 */
export function useAppointments(options?: UseAppointmentsOptions) {
  const week = options?.week;
  const mitarbeiterId = options?.mitarbeiterId;
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: ['appointments', { week: week?.toISOString(), mitarbeiterId }],
    enabled,
    queryFn: async (): Promise<Appointment[]> => {
      let query = supabase
        .from('termine')
        .select(`
          id, titel, kunden_id, mitarbeiter_id, start_at, end_at, status,
          vorlage_id, ist_ausnahme, ausnahme_grund, notizen, iststunden, einsatzort_id,
          customer:kunden(id, name, vorname, nachname, farbe_kalender, email, telefonnr,
            geburtsdatum, pflegegrad, adresse, stadtteil, aktiv, pflegekasse,
            versichertennummer, stunden_kontingent_monat, mitarbeiter,
            angehoerige_ansprechpartner),
          employee:mitarbeiter(id, vorname, nachname, farbe_kalender, telefon, ist_aktiv,
            max_termine_pro_tag)
        `)
        .order('start_at', { ascending: true });

      if (week) {
        const weekStart = getWeekStart(week);
        const weekEnd = addDays(getWeekEnd(week), 1); // exclusive upper bound
        query = query
          .gte('start_at', weekStart.toISOString())
          .lt('start_at', weekEnd.toISOString());
      }

      if (mitarbeiterId) {
        query = query.eq('mitarbeiter_id', mitarbeiterId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((row) => {
        const cust = row.customer as any;
        const emp = row.employee as any;

        return {
          ...row,
          customer: cust
            ? {
                ...cust,
                name: cust.name ?? '',
                farbe_kalender: cust.farbe_kalender ?? '#10B981',
              }
            : undefined,
          employee: emp
            ? {
                ...emp,
                name: [emp.vorname, emp.nachname].filter(Boolean).join(' ') || 'Unbenannt',
                farbe_kalender: emp.farbe_kalender ?? '#3B82F6',
              }
            : undefined,
        } as Appointment;
      });
    },
  });
}
