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
import { EMPLOYEE_COL_WIDTH, DAY_COL_WIDTH } from './gridConfig';

interface Employee {
  id: string;
  vorname?: string;
  nachname?: string;
  name: string;
  telefon: string;
  ist_aktiv: boolean;
  max_termine_pro_tag: number;
  farbe_kalender: string;
  workload: number;
  benutzer?: {
    email: string;
    vorname: string;
    nachname: string;
  };
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
  onSlotClick?: (employeeId: string, date: Date) => void;
}

export function CalendarGrid({ 
  employees, 
  appointments, 
  weekDates, 
  activeId,
  onEditAppointment,
  onSlotClick
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

  // Fixed grid dimensions - MUST match UnassignedAppointmentsBar exactly (from shared config)
  const employeeColumnWidth = EMPLOYEE_COL_WIDTH;
  const dayColumnWidth = DAY_COL_WIDTH;
  const totalWidth = employeeColumnWidth + (weekDates.length * dayColumnWidth);

  return (
    <div className="calendar-grid box-border">
      {/* Header Row with exact fixed dimensions */}
      <div 
        className="grid bg-muted/20 border border-muted box-border" 
        style={{ 
          gridTemplateColumns: `${employeeColumnWidth}px repeat(${weekDates.length}, ${dayColumnWidth}px)`,
          width: `${totalWidth}px`,
          minWidth: `${totalWidth}px`,
          maxWidth: `${totalWidth}px`
        }}
      >
        <div 
          className="text-xs font-semibold text-muted-foreground px-2 py-2 border-r border-muted box-border"
          style={{ width: `${employeeColumnWidth}px`, minWidth: `${employeeColumnWidth}px`, maxWidth: `${employeeColumnWidth}px` }}
        >
          Mitarbeiter
        </div>
        {weekDates.map((date, index) => {
          const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
          
          return (
            <div 
              key={index} 
              className={cn(
                "text-center px-1 py-2 border-r border-muted last:border-r-0 box-border",
                isToday && "bg-red-200/80 border-red-400"
              )}
              style={{ width: `${dayColumnWidth}px`, minWidth: `${dayColumnWidth}px`, maxWidth: `${dayColumnWidth}px` }}
            >
              <div className={cn(
                "text-xs font-semibold",
                isToday ? "text-red-700" : "text-foreground"
              )}>
                {format(date, 'dd', { locale: de })}
              </div>
              <div className={cn(
                "text-xs",
                isToday ? "text-red-600" : "text-muted-foreground"
              )}>
                {format(date, 'MM', { locale: de })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-l border-r border-b border-muted box-border">
        {sortedEmployees.map((employee) => (
          <div 
            key={employee.id} 
            className="grid border-b border-muted last:border-b-0 box-border" 
            style={{ 
              gridTemplateColumns: `${employeeColumnWidth}px repeat(${weekDates.length}, ${dayColumnWidth}px)`,
              width: `${totalWidth}px`,
              minWidth: `${totalWidth}px`,
              maxWidth: `${totalWidth}px`
            }}
          >
            {/* Employee Info with better spacing for names */}
            <div 
              className="bg-card border-r border-muted p-3 box-border"
              style={{ width: `${employeeColumnWidth}px`, minWidth: `${employeeColumnWidth}px`, maxWidth: `${employeeColumnWidth}px` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-4 h-4 rounded-full border border-border flex-shrink-0" 
                  style={{ backgroundColor: employee.farbe_kalender }}
                />
                <h3 className="font-semibold text-sm text-foreground">{employee.name}</h3>
              </div>
              <div className="text-xs text-muted-foreground">
                <div className="truncate">{employee.telefon}</div>
              </div>
            </div>

            {/* Day Slots with exact width */}
            {weekDates.map((date, dayIndex) => {
              const dayAppointments = getAppointmentsForDate(employee.id, date);
              const dropZoneId = `employee-${employee.id}-${dayIndex}`;
              const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

              return (
                 <div 
                   key={`${employee.id}-day-${dayIndex}`} 
                   className={cn(
                     "min-h-[100px] border-r border-muted last:border-r-0 p-2 box-border",
                     isToday && "bg-red-100/60 border-red-300"
                   )}
                   style={{ width: `${dayColumnWidth}px`, minWidth: `${dayColumnWidth}px`, maxWidth: `${dayColumnWidth}px` }}
                 >
                    <EnhancedDropZone
                      id={dropZoneId}
                      isEmpty={dayAppointments.length === 0}
                      employeeName={employee.name}
                      date={format(date, 'dd.MM.yyyy')}
                      className={cn(
                        "transition-all duration-200 rounded-lg min-h-[90px] p-2 box-border",
                        "w-full h-full overflow-hidden",
                        dayAppointments.length === 0 
                          ? "border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5 cursor-pointer" 
                          : "bg-card/50 border border-muted/50 shadow-sm flex flex-col gap-1"
                      )}
                      onClick={() => {
                        if (dayAppointments.length === 0 && onSlotClick) {
                          onSlotClick(employee.id, date);
                        }
                      }}
                    >
                      {dayAppointments.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                          <div className="text-xs text-muted-foreground/60 text-center">
                            + Termin
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 overflow-y-auto max-h-[85px]">
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