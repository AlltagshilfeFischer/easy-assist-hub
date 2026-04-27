import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Clock, ChevronDown, ChevronRight, MessageSquare, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface AppointmentHistorySectionProps {
  terminId: string;
}

interface AuditEntry {
  id: string;
  operation: string;
  changed_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

interface ChangeEntry {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  requires_approval: boolean;
  reason: string | null;
  old_start_at: string | null;
  new_start_at: string | null;
  old_end_at: string | null;
  new_end_at: string | null;
  created_at: string;
  requester: { vorname: string | null; nachname: string | null } | null;
}

function ChangeStatusBadge({ status, requiresApproval }: { status: string; requiresApproval: boolean }) {
  if (status === 'approved' && !requiresApproval) {
    return (
      <Badge className="text-[10px] py-0 h-4 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">
        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Dokumentiert
      </Badge>
    );
  }
  if (status === 'approved') {
    return (
      <Badge className="text-[10px] py-0 h-4 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Genehmigt
      </Badge>
    );
  }
  if (status === 'rejected') {
    return (
      <Badge className="text-[10px] py-0 h-4 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">
        <XCircle className="h-2.5 w-2.5 mr-0.5" /> Abgelehnt
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px] py-0 h-4 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">
      <AlertCircle className="h-2.5 w-2.5 mr-0.5" /> Ausstehend
    </Badge>
  );
}

export function AppointmentHistorySection({ terminId }: AppointmentHistorySectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: auditHistory, isLoading: auditLoading } = useQuery({
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
      return (data as AuditEntry[]) || [];
    },
    staleTime: 30_000,
    enabled: isOpen,
  });

  const { data: changeHistory, isLoading: changeLoading } = useQuery({
    queryKey: ['termin-changes', terminId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('termin_aenderungen')
        .select(`
          id, status, requires_approval, reason,
          old_start_at, new_start_at, old_end_at, new_end_at,
          created_at,
          requester:benutzer!termin_aenderungen_requested_by_fkey(vorname, nachname)
        `)
        .eq('termin_id', terminId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as ChangeEntry[]) || [];
    },
    staleTime: 30_000,
    enabled: isOpen,
  });

  const isLoading = auditLoading || changeLoading;
  const totalCount = (auditHistory?.length ?? 0) + (changeHistory?.length ?? 0);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span>Verlauf anzeigen</span>
        {!isOpen && totalCount > 0 && (
          <span className="text-[11px] text-muted-foreground">({totalCount})</span>
        )}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-3">
          {isLoading && (
            <p className="text-xs text-muted-foreground py-1">Lade Verlauf…</p>
          )}

          {!isLoading && totalCount === 0 && (
            <p className="text-xs text-muted-foreground py-1 italic">Noch keine Änderungen protokolliert.</p>
          )}

          {/* Terminänderungen mit Kommentar */}
          {!isLoading && changeHistory && changeHistory.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Verschiebungen</p>
              <div className="space-y-2">
                {changeHistory.map((entry) => {
                  const requesterName = entry.requester
                    ? [entry.requester.vorname, entry.requester.nachname].filter(Boolean).join(' ')
                    : 'Unbekannt';
                  return (
                    <div key={entry.id} className="rounded-md border bg-muted/30 p-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="text-[11px] font-medium truncate">{requesterName}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                            {format(new Date(entry.created_at), 'dd.MM.yy HH:mm', { locale: de })}
                          </span>
                        </div>
                        <ChangeStatusBadge status={entry.status} requiresApproval={entry.requires_approval ?? true} />
                      </div>
                      {entry.old_start_at && entry.new_start_at && (
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(entry.old_start_at), 'dd.MM. HH:mm', { locale: de })}
                          {' → '}
                          {format(new Date(entry.new_start_at), 'dd.MM. HH:mm', { locale: de })}
                        </p>
                      )}
                      {entry.reason && (
                        <p className="text-[11px] text-foreground/80 italic">„{entry.reason}"</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Audit-Log */}
          {!isLoading && auditHistory && auditHistory.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">System-Protokoll</p>
              <div className="space-y-1.5">
                {auditHistory.map((entry) => (
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
