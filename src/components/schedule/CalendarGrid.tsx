import React, { useMemo } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { EnhancedDropZone } from './EnhancedDropZone';
import { DraggableAppointment } from './DraggableAppointment';
import { Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  vorname: string;
  nachname: string;
  name: string;
  email: string;
  telefon: string;
  ist_aktiv: boolean;
  max_termine_pro_tag: number;
  farbe_kalender: string;
  workload: number;
}

interface Appointment {
  id: string;
  titel: string;
  kunden_id: string;
  mitarbeiter_id: string | null;
  start_at: string;
  end_at: string;
  customer?: any;
  employee?: Employee;
}

interface CalendarGridProps {
  employees: Employee[];
  appointments: Appointment[];
  weekDates: Date[];
  activeId: string | null;
  onEditAppointment: (appointment: Appointment) => void;
}

export function CalendarGrid({ 
  employees, 
  appointments, 
  weekDates, 
  activeId,
  onEditAppointment 
}: CalendarGridProps) {
  
  const getAppointmentsForDate = (employeeId: string, date: Date) => {
    return appointments.filter(app => 
      app.mitarbeiter_id === employeeId && 
      isSameDay(new Date(app.start_at), date)
    ).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  };

  const sortedEmployees = useMemo(() => {
    return employees.filter(emp => emp.ist_aktiv);
  }, [employees]);

  const conflictingAppointments = useMemo(() => {
    const conflicts = new Set<string>();
    
    appointments.forEach(app1 => {
      if (app1.mitarbeiter_id) {
        appointments.forEach(app2 => {
          if (app1.id !== app2.id && 
              app1.mitarbeiter_id === app2.mitarbeiter_id) {
            
            const start1 = new Date(app1.start_at);
            const end1 = new Date(app1.end_at);
            const start2 = new Date(app2.start_at);
            const end2 = new Date(app2.end_at);
            
            // Check for time overlap
            if (start1 < end2 && start2 < end1) {
              conflicts.add(app1.id);
              conflicts.add(app2.id);
            }
          }
        });
      }
    });
    
    return conflicts;
  }, [appointments]);

  return (
    <div className="calendar-grid">
      {/* Header Row with exact fixed widths */}
      <div className={`grid bg-muted/20 p-0 border border-muted`} style={{ gridTemplateColumns: `200px repeat(${weekDates.length}, 120px)`, width: `${200 + weekDates.length * 120}px` }}>
        <div className="text-xs font-semibold text-muted-foreground px-2 py-2 border-r border-muted">
          Mitarbeiter
        </div>
        {weekDates.map((date, index) => (
          <div key={index} className="text-center px-1 py-2 border-r border-muted last:border-r-0">
            <div className="text-xs font-semibold text-foreground">
              {format(date, 'dd', { locale: de })}
            </div>
            <div className="text-xs text-muted-foreground">
              {format(date, 'MM', { locale: de })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-l border-r border-b border-muted">
        {sortedEmployees.map((employee) => (
          <div key={employee.id} className={`grid border-b border-muted last:border-b-0`} style={{ gridTemplateColumns: `200px repeat(${weekDates.length}, 120px)`, width: `${200 + weekDates.length * 120}px` }}>
            {/* Employee Info with exact width */}
            <div className="bg-card border-r border-muted p-2 w-[200px]">
              <div className="flex items-center gap-2 mb-1">
                <div 
                  className="w-3 h-3 rounded-full border border-border flex-shrink-0" 
                  style={{ backgroundColor: employee.farbe_kalender }}
                />
                <h3 className="font-semibold text-xs truncate text-foreground">{employee.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground truncate">{employee.email}</p>
            </div>

            {/* Day Slots with exact width */}
            {weekDates.map((date, dayIndex) => {
              const dayAppointments = getAppointmentsForDate(employee.id, date);
              const dropZoneId = `employee-${employee.id}-${dayIndex}`;

              return (
                <div key={`${employee.id}-day-${dayIndex}`} className="min-h-[80px] border-r border-muted last:border-r-0 p-1 w-[120px]">
                  <EnhancedDropZone
                    id={dropZoneId}
                    isEmpty={dayAppointments.length === 0}
                    employeeName={employee.name}
                    date={format(date, 'dd.MM.yyyy')}
                    className={cn(
                      "transition-all duration-200 rounded-lg min-h-[80px] p-1 h-full w-full",
                      dayAppointments.length === 0 
                        ? "border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5" 
                        : "bg-card/50 border border-muted/50 shadow-sm space-y-1"
                    )}
                  >
                    {dayAppointments.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-xs text-muted-foreground/60 text-center">
                          Drop
                        </div>
                      </div>
                    ) : (
                      dayAppointments.map((appointment) => (
                        <DraggableAppointment
                          key={appointment.id}
                          appointment={appointment}
                          isDragging={activeId === appointment.id}
                          isConflicting={conflictingAppointments.has(appointment.id)}
                          onClick={() => onEditAppointment(appointment)}
                        />
                      ))
                    )}
                  </EnhancedDropZone>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}