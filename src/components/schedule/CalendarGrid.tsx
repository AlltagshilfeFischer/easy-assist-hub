import React, { useMemo } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EnhancedDropZone } from './EnhancedDropZone';
import { DraggableAppointment } from './DraggableAppointment';
import { Clock, User, Phone, AlertTriangle, TrendingUp } from 'lucide-react';
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
  status: 'unassigned' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
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

  const getWorkloadInfo = (employeeId: string, date: Date) => {
    const dayAppointments = getAppointmentsForDate(employeeId, date);
    const employee = employees.find(emp => emp.id === employeeId);
    const maxAppointments = employee?.max_termine_pro_tag || 8;
    const currentCount = dayAppointments.length;
    const percentage = (currentCount / maxAppointments) * 100;
    
    return {
      count: currentCount,
      max: maxAppointments,
      percentage,
      isOverbooked: currentCount > maxAppointments,
      isNearCapacity: percentage >= 80
    };
  };

  const getWorkloadColor = (percentage: number, isOverbooked: boolean) => {
    if (isOverbooked) return 'bg-red-500/10 border-red-200';
    if (percentage >= 80) return 'bg-orange-500/10 border-orange-200';
    if (percentage >= 60) return 'bg-yellow-500/10 border-yellow-200';
    return 'bg-green-500/10 border-green-200';
  };

  const conflictingAppointments = useMemo(() => {
    const conflicts = new Set<string>();
    
    appointments.forEach(app1 => {
      if (app1.mitarbeiter_id) {
        appointments.forEach(app2 => {
          if (app1.id !== app2.id && 
              app1.mitarbeiter_id === app2.mitarbeiter_id && 
              app1.status !== 'cancelled' && 
              app2.status !== 'cancelled') {
            
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
      {/* Header Row */}
      <div className="grid grid-cols-8 gap-2 mb-4">
        <div className="text-sm font-medium text-muted-foreground p-2">
          Mitarbeiter
        </div>
        {weekDates.map((date, index) => (
          <div key={index} className="text-center p-2">
            <div className="text-sm font-medium">
              {format(date, 'EEE', { locale: de })}
            </div>
            <div className="text-xs text-muted-foreground">
              {format(date, 'dd.MM', { locale: de })}
            </div>
          </div>
        ))}
      </div>

      {/* Employee Rows */}
      <div className="space-y-2">
        {employees.filter(emp => emp.ist_aktiv).map((employee) => (
          <div key={employee.id} className="grid grid-cols-8 gap-2">
            {/* Employee Info Cell */}
            <Card className="h-full min-h-[120px] border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3 h-full flex flex-col">
                <div className="flex items-start gap-2 mb-2">
                  <div 
                    className="w-3 h-3 rounded-full border border-white shadow-sm mt-0.5 flex-shrink-0" 
                    style={{ backgroundColor: employee.farbe_kalender }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{employee.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{employee.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  <Phone className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{employee.telefon}</span>
                </div>

                <div className="mt-auto">
                  <Badge 
                    variant={employee.ist_aktiv ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {employee.ist_aktiv ? 'Aktiv' : 'Inaktiv'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Day Cells */}
            {weekDates.map((date, dayIndex) => {
              const dayAppointments = getAppointmentsForDate(employee.id, date);
              const workloadInfo = getWorkloadInfo(employee.id, date);
              const isEmpty = dayAppointments.length === 0;
              const dropZoneId = `employee-${employee.id}-${dayIndex}`;

              return (
                <Card 
                  key={dayIndex} 
                  className={cn(
                    "min-h-[120px] transition-all duration-200",
                    getWorkloadColor(workloadInfo.percentage, workloadInfo.isOverbooked)
                  )}
                >
                  <CardContent className="p-2 h-full">
                    {/* Workload indicator */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1">
                        {workloadInfo.isOverbooked ? (
                          <AlertTriangle className="h-3 w-3 text-red-600" />
                        ) : (
                          <TrendingUp className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className={cn(
                          'text-xs font-medium',
                          workloadInfo.isOverbooked ? 'text-red-600' : 
                          workloadInfo.isNearCapacity ? 'text-orange-600' : 'text-muted-foreground'
                        )}>
                          {workloadInfo.count}/{workloadInfo.max}
                        </span>
                      </div>
                      {workloadInfo.isOverbooked && (
                        <Badge variant="destructive" className="text-xs">
                          Überlastet
                        </Badge>
                      )}
                    </div>

                    <EnhancedDropZone
                      id={dropZoneId}
                      isEmpty={isEmpty}
                      employeeName={employee.name}
                      date={format(date, 'dd.MM.yyyy')}
                      workloadInfo={workloadInfo}
                      className="h-full min-h-[100px]"
                    >
                      <div className="space-y-1">
                        {dayAppointments.map((appointment) => (
                          <div key={appointment.id} className="relative">
                            <DraggableAppointment
                              appointment={appointment}
                              isDragging={activeId === appointment.id}
                              isConflicting={conflictingAppointments.has(appointment.id)}
                              onClick={() => onEditAppointment(appointment)}
                            />
                          </div>
                        ))}
                      </div>
                    </EnhancedDropZone>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}