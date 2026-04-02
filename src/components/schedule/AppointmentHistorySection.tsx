import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AppointmentHistorySectionProps {
  terminId: string;
}

export function AppointmentHistorySection({ terminId }: AppointmentHistorySectionProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['termin-history', terminId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, operation, changed_at, old_data, new_data')
        .eq('table_name', 'termine')
        .eq('row_id', terminId)
        .order('changed_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return <p className="text-xs text-muted-foreground py-1">Lade Verlauf…</p>;
  }

  if (!history?.length) {
    return <p className="text-xs text-muted-foreground py-1 italic">Noch keine Änderungen protokolliert.</p>;
  }

  return (
    <div className="space-y-1.5">
      {history.map((entry) => (
        <div key={entry.id} className="flex items-start gap-2">
          <Clock className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-foreground">{entry.operation}</span>
            <span className="text-[11px] text-muted-foreground ml-2 tabular-nums">
              {format(new Date(entry.changed_at), 'dd.MM.yy HH:mm', { locale: de })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
