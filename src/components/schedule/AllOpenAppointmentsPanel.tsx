import { useState, useMemo } from 'react';
import { format, startOfWeek, getWeek, addDays, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  AlertTriangle, ChevronLeft, ChevronRight, Clock, MapPin, ArrowRight, CalendarClock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { DraggableAppointment } from './DraggableAppointment';
import type { CalendarAppointment } from '@/types/domain';

interface Props {
  /** All appointments (full list, not filtered to current week) */
  appointments: CalendarAppointment[];
  currentWeek: Date;
  activeId: string | null;
  onNavigateToWeek: (weekStart: Date) => void;
  onEditAppointment: (appointment: CalendarAppointment) => void;
  onCut?: (appointment: CalendarAppointment) => void;
  onCopy?: (appointment: CalendarAppointment) => void;
}

interface WeekGroup {
  weekKey: string;
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  appointments: CalendarAppointment[];
  isCurrent: boolean;
}

export function AllOpenAppointmentsPanel({
  appointments,
  currentWeek,
  activeId,
  onNavigateToWeek,
  onEditAppointment,
  onCut,
  onCopy,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const currentWeekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });

  // All unassigned — but EXCLUDE current week (those are already in the Offen-Zeile
  // of the calendar and share the same DnD context → same id would conflict)
  const otherWeekUnassigned = useMemo(
    () =>
      appointments.filter(a => {
        const isUnassigned = !a.mitarbeiter_id || a.status === 'unassigned';
        if (!isUnassigned) return false;
        // exclude current week
        const d = new Date(a.start_at);
        const ws = startOfWeek(d, { weekStartsOn: 1 });
        return ws.getTime() !== currentWeekStart.getTime();
      }),
    [appointments, currentWeekStart],
  );

  const weekGroups = useMemo((): WeekGroup[] => {
    const map = new Map<string, WeekGroup>();
    for (const appt of otherWeekUnassigned) {
      const ws = startOfWeek(new Date(appt.start_at), { weekStartsOn: 1 });
      const key = format(ws, 'yyyy-MM-dd');
      if (!map.has(key)) {
        map.set(key, {
          weekKey: key,
          weekNumber: getWeek(ws, { locale: de, weekStartsOn: 1 }),
          weekStart: ws,
          weekEnd: addDays(ws, 6),
          appointments: [],
          isCurrent: isSameDay(ws, currentWeekStart),
        });
      }
      map.get(key)!.appointments.push(appt);
    }
    return Array.from(map.values()).sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  }, [otherWeekUnassigned, currentWeekStart]);

  // Current-week unassigned count (shown in Offen-Zeile of calendar)
  const currentWeekCount = useMemo(
    () =>
      appointments.filter(a => {
        const isUnassigned = !a.mitarbeiter_id || a.status === 'unassigned';
        if (!isUnassigned) return false;
        const d = new Date(a.start_at);
        const ws = startOfWeek(d, { weekStartsOn: 1 });
        return ws.getTime() === currentWeekStart.getTime();
      }).length,
    [appointments, currentWeekStart],
  );

  const totalOther = otherWeekUnassigned.length;
  const grandTotal = totalOther + currentWeekCount;

  // Don't render if nothing to show
  if (grandTotal === 0) return null;

  // ── Collapsed strip ──────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="flex-shrink-0 w-10 flex flex-col items-center rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 py-3 gap-3">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex flex-col items-center gap-1 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
          title="Offene Termine aufklappen"
        >
          <AlertTriangle className="h-4 w-4" />
          <Badge
            variant="secondary"
            className="text-[10px] px-1 py-0 h-4 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 border-0 min-w-[1.25rem] justify-center"
          >
            {grandTotal}
          </Badge>
          <ChevronRight className="h-3.5 w-3.5 mt-1" />
        </button>
      </div>
    );
  }

  // ── Expanded panel ───────────────────────────────────────────────────────────
  return (
    <div className="flex-shrink-0 w-64 flex flex-col rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-100/70 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-800 flex-shrink-0">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex-1">
          Offen
        </span>
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 h-4 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 border-0"
        >
          {grandTotal}
        </Badge>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
          title="Einklappen"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">

          {/* Current week hint */}
          {currentWeekCount > 0 && (
            <div className="rounded-md border border-amber-300/60 dark:border-amber-700/50 bg-amber-100/50 dark:bg-amber-900/30 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-300">
              <div className="flex items-center gap-1.5 font-semibold mb-0.5">
                <CalendarClock className="h-3 w-3" />
                KW {getWeek(currentWeekStart, { locale: de, weekStartsOn: 1 })} · aktuelle Woche
              </div>
              <span className="text-amber-600/80 dark:text-amber-400/80">
                {currentWeekCount} Termin{currentWeekCount !== 1 ? 'e' : ''} in der Offen-Zeile des Kalenders — direkt reinziehen
              </span>
            </div>
          )}

          {/* Other weeks */}
          {weekGroups.length === 0 && (
            <p className="text-[11px] text-amber-600/70 dark:text-amber-400/70 px-1 pt-1">
              Keine weiteren offenen Termine.
            </p>
          )}

          {weekGroups.map(group => (
            <div key={group.weekKey}>
              {/* Week header */}
              <div className="flex items-center gap-1 mb-1.5 px-0.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                      KW {group.weekNumber}
                    </span>
                    <span className="text-[10px] text-amber-600/70 dark:text-amber-400/70">
                      {format(group.weekStart, 'dd.', { locale: de })}–{format(group.weekEnd, 'dd.MM.', { locale: de })}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 h-3.5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                    >
                      {group.appointments.length}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] px-1.5 gap-0.5 text-amber-700 dark:text-amber-300 hover:bg-amber-200/60 dark:hover:bg-amber-800/40 shrink-0"
                  onClick={() => onNavigateToWeek(group.weekStart)}
                  title={`Zu KW ${group.weekNumber} wechseln`}
                >
                  Zur Woche
                  <ArrowRight className="h-2.5 w-2.5" />
                </Button>
              </div>

              {/* Appointment cards — stacked vertically, draggable */}
              <div className="space-y-1">
                {group.appointments.map(appt => (
                  <div key={appt.id} className="flex flex-col">
                    {/* Date label */}
                    <div className="flex items-center gap-0.5 text-[9px] text-amber-700/70 dark:text-amber-400/70 mb-0.5 px-0.5">
                      <Clock className="h-2 w-2" />
                      {format(new Date(appt.start_at), 'EEE dd.MM. · HH:mm', { locale: de })}
                      {(appt.customer as any)?.stadtteil && (
                        <>
                          <MapPin className="h-2 w-2 ml-1" />
                          {(appt.customer as any).stadtteil}
                        </>
                      )}
                    </div>
                    <DraggableAppointment
                      appointment={appt}
                      isDragging={activeId === appt.id}
                      isConflicting={false}
                      onClick={() => onEditAppointment(appt)}
                      onCut={() => onCut?.(appt)}
                      onCopy={() => onCopy?.(appt)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer hint */}
      {totalOther > 0 && (
        <div className="flex-shrink-0 border-t border-amber-200 dark:border-amber-800 px-2.5 py-1.5 bg-amber-100/50 dark:bg-amber-900/30">
          <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 leading-tight">
            Termin in Kalender ziehen → Datum wechselt auf den Ziel-Tag + MA wird zugewiesen
          </p>
        </div>
      )}
    </div>
  );
}
