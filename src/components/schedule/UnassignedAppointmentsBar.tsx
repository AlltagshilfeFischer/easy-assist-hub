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
import { EMPLOYEE_COL_WIDTH, DAY_COL_WIDTH } from './gridConfig';

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

  // Fixed grid dimensions - MUST match CalendarGrid exactly (from shared config)
  const employeeColumnWidth = EMPLOYEE_COL_WIDTH;
  const dayColumnWidth = DAY_COL_WIDTH;
  const totalWidth = employeeColumnWidth + (weekDates.length * dayColumnWidth);

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

        {/* Grid with EXACT same dimensions as calendar */}
        <div 
          className="grid border border-muted box-border" 
          style={{ 
            gridTemplateColumns: `${employeeColumnWidth}px repeat(${weekDates.length}, ${dayColumnWidth}px)`,
            width: `${totalWidth}px`,
            minWidth: `${totalWidth}px`,
            maxWidth: `${totalWidth}px`
          }}
        >
          {/* Employee column space - exact match */}
          <div 
            className="border-r border-muted px-2 py-2 box-border"
            style={{ width: `${employeeColumnWidth}px`, minWidth: `${employeeColumnWidth}px`, maxWidth: `${employeeColumnWidth}px` }}
          >
            <div className="text-xs text-muted-foreground text-center">Zuordnung aufheben</div>
          </div>
          
          {/* Date columns with exact calendar alignment */}
          {weekDates.map((date) => {
            const dateKey = format(date, 'yyyy-MM-dd');
            const dayAppointments = groupedAppointments[dateKey] || [];

            return (
              <div 
                key={dateKey} 
                className="border-r border-muted last:border-r-0 p-1 min-h-[80px] box-border"
                style={{ width: `${dayColumnWidth}px`, minWidth: `${dayColumnWidth}px`, maxWidth: `${dayColumnWidth}px` }}
              >
                {/* Date header matching calendar exactly */}
                <div className="text-center p-1 bg-muted/30 rounded text-xs font-medium border-b border-muted mb-2">
                  {format(date, 'dd', { locale: de })}
                </div>
                
                {/* Enhanced drop zone for unassignment */}
                <EnhancedDropZone
                  id={`unassigned-${dateKey}`}
                  isEmpty={dayAppointments.length === 0}
                  className={cn(
                    "transition-all duration-200 rounded-lg min-h-[60px] box-border",
                    "w-full h-full overflow-hidden",
                    dayAppointments.length === 0 
                      ? "border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5" 
                      : "flex flex-col gap-1"
                  )}
                >
                  {dayAppointments.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground/60">
                      Drop hier
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 overflow-y-auto max-h-[60px]">
                      {dayAppointments.map((appointment) => (
                        <div key={appointment.id} className="flex-shrink-0">
                          <DraggableAppointment
                            appointment={appointment}
                            isDragging={activeId === appointment.id}
                            isConflicting={false}
                            onClick={() => onEditAppointment(appointment)}
                          />
                        </div>
                      ))}
                    </div>
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