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
  const unassignedAppointments = React.useMemo(() => 
    appointments.filter(app => !app.mitarbeiter_id),
    [appointments]
  );

  if (unassignedAppointments.length === 0) {
    return null;
  }

  return (
    <Card className="border border-muted bg-muted/20">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="text-sm font-medium text-foreground">
            Unzugeordnete Termine
          </div>
          <Badge variant="secondary" className="text-xs">
            {unassignedAppointments.length}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {unassignedAppointments.map((appointment) => (
            <DraggableAppointment
              key={appointment.id}
              appointment={appointment}
              isDragging={activeId === appointment.id}
              isConflicting={false}
              onClick={() => onEditAppointment(appointment)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}