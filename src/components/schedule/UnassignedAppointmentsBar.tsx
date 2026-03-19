import React from 'react';
import { format, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DraggableAppointment } from './DraggableAppointment';
import { EnhancedDropZone } from './EnhancedDropZone';
import { EMPLOYEE_COL_WIDTH } from './gridConfig';
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

export function UnassignedAppointmentsBar({
  appointments,
  weekDates,
  activeId,
  onEditAppointment,
  onCut,
  onCopy,
  onSlotClick,
  viewMode = 'week',
  currentDay,
}: UnassignedAppointmentsBarProps) {
  const filteredUnassignedAppointments = React.useMemo(() => {
    const now = new Date();
    return appointments.filter(app => {
      if (app.mitarbeiter_id) return false;
      const appointmentDate = new Date(app.start_at);
      return appointmentDate > now || isSameDay(appointmentDate, now);
    });
  }, [appointments]);

  const groupedAppointments = React.useMemo(() => {
    const groups: { [key: string]: CalendarAppointment[] } = {};
    filteredUnassignedAppointments.forEach(appointment => {
      const dateKey = format(new Date(appointment.start_at), 'yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(appointment);
    });
    return groups;
  }, [filteredUnassignedAppointments]);

  const totalUnassigned = filteredUnassignedAppointments.length;

  return (
    <div className="bg-muted/30 border-b shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-background border-b">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <div className="text-sm font-semibold">Unzugeordnete Termine</div>
        <Badge variant="secondary" className="text-xs">{totalUnassigned}</Badge>
        <div className="text-xs text-muted-foreground ml-auto">
          Hier ablegen zum Entfernen der Zuordnung
        </div>
      </div>

      {/* View-abhängiges Layout */}
      {viewMode === 'week' && (
        <WeekLayout
          weekDates={weekDates}
          groupedAppointments={groupedAppointments}
          activeId={activeId}
          onEditAppointment={onEditAppointment}
          onCut={onCut}
          onSlotClick={onSlotClick}
        />
      )}

      {viewMode === 'day' && currentDay && (
        <DayLayout
          currentDay={currentDay}
          groupedAppointments={groupedAppointments}
          activeId={activeId}
          onEditAppointment={onEditAppointment}
          onCut={onCut}
          onSlotClick={onSlotClick}
        />
      )}

      {viewMode === 'month' && (
        <MonthLayout
          allAppointments={filteredUnassignedAppointments}
          activeId={activeId}
          onEditAppointment={onEditAppointment}
          onCut={onCut}
        />
      )}
    </div>
  );
}

/* ── Week Layout: 7-Spalten-Grid wie bisher ── */
function WeekLayout({
  weekDates, groupedAppointments, activeId, onEditAppointment, onCut, onSlotClick,
}: {
  weekDates: Date[];
  groupedAppointments: Record<string, CalendarAppointment[]>;
  activeId: string | null;
  onEditAppointment: (app: CalendarAppointment) => void;
  onCut?: (app: CalendarAppointment) => void;
  onSlotClick?: (date: Date) => void;
}) {
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `${EMPLOYEE_COL_WIDTH}px repeat(7, 1fr)` }}
    >
      <div className="border-r bg-card" />
      {weekDates.map((date) => {
        const dateKey = format(date, 'yyyy-MM-dd');
        const dayAppointments = groupedAppointments[dateKey] || [];
        const isToday = isSameDay(date, new Date());
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;

        return (
          <div key={dateKey} className={cn("p-2 border-r last:border-r-0", isToday && "bg-primary/5", isWeekend && "bg-muted/30")}>
            <EnhancedDropZone
              id={`unassigned-${dateKey}`}
              isEmpty={dayAppointments.length === 0}
              onClick={() => onSlotClick?.(date)}
              className={cn(
                "min-h-[64px] space-y-1",
                dayAppointments.length === 0 && "border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
              )}
            >
              {dayAppointments.length === 0 ? (
                <div className="text-xs text-muted-foreground/50 text-center">Drop hier</div>
              ) : (
                dayAppointments.map((appointment) => (
                  <DraggableAppointment
                    key={appointment.id}
                    appointment={appointment}
                    isDragging={activeId === appointment.id}
                    isConflicting={false}
                    onClick={() => onEditAppointment(appointment)}
                    onCut={() => onCut?.(appointment)}
                  />
                ))
              )}
            </EnhancedDropZone>
          </div>
        );
      })}
    </div>
  );
}

/* ── Day Layout: eine Spalte für den aktuellen Tag ── */
function DayLayout({
  currentDay, groupedAppointments, activeId, onEditAppointment, onCut, onSlotClick,
}: {
  currentDay: Date;
  groupedAppointments: Record<string, CalendarAppointment[]>;
  activeId: string | null;
  onEditAppointment: (app: CalendarAppointment) => void;
  onCut?: (app: CalendarAppointment) => void;
  onSlotClick?: (date: Date) => void;
}) {
  const dateKey = format(currentDay, 'yyyy-MM-dd');
  const dayAppointments = groupedAppointments[dateKey] || [];

  return (
    <div className="p-3">
      <div className="text-xs text-muted-foreground mb-2">
        {format(currentDay, 'EEEE, dd. MMMM yyyy', { locale: de })}
      </div>
      <EnhancedDropZone
        id={`unassigned-${dateKey}`}
        isEmpty={dayAppointments.length === 0}
        onClick={() => onSlotClick?.(currentDay)}
        className={cn(
          "min-h-[48px] space-y-1",
          dayAppointments.length === 0 && "border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
        )}
      >
        {dayAppointments.length === 0 ? (
          <div className="text-xs text-muted-foreground/50 text-center">
            Keine unzugeordneten Termine für diesen Tag
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
            {dayAppointments.map((appointment) => (
              <DraggableAppointment
                key={appointment.id}
                appointment={appointment}
                isDragging={activeId === appointment.id}
                isConflicting={false}
                onClick={() => onEditAppointment(appointment)}
                onCut={() => onCut?.(appointment)}
              />
            ))}
          </div>
        )}
      </EnhancedDropZone>
    </div>
  );
}

/* ── Month Layout: kompakte horizontale Liste aller unzugeordneten ── */
function MonthLayout({
  allAppointments, activeId, onEditAppointment, onCut,
}: {
  allAppointments: CalendarAppointment[];
  activeId: string | null;
  onEditAppointment: (app: CalendarAppointment) => void;
  onCut?: (app: CalendarAppointment) => void;
}) {
  if (allAppointments.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground text-center">
        Keine unzugeordneten Termine
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {allAppointments.map((appointment) => (
          <div key={appointment.id} className="flex-shrink-0 w-40">
            <div className="text-[10px] text-muted-foreground mb-0.5 px-1">
              {format(new Date(appointment.start_at), 'EEE dd.MM.', { locale: de })}
            </div>
            <DraggableAppointment
              appointment={appointment}
              isDragging={activeId === appointment.id}
              isConflicting={false}
              onClick={() => onEditAppointment(appointment)}
              onCut={() => onCut?.(appointment)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
