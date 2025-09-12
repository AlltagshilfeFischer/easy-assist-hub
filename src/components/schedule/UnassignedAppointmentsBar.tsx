import React from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { AlertTriangle, Clock, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { DraggableAppointment } from './DraggableAppointment';
import { EnhancedDropZone } from './EnhancedDropZone';

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

  // Always show the bar, even when empty
  const isEmpty = totalUnassigned === 0;

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
          {isEmpty && (
            <div className="text-xs text-muted-foreground ml-2">
              (Termine hier ablegen zum Aufheben der Zuordnung)
            </div>
          )}
        </div>

        {/* Grid that exactly matches calendar structure - fixed column widths */}
        <div className={`grid gap-1 ${weekDates.length > 7 ? 'grid-cols-[200px_repeat(28,minmax(100px,1fr))]' : 'grid-cols-[200px_repeat(7,minmax(180px,1fr))]'}`} style={{ minWidth: weekDates.length > 7 ? '3000px' : '1560px' }}>
          {/* Empty space for employee column */}
          <div className="border-r border-muted"></div>
          
          {/* Date columns matching calendar */}
          {weekDates.map((date) => {
            const dateKey = format(date, 'yyyy-MM-dd');
            const dayAppointments = groupedAppointments[dateKey] || [];

            return (
              <div key={dateKey} className="border-r border-muted p-1 min-h-[80px]">
                {/* Date header with grid border */}
                <div className="text-center p-1 bg-muted/30 rounded text-xs font-medium border-b border-muted mb-2">
                  {format(date, weekDates.length > 7 ? 'dd' : 'EEE dd.MM', { locale: de })}
                </div>
                
                {/* Enhanced drop zone for unassignment */}
                <EnhancedDropZone
                  id={`unassigned-${dateKey}`}
                  isEmpty={dayAppointments.length === 0}
                  className={cn(
                    "transition-all duration-200 rounded-lg min-h-[60px] h-full",
                    dayAppointments.length === 0 
                      ? "border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5" 
                      : "space-y-1"
                  )}
                >
                  {dayAppointments.length === 0 && isEmpty ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground/60">
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
                      />
                    ))
                  )}
                </EnhancedDropZone>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}