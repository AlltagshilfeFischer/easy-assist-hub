import React from 'react';
import { format, getDay, isSameDay, isWeekend } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DraggableAppointment } from './DraggableAppointment';
import { EnhancedDropZone } from './EnhancedDropZone';
import { EMPLOYEE_COL_WIDTH } from './gridConfig';

interface Employee {
  id: string;
  name: string;
  farbe_kalender: string;
  max_termine_pro_tag: number;
  ist_aktiv: boolean;
}

interface Appointment {
  id: string;
  titel: string;
  start_at: string;
  end_at: string;
  mitarbeiter_id: string | null;
  kunden_id: string;
  customer?: any;
}

interface ModernWeekCalendarProps {
  employees: Employee[];
  appointments: Appointment[];
  weekDates: Date[];
  activeAppointmentId: string | null;
  onEditAppointment: (appointment: Appointment) => void;
  onSlotClick: (employeeId: string, date: Date) => void;
  conflictingAppointments: Set<string>;
  onCut: (appointment: Appointment) => void;
}

export function ModernWeekCalendar({
  employees,
  appointments,
  weekDates,
  activeAppointmentId,
  onEditAppointment,
  onSlotClick,
  conflictingAppointments,
  onCut
}: ModernWeekCalendarProps) {
  const weekdays = weekDates.slice(0, 5); // Mo-Fr
  const weekendDays = weekDates.slice(5); // Sa-So

  const getAppointmentsForEmployeeAndDate = (employeeId: string, date: Date) => {
    return appointments
      .filter(app => 
        app.mitarbeiter_id === employeeId &&
        isSameDay(new Date(app.start_at), date)
      )
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  };

  const getEmployeeWorkload = (employeeId: string, date: Date) => {
    const dayAppointments = getAppointmentsForEmployeeAndDate(employeeId, date);
    const employee = employees.find(e => e.id === employeeId);
    const max = employee?.max_termine_pro_tag || 8;
    const count = dayAppointments.length;
    const percentage = (count / max) * 100;
    
    return {
      count,
      max,
      percentage,
      isOverbooked: count > max,
      isNearCapacity: percentage >= 80 && count <= max
    };
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-max">
        {/* Header with dates */}
        <div className="sticky top-0 z-20 bg-background border-b shadow-sm">
          <div className="flex">
            {/* Spacer for employee column */}
            <div className="flex-shrink-0 border-r" style={{ width: `${EMPLOYEE_COL_WIDTH}px` }} />
            
            {/* Weekdays Mo-Fr */}
            {weekdays.map((date) => {
              const isToday = isSameDay(date, new Date());
              return (
                <div
                  key={date.toISOString()}
                  className={cn(
                    "flex-1 min-w-[180px] p-4 text-center border-r",
                    isToday && "bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "text-sm font-medium",
                    isToday && "text-primary"
                  )}>
                    {format(date, 'EEEE', { locale: de })}
                  </div>
                  <div className={cn(
                    "text-2xl font-bold",
                    isToday && "text-primary"
                  )}>
                    {format(date, 'd')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(date, 'MMM yyyy', { locale: de })}
                  </div>
                </div>
              );
            })}
            
            {/* Weekend Sa-So (minimized) */}
            {weekendDays.map((date) => {
              const isToday = isSameDay(date, new Date());
              return (
                <div
                  key={date.toISOString()}
                  className={cn(
                    "w-24 flex-shrink-0 p-2 text-center border-r bg-muted/30",
                    isToday && "bg-primary/10"
                  )}
                >
                  <div className="text-xs font-medium text-muted-foreground">
                    {format(date, 'EEE', { locale: de })}
                  </div>
                  <div className={cn(
                    "text-lg font-semibold",
                    isToday && "text-primary"
                  )}>
                    {format(date, 'd')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Employee rows */}
        <div>
          {employees.map((employee) => (
            <div
              key={employee.id}
              className="flex border-b hover:bg-muted/20 transition-colors"
            >
              {/* Employee info column - fixed left */}
              <div className="flex-shrink-0 p-4 border-r bg-card sticky left-0 z-10" style={{ width: `${EMPLOYEE_COL_WIDTH}px` }}>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-md"
                    style={{ backgroundColor: employee.farbe_kalender }}
                  >
                    {employee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{employee.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Max: {employee.max_termine_pro_tag} Termine/Tag
                    </div>
                  </div>
                </div>
              </div>

              {/* Weekday cells Mo-Fr */}
              {weekdays.map((date) => {
                const dayAppointments = getAppointmentsForEmployeeAndDate(employee.id, date);
                const workloadInfo = getEmployeeWorkload(employee.id, date);
                const dropZoneId = `${employee.id}-${format(date, 'yyyy-MM-dd')}`;

                return (
                  <div
                    key={date.toISOString()}
                    className="flex-1 min-w-[180px] border-r"
                  >
                    <EnhancedDropZone
                      id={dropZoneId}
                      isEmpty={dayAppointments.length === 0}
                      isWeekend={false}
                      employeeName={employee.name}
                      date={format(date, 'dd.MM.yyyy')}
                      workloadInfo={workloadInfo}
                      onClick={() => onSlotClick(employee.id, date)}
                      className={cn(
                        "min-h-[120px] p-2 space-y-2",
                        isSameDay(date, new Date()) && "bg-primary/5"
                      )}
                    >
                      {dayAppointments.map((appointment) => (
                        <DraggableAppointment
                          key={appointment.id}
                          appointment={appointment}
                          isDragging={activeAppointmentId === appointment.id}
                          isConflicting={conflictingAppointments.has(appointment.id)}
                          onClick={() => onEditAppointment(appointment)}
                          onCut={() => onCut(appointment)}
                        />
                      ))}
                    </EnhancedDropZone>
                  </div>
                );
              })}

              {/* Weekend cells Sa-So (minimized) */}
              {weekendDays.map((date) => {
                const dayAppointments = getAppointmentsForEmployeeAndDate(employee.id, date);
                const dropZoneId = `${employee.id}-${format(date, 'yyyy-MM-dd')}`;

                return (
                  <div
                    key={date.toISOString()}
                    className="w-24 flex-shrink-0 border-r bg-muted/30"
                  >
                    <EnhancedDropZone
                      id={dropZoneId}
                      isEmpty={dayAppointments.length === 0}
                      isWeekend={true}
                      employeeName={employee.name}
                      date={format(date, 'dd.MM.yyyy')}
                      onClick={() => onSlotClick(employee.id, date)}
                      className="min-h-[120px] p-1 space-y-1"
                    >
                      {dayAppointments.map((appointment) => (
                        <DraggableAppointment
                          key={appointment.id}
                          appointment={appointment}
                          isDragging={activeAppointmentId === appointment.id}
                          isConflicting={conflictingAppointments.has(appointment.id)}
                          onClick={() => onEditAppointment(appointment)}
                          onCut={() => onCut(appointment)}
                        />
                      ))}
                    </EnhancedDropZone>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
