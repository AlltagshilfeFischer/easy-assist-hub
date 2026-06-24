import { useState, useMemo } from 'react';
import { format, startOfWeek, getWeek, addDays, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { AlertTriangle, ChevronDown, ChevronRight, Clock, MapPin, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { CalendarAppointment } from '@/types/domain';

interface Props {
  appointments: CalendarAppointment[];
  currentWeek: Date;
  onNavigateToWeek: (weekStart: Date) => void;
  onEditAppointment: (appointment: CalendarAppointment) => void;
}

interface WeekGroup {
  weekKey: string;
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  label: string;
  appointments: CalendarAppointment[];
  isCurrent: boolean;
}

export function AllOpenAppointmentsPanel({
  appointments,
  currentWeek,
  onNavigateToWeek,
  onEditAppointment,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const unassigned = useMemo(
    () => appointments.filter(a => !a.mitarbeiter_id || a.status === 'unassigned'),
    [appointments],
  );

  const currentWeekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });

  const weekGroups = useMemo((): WeekGroup[] => {
    const map = new Map<string, WeekGroup>();
    for (const appt of unassigned) {
      const ws = startOfWeek(new Date(appt.start_at), { weekStartsOn: 1 });
      const key = format(ws, 'yyyy-MM-dd');
      if (!map.has(key)) {
        const we = addDays(ws, 6);
        const wn = getWeek(ws, { locale: de, weekStartsOn: 1 });
        map.set(key, {
          weekKey: key,
          weekNumber: wn,
          weekStart: ws,
          weekEnd: we,
          label: `KW ${wn}`,
          appointments: [],
          isCurrent: isSameDay(ws, currentWeekStart),
        });
      }
      map.get(key)!.appointments.push(appt);
    }
    return Array.from(map.values()).sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  }, [unassigned, currentWeekStart]);

  // Weeks OTHER than current that have unassigned appointments
  const otherWeeks = weekGroups.filter(g => !g.isCurrent);
  const currentWeekGroup = weekGroups.find(g => g.isCurrent);

  // Total across all weeks
  const total = unassigned.length;
  // Count only from future/other weeks (not current, which is already visible in calendar)
  const otherCount = otherWeeks.reduce((s, g) => s + g.appointments.length, 0);

  if (total === 0) return null;

  return (
    <div className="flex-shrink-0 rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden shadow-sm">
      {/* Header — always visible, click to toggle */}
      <button
        type="button"
        onClick={() => setExpanded(p => !p)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
          'bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/60',
        )}
      >
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        }
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
          Offene Termine
        </span>
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 h-4 bg-amber-200/70 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200 border-0"
        >
          {total}
        </Badge>

        {/* Week chips — shown collapsed as quick overview */}
        {!expanded && weekGroups.length > 0 && (
          <div className="flex items-center gap-1 ml-1 flex-wrap">
            {weekGroups.map(g => (
              <span
                key={g.weekKey}
                className={cn(
                  'inline-flex items-center rounded px-1.5 py-0 text-[10px] font-medium h-4',
                  g.isCurrent
                    ? 'bg-amber-300/70 dark:bg-amber-700/60 text-amber-900 dark:text-amber-100'
                    : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
                )}
              >
                {g.label} · {g.appointments.length}
              </span>
            ))}
          </div>
        )}

        <span className="ml-auto text-[10px] text-amber-600/70 dark:text-amber-400/70 shrink-0">
          {expanded ? 'Einklappen' : 'Aufklappen'}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="bg-amber-50/50 dark:bg-amber-950/20 border-t border-amber-200 dark:border-amber-800">
          {otherCount === 0 && !currentWeekGroup && (
            <p className="text-xs text-muted-foreground px-4 py-2">Keine weiteren offenen Termine.</p>
          )}

          {weekGroups.map(group => (
            <div key={group.weekKey} className={cn(
              'border-b border-amber-200/60 dark:border-amber-800/40 last:border-b-0',
              group.isCurrent && 'bg-amber-100/60 dark:bg-amber-900/20',
            )}>
              {/* Week header row */}
              <div className="flex items-center gap-2 px-3 py-1.5">
                <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                  {group.label}
                </span>
                <span className="text-[10px] text-amber-600/70 dark:text-amber-400/70">
                  {format(group.weekStart, 'dd.MM.', { locale: de })}–{format(group.weekEnd, 'dd.MM.yyyy', { locale: de })}
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1 py-0 h-3.5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                >
                  {group.appointments.length}
                </Badge>
                {group.isCurrent ? (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 italic ml-1">
                    aktuelle Woche — Offen-Zeile im Kalender
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-6 text-[11px] px-2 gap-1 text-amber-700 dark:text-amber-300 hover:bg-amber-200/60 dark:hover:bg-amber-800/40"
                    onClick={() => {
                      onNavigateToWeek(group.weekStart);
                      setExpanded(false);
                    }}
                  >
                    Zur Woche wechseln
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Appointment cards — horizontal scroll */}
              <ScrollArea className="w-full pb-1">
                <div className="flex gap-1.5 px-3 pb-2">
                  {group.appointments.map(appt => {
                    const color = (appt.customer as any)?.farbe_kalender ?? '#10B981';
                    const name = (appt.customer as any)
                      ? [(appt.customer as any).nachname, (appt.customer as any).vorname].filter(Boolean).join(', ') || (appt.customer as any).name
                      : appt.titel;
                    const startDate = new Date(appt.start_at);
                    const endDate = new Date(appt.end_at);

                    return (
                      <button
                        key={appt.id}
                        type="button"
                        onClick={() => onEditAppointment(appt)}
                        className={cn(
                          'flex-shrink-0 w-44 text-left rounded-md border p-2 text-xs',
                          'bg-card hover:shadow-md transition-all cursor-pointer',
                          'border-border hover:border-amber-400',
                        )}
                      >
                        <div className="flex items-start gap-1.5">
                          <div
                            className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate text-[11px] leading-tight">{name}</div>
                            <div className="flex items-center gap-0.5 mt-0.5 text-[10px] text-muted-foreground">
                              <Clock className="h-2.5 w-2.5" />
                              {format(startDate, 'EEE dd.MM.', { locale: de })} · {format(startDate, 'HH:mm')}–{format(endDate, 'HH:mm')}
                            </div>
                            {(appt.customer as any)?.stadtteil && (
                              <div className="flex items-center gap-0.5 mt-0.5 text-[10px] text-muted-foreground">
                                <MapPin className="h-2.5 w-2.5" />
                                {(appt.customer as any).stadtteil}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
