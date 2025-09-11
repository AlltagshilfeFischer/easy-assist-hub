import React, { useMemo } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
      {/* Compact Header Row - exact same structure as UnassignedAppointmentsBar */}
      <div className={`grid gap-1 mb-2 bg-muted/30 p-2 rounded-lg ${weekDates.length > 7 ? 'grid-cols-[200px_repeat(28,1fr)]' : 'grid-cols-8'}`}>
        <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
          Mitarbeiter
        </div>
        {weekDates.map((date, index) => (
          <div key={index} className="text-center px-1 py-1">
            <div className="text-xs font-semibold text-foreground">
              {format(date, 'EEE', { locale: de })}
            </div>
            <div className="text-xs text-muted-foreground">
              {format(date, 'dd.MM', { locale: de })}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        {employees.filter(emp => emp.ist_aktiv).map((employee) => (
          <div key={employee.id} className={`grid gap-1 ${weekDates.length > 7 ? 'grid-cols-[200px_repeat(28,1fr)]' : 'grid-cols-8'}`}>
            {/* Compact Employee Info */}
            <div className="bg-card border rounded-lg p-2 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-1">
                <div 
                  className="w-3 h-3 rounded-full border border-border flex-shrink-0" 
                  style={{ backgroundColor: employee.farbe_kalender }}
                />
                <h3 className="font-semibold text-xs truncate text-foreground">{employee.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground truncate">{employee.email}</p>
              <div className="flex items-center gap-1 mt-1">
                <Phone className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate">{employee.telefon}</span>
              </div>
            </div>

            {/* Dynamic Day Slots - Create robust drop zones */}
            {weekDates.map((date, dayIndex) => {
              const dayAppointments = getAppointmentsForDate(employee.id, date);
              // Create consistent drop zone ID: employee-{uuid}-{dayIndex}
              const dropZoneId = `employee-${employee.id}-${dayIndex}`;
              const hasAppointments = dayAppointments.length > 0;

              return (
                <div key={`${employee.id}-day-${dayIndex}`} className={cn(
                  "min-h-[60px]",
                  weekDates.length > 7 && "min-h-[40px]" // Smaller height for month view
                )}>
                  <EnhancedDropZone
                    id={dropZoneId}
                    isEmpty={!hasAppointments}
                    employeeName={employee.name}
                    date={format(date, 'dd.MM.yyyy')}
                    workloadInfo={{
                      count: dayAppointments.length,
                      max: employee.max_termine_pro_tag || 8,
                      percentage: Math.round((dayAppointments.length / (employee.max_termine_pro_tag || 8)) * 100),
                      isOverbooked: dayAppointments.length > (employee.max_termine_pro_tag || 8),
                      isNearCapacity: dayAppointments.length >= (employee.max_termine_pro_tag || 8) * 0.8
                    }}
                    className={cn(
                      "transition-all duration-200 rounded-lg",
                      weekDates.length > 7 ? "min-h-[40px]" : "min-h-[60px]",
                      hasAppointments 
                        ? "bg-card border shadow-sm" 
                        : "border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5"
                    )}
                  >
                    {!hasAppointments ? (
                      <div className="h-full flex items-center justify-center">
                        {weekDates.length <= 7 && (
                          <div className="text-xs text-muted-foreground text-center opacity-60">
                            Termin zuweisen
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={cn(
                        "space-y-1",
                        weekDates.length > 7 ? "p-0.5" : "p-1"
                      )}>
                        {dayAppointments.map((appointment) => (
                          <DraggableAppointment
                            key={appointment.id}
                            appointment={appointment}
                            isDragging={activeId === appointment.id}
                            isConflicting={conflictingAppointments.has(appointment.id)}
                            onClick={() => onEditAppointment(appointment)}
                          />
                        ))}
                      </div>
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