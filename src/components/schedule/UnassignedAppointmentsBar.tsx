import React from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { AlertTriangle, Clock, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DraggableAppointment } from './DraggableAppointment';

interface Customer {
  id: string;
  vorname: string;
  nachname: string;
  email: string;
  telefon: string;
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
}

export function UnassignedAppointmentsBar({
  appointments,
  weekDates,
  activeId,
  onEditAppointment
}: UnassignedAppointmentsBarProps) {
  // Group unassigned appointments by date
  const groupedAppointments = React.useMemo(() => {
    const groups: { [key: string]: Appointment[] } = {};
    
    appointments
      .filter(app => !app.mitarbeiter_id)
      .forEach(appointment => {
        const dateKey = format(new Date(appointment.start_at), 'yyyy-MM-dd');
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(appointment);
      });
    
    return groups;
  }, [appointments]);

  const totalUnassigned = appointments.filter(app => !app.mitarbeiter_id).length;

  if (totalUnassigned === 0) {
    return null;
  }

  return (
    <Card className="border-2 border-warning bg-gradient-to-r from-warning/10 to-orange-50 shadow-md">
      <CardContent className="p-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h3 className="font-medium text-warning-foreground">Unzugeordnete Termine</h3>
            <Badge variant="destructive" className="bg-warning text-warning-foreground text-xs">
              {totalUnassigned}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            Termine ohne Mitarbeiter - Per Drag & Drop zuordnen
          </div>
        </div>

        {/* Grid matching calendar days - exact same structure as CalendarGrid */}
        <div className={`grid gap-1 ${weekDates.length > 7 ? 'grid-cols-[200px_repeat(28,1fr)]' : 'grid-cols-8'}`}>
          {/* Employee column header */}
          <div className="bg-muted/30 rounded p-2">
            <div className="text-xs font-medium text-muted-foreground">Unzugeordnet</div>
          </div>
          
          {/* Date headers - exact same as CalendarGrid */}
          {weekDates.map((date) => (
            <div key={date.toISOString()} className="text-center bg-muted/20 rounded p-1">
              <div className="text-xs font-medium text-muted-foreground">
                {format(date, 'EEE', { locale: de })}
              </div>
              <div className="text-xs font-semibold text-foreground">
                {format(date, 'dd.MM')}
              </div>
            </div>
          ))}

          {/* Empty spacer for employee column alignment */}
          <div></div>

          {/* Appointments for each day - exact same grid structure as CalendarGrid */}
          {weekDates.map((date) => {
            const dateKey = format(date, 'yyyy-MM-dd');
            const dayAppointments = groupedAppointments[dateKey] || [];

            return (
              <div key={dateKey} className="min-h-[50px] space-y-1">
                {dayAppointments.length > 0 ? (
                  dayAppointments.map((appointment) => (
                    <DraggableAppointment
                      key={appointment.id}
                      appointment={appointment}
                      isDragging={activeId === appointment.id}
                      isConflicting={false}
                      onClick={() => onEditAppointment(appointment)}
                    />
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground opacity-60">
                    -
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}