import React from 'react';
import { format, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { AlertTriangle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useDroppable } from '@dnd-kit/core';
import { DraggableAppointment } from './DraggableAppointment';
import type { CalendarAppointment } from '@/types/domain';

interface UnassignedAppointmentsBarProps {
  appointments: CalendarAppointment[];
  weekDates: Date[];
  activeId: string | null;
  onEditAppointment: (appointment: CalendarAppointment) => void;
  onCut?: (appointment: CalendarAppointment) => void;
  onCopy?: (appointment: CalendarAppointment) => void;
  onSlotClick?: (date: Date) => void;
  viewMode?: 'day' | 'week' | 'month';
  currentDay?: Date;
}

/**
 * Einzige Drop-Zone für unzugeordnete Termine.
 * Drop-ID: "unassigned" — ScheduleBuilderModern erkennt das und setzt nur mitarbeiter_id = null.
 * Kein Grid, kein Datums-Mapping — eine einfache Liste aller offenen Termine.
 */
export function UnassignedAppointmentsBar({
  appointments,
  activeId,
  onEditAppointment,
  onCut,
  onCopy,
}: UnassignedAppointmentsBarProps) {
  const unassignedAppointments = React.useMemo(() => {
    return appointments
      .filter(app => !app.mitarbeiter_id)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [appointments]);

  const totalUnassigned = unassignedAppointments.length;

  // Eine einzige Drop-Zone für den gesamten Bereich
  const { setNodeRef, isOver } = useDroppable({ id: 'unassigned' });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "bg-muted/30 border-b shadow-sm transition-colors",
        isOver && "bg-amber-50 dark:bg-amber-950/30 border-amber-300"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-background border-b">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        <div className="text-xs font-semibold">Unzugeordnet</div>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{totalUnassigned}</Badge>
        {isOver && (
          <span className="text-xs text-amber-600 dark:text-amber-400 ml-2 animate-pulse">
            Hier ablegen → Mitarbeiter entfernen
          </span>
        )}
      </div>

      {/* Termine — horizontal scrollbar */}
      {totalUnassigned > 0 ? (
        <ScrollArea className="w-full">
          <div className="flex gap-2 p-2 min-h-[56px]">
            {unassignedAppointments.map((appointment) => (
              <div key={appointment.id} className="flex-shrink-0 w-44">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5 px-1">
                  <Clock className="h-2.5 w-2.5" />
                  {format(new Date(appointment.start_at), 'EEE dd.MM. HH:mm', { locale: de })}
                </div>
                <DraggableAppointment
                  appointment={appointment}
                  isDragging={activeId === appointment.id}
                  isConflicting={false}
                  onClick={() => onEditAppointment(appointment)}
                  onCut={() => onCut?.(appointment)}
                  onCopy={() => onCopy?.(appointment)}
                />
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      ) : (
        <div className={cn(
          "min-h-[40px] flex items-center justify-center text-xs text-muted-foreground/50 mx-2 my-1.5 rounded-lg border-2 border-dashed border-muted-foreground/20 transition-colors",
          isOver && "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 text-amber-600"
        )}>
          {isOver ? 'Loslassen zum Entfernen der Zuordnung' : 'Keine unzugeordneten Termine'}
        </div>
      )}
    </div>
  );
}
