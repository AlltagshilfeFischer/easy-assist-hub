import React from 'react';
import { format, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DraggableAppointment } from './DraggableAppointment';
import { EnhancedDropZone } from './EnhancedDropZone';
import { EMPLOYEE_COL_WIDTH } from './gridConfig';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  telefonnr: string | null;
}

interface Appointment {
  id: string;
  titel: string;
  kunden_id: string;
  mitarbeiter_id: string | null;
  start_at: string;
  end_at: string;
  customer?: Customer;
}

interface UnassignedAppointmentsBarProps {
  appointments: Appointment[];
  weekDates: Date[];
  activeId: string | null;
  onEditAppointment: (appointment: Appointment) => void;
  onCut?: (appointment: Appointment) => void;
  onSlotClick?: (date: Date) => void;
}

export function UnassignedAppointmentsBar({
  appointments,
  weekDates,
  activeId,
  onEditAppointment,
  onCut,
  onSlotClick
}: UnassignedAppointmentsBarProps) {
  // Filter unassigned appointments for future + current month only
  const filteredUnassignedAppointments = React.useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return appointments.filter(app => {
      if (app.mitarbeiter_id) return false;
      
      const appointmentDate = new Date(app.start_at);
      const isInFuture = appointmentDate > now;
      const isInCurrentMonth = appointmentDate.getMonth() === currentMonth && appointmentDate.getFullYear() === currentYear;
      
      return isInFuture && isInCurrentMonth;
    });
  }, [appointments]);

  // Group unassigned appointments by date
  const groupedAppointments = React.useMemo(() => {
    const groups: { [key: string]: Appointment[] } = {};
    
    filteredUnassignedAppointments.forEach(appointment => {
      const dateKey = format(new Date(appointment.start_at), 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(appointment);
    });
    
    return groups;
  }, [filteredUnassignedAppointments]);

  const totalUnassigned = filteredUnassignedAppointments.length;
  const weekdays = weekDates.slice(0, 5); // Mo-Fr
  const weekendDays = weekDates.slice(5); // Sa-So

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

      {/* Grid aligned with ProScheduleCalendar - using same grid template */}
      <div 
        className="grid"
        style={{ gridTemplateColumns: `${EMPLOYEE_COL_WIDTH}px repeat(7, 1fr)` }}
      >
        {/* Spacer for employee column - matches ProScheduleCalendar exactly */}
        <div className="border-r bg-card" />
        
        {/* All 7 days */}
        {weekDates.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          const dayAppointments = groupedAppointments[dateKey] || [];
          const isToday = isSameDay(date, new Date());
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;

          return (
            <div
              key={dateKey}
              className={cn(
                "p-2 border-r last:border-r-0",
                isToday && "bg-primary/5",
                isWeekend && "bg-muted/30"
              )}
            >
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
                  <div className="text-xs text-muted-foreground/50 text-center">
                    Drop hier
                  </div>
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
    </div>
  );
}