import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AppointmentHistorySectionProps {
  terminId: string;
}

export function AppointmentHistorySection({ terminId }: AppointmentHistorySectionProps) {
  const [isOpen, setIsOpen] = useState(false);

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
    enabled: isOpen,
  });

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span>Verlauf anzeigen</span>
        {!isOpen && history && history.length > 0 && (
          <span className="text-[11px] text-muted-foreground">({history.length})</span>
        )}
      </button>

      {isOpen && (
        <div className="mt-2">
          {isLoading && (
            <p className="text-xs text-muted-foreground py-1">Lade Verlauf…</p>
          )}
          {!isLoading && !history?.length && (
            <p className="text-xs text-muted-foreground py-1 italic">Noch keine Änderungen protokolliert.</p>
          )}
          {!isLoading && history && history.length > 0 && (
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
          )}
        </div>
      )}
    </div>
  );
}
