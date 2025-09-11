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
    <Card className="border border-muted bg-muted/10 mb-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="text-sm font-medium text-foreground">
            Unzugeordnete Termine
          </div>
          <Badge variant="secondary" className="text-xs">
            {totalUnassigned}
          </Badge>
        </div>

        {/* Grid that exactly matches calendar structure */}
        <div className={`grid gap-2 ${weekDates.length > 7 ? 'grid-cols-[200px_repeat(28,1fr)]' : 'grid-cols-[200px_repeat(7,1fr)]'}`}>
          {/* Empty space for employee column */}
          <div></div>
          
          {/* Date columns matching calendar */}
          {weekDates.map((date) => {
            const dateKey = format(date, 'yyyy-MM-dd');
            const dayAppointments = groupedAppointments[dateKey] || [];

            return (
              <div key={dateKey} className="space-y-2">
                {/* Date header */}
                <div className="text-center p-1 bg-muted/30 rounded text-xs font-medium">
                  {format(date, 'EEE dd.MM', { locale: de })}
                </div>
                
                {/* Appointments for this day */}
                <div className="space-y-1 min-h-[60px]">
                  {dayAppointments.map((appointment) => (
                    <DraggableAppointment
                      key={appointment.id}
                      appointment={appointment}
                      isDragging={activeId === appointment.id}
                      isConflicting={false}
                      onClick={() => onEditAppointment(appointment)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}