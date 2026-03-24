import React from 'react';
import { format, isSameDay, isWeekend as checkWeekend } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DraggableAppointment } from '../DraggableAppointment';
import { EnhancedDropZone } from '../EnhancedDropZone';
import type { CalendarAppointment } from '@/types/domain';

interface EmployeeWeekCalendarProps {
  appointments: CalendarAppointment[];
  weekDates: Date[];
  onEditAppointment: (appointment: CalendarAppointment) => void;
  onSlotClick: (date: Date) => void;
  employeeName: string;
  employeeColor: string;
}

export function EmployeeWeekCalendar({
  appointments,
  weekDates,
  onEditAppointment,
  onSlotClick,
  employeeName,
  employeeColor
}: EmployeeWeekCalendarProps) {
  const weekdays = weekDates.slice(0, 5); // Mo-Fr
  const weekendDays = weekDates.slice(5); // Sa-So

  const getAppointmentsForDate = (date: Date) => {
    return appointments
      .filter(app => isSameDay(new Date(app.start_at), date))
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-max sm:min-w-0">
        {/* Header with dates */}
        <div className="sticky top-0 z-20 bg-background border-b shadow-sm">
          <div className="flex">
            {weekdays.map((date) => {
              const isToday = isSameDay(date, new Date());
              return (
                <div
                  key={date.toISOString()}
                  className={cn(
                    "flex-1 min-w-[120px] sm:min-w-[180px] p-2 sm:p-4 text-center border-r",
                    isToday && "bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "text-xs sm:text-sm font-medium",
                    isToday && "text-primary"
                  )}>
                    <span className="hidden sm:inline">{format(date, 'EEEE', { locale: de })}</span>
                    <span className="sm:hidden">{format(date, 'EEE', { locale: de })}</span>
                  </div>
                  <div className={cn(
                    "text-lg sm:text-2xl font-bold",
                    isToday && "text-primary"
                  )}>
                    {format(date, 'd')}
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">
                    {format(date, 'MMM', { locale: de })}
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
                    "w-16 sm:w-24 flex-shrink-0 p-1 sm:p-2 text-center border-r bg-muted/30",
                    isToday && "bg-primary/10"
                  )}
                >
                  <div className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                    {format(date, 'EEE', { locale: de })}
                  </div>
                  <div className={cn(
                    "text-base sm:text-lg font-semibold",
                    isToday && "text-primary"
                  )}>
                    {format(date, 'd')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Calendar grid */}
        <div className="flex border-b">
          {weekdays.map((date) => {
            const dayAppointments = getAppointmentsForDate(date);
            const dropZoneId = `employee-${format(date, 'yyyy-MM-dd')}`;

            return (
              <div
                key={date.toISOString()}
                className="flex-1 min-w-[120px] sm:min-w-[180px] border-r"
              >
                <EnhancedDropZone
                  id={dropZoneId}
                  isEmpty={dayAppointments.length === 0}
                  isWeekend={false}
                  employeeName={employeeName}
                  date={format(date, 'dd.MM.yyyy')}
                  onClick={() => onSlotClick(date)}
                  className={cn(
                    "min-h-[200px] sm:min-h-[400px] p-1 sm:p-2 space-y-1 sm:space-y-2",
                    isSameDay(date, new Date()) && "bg-primary/5"
                  )}
                >
                  {dayAppointments.map((appointment) => (
                    <DraggableAppointment
                      key={appointment.id}
                      appointment={appointment}
                      isDragging={false}
                      isConflicting={false}
                      onClick={() => onEditAppointment(appointment)}
                      onCut={() => {}}
                    />
                  ))}
                </EnhancedDropZone>
              </div>
            );
          })}

          {/* Weekend cells Sa-So (minimized) */}
          {weekendDays.map((date) => {
            const dayAppointments = getAppointmentsForDate(date);
            const dropZoneId = `employee-${format(date, 'yyyy-MM-dd')}`;

            return (
              <div
                key={date.toISOString()}
                className="w-16 sm:w-24 flex-shrink-0 border-r bg-muted/30"
              >
                <EnhancedDropZone
                  id={dropZoneId}
                  isEmpty={dayAppointments.length === 0}
                  isWeekend={true}
                  employeeName={employeeName}
                  date={format(date, 'dd.MM.yyyy')}
                  onClick={() => onSlotClick(date)}
                  className="min-h-[200px] sm:min-h-[400px] p-1 space-y-1"
                >
                  {dayAppointments.map((appointment) => (
                    <DraggableAppointment
                      key={appointment.id}
                      appointment={appointment}
                      isDragging={false}
                      isConflicting={false}
                      onClick={() => onEditAppointment(appointment)}
                      onCut={() => {}}
                    />
                  ))}
                </EnhancedDropZone>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
