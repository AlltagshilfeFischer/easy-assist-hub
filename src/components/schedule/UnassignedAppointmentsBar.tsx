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
    <Card className="border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-orange-900">Unzugeordnete Termine</h3>
            <Badge variant="destructive" className="bg-orange-600">
              {totalUnassigned}
            </Badge>
          </div>
          <div className="text-sm text-orange-700">
            Termine ohne Mitarbeiter - Per Drag & Drop zuordnen
          </div>
        </div>

        {/* Grid matching calendar days */}
        <div className="grid gap-2" style={{ gridTemplateColumns: `120px repeat(${weekDates.length}, 1fr)` }}>
          {/* Empty space for employee column */}
          <div></div>
          
          {/* Date headers */}
          {weekDates.map((date) => (
            <div key={date.toISOString()} className="text-center">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                {format(date, 'EEE', { locale: de })}
              </div>
              <div className="text-sm font-semibold">
                {format(date, 'dd.MM')}
              </div>
            </div>
          ))}

          {/* Empty space for employee column */}
          <div></div>

          {/* Appointments for each day */}
          {weekDates.map((date) => {
            const dateKey = format(date, 'yyyy-MM-dd');
            const dayAppointments = groupedAppointments[dateKey] || [];

            return (
              <div key={dateKey} className="min-h-[60px] space-y-1">
                {dayAppointments.length > 0 ? (
                  dayAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="relative group"
                    >
                      <Card 
                        className={cn(
                          "p-2 cursor-pointer border-2 border-orange-200 bg-white hover:bg-orange-50 transition-colors",
                          "shadow-sm hover:shadow-md",
                          activeId === appointment.id && "ring-2 ring-orange-400"
                        )}
                        onClick={() => onEditAppointment(appointment)}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-orange-600" />
                            <span className="text-xs font-medium text-orange-900 truncate">
                              Ohne Mitarbeiter
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-gray-900 truncate">
                            {appointment.titel}
                          </div>
                          {appointment.customer && (
                            <div className="text-xs text-gray-600 truncate">
                              {appointment.customer.vorname} {appointment.customer.nachname}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(appointment.start_at), 'HH:mm')}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    Keine Termine
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