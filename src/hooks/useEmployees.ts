import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Employee } from '@/types/domain';

/**
 * Fetches all active, bookable employees with their benutzer relation.
 */
export function useEmployees(options?: { includeInactive?: boolean }) {
  return useQuery({
    queryKey: ['employees', { includeInactive: options?.includeInactive }],
    queryFn: async (): Promise<Employee[]> => {
      let query = supabase
        .from('mitarbeiter')
        .select(`
          id, vorname, nachname, telefon, ist_aktiv, max_termine_pro_tag,
          farbe_kalender, soll_wochenstunden, qualification, employment_type,
          is_bookable, hourly_rate, avatar_url, benutzer_id, strasse, plz, stadt,
          zustaendigkeitsbereich,
          benutzer(email, vorname, nachname)
        `)
        .order('vorname');

      if (!options?.includeInactive) {
        query = query.eq('ist_aktiv', true);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((emp) => {
        const b = emp.benutzer as unknown as { email: string; vorname: string; nachname: string } | null;
        const fullName = b?.vorname && b?.nachname
          ? `${b.vorname} ${b.nachname}`
          : [emp.vorname, emp.nachname].filter(Boolean).join(' ') || 'Unbenannt';

        return {
          ...emp,
          name: fullName,
          farbe_kalender: emp.farbe_kalender ?? '#3B82F6',
          benutzer: b ?? undefined,
        } as Employee;
      });
    },
  });
}
