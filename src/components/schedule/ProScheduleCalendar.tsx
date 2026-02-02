import React, { useMemo } from 'react';
import { format, isSameDay, getWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ProAppointmentCard } from './ProAppointmentCard';
import { EnhancedDropZone } from './EnhancedDropZone';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Employee {
  id: string;
  name: string;
  vorname?: string;
  nachname?: string;
  farbe_kalender: string;
  max_termine_pro_tag: number;
  ist_aktiv: boolean;
  soll_wochenstunden?: number;
  avatar_url?: string | null;
}

interface Appointment {
  id: string;
  titel: string;
  start_at: string;
  end_at: string;
  mitarbeiter_id: string | null;
  kunden_id: string;
  customer?: {
    id: string;
    name: string;
    farbe_kalender?: string;
  };
}

interface Abwesenheit {
  id: string;
  mitarbeiter_id: string;
  grund: string;
  zeitraum: string; // tstzrange from DB
}

interface ProScheduleCalendarProps {
  employees: Employee[];
  appointments: Appointment[];
  abwesenheiten?: Abwesenheit[];
  weekDates: Date[];
  activeAppointmentId: string | null;
  onEditAppointment: (appointment: Appointment) => void;
  onSlotClick: (employeeId: string, date: Date) => void;
  conflictingAppointments: Set<string>;
  onCut: (appointment: Appointment) => void;
  highlightedAppointmentId?: string | null;
}

export function ProScheduleCalendar({
  employees,
  appointments,
  abwesenheiten = [],
  weekDates,
  activeAppointmentId,
  onEditAppointment,
  onSlotClick,
  conflictingAppointments,
  onCut,
  highlightedAppointmentId,
}: ProScheduleCalendarProps) {
  
  const getAppointmentsForEmployeeAndDate = (employeeId: string, date: Date) => {
    return appointments
      .filter((app) => app.mitarbeiter_id === employeeId && isSameDay(new Date(app.start_at), date))
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  };

  // Calculate weekly hours for each employee
  const getWeeklyHours = (employeeId: string) => {
    const weekApps = appointments.filter(app => 
      app.mitarbeiter_id === employeeId &&
      weekDates.some(d => isSameDay(new Date(app.start_at), d))
    );
    
    const totalMinutes = weekApps.reduce((sum, app) => {
      const start = new Date(app.start_at);
      const end = new Date(app.end_at);
      return sum + (end.getTime() - start.getTime()) / (1000 * 60);
    }, 0);
    
    return Math.round(totalMinutes / 60);
  };

  // Check if employee has absence on a date
  const getAbwesenheit = (employeeId: string, date: Date): Abwesenheit | undefined => {
    return abwesenheiten.find(a => {
      if (a.mitarbeiter_id !== employeeId) return false;
      // Parse tstzrange - format: ["2024-02-12","2024-02-18"]
      try {
        const rangeMatch = a.zeitraum.match(/\[?"?(\d{4}-\d{2}-\d{2}).*?,.*?"?(\d{4}-\d{2}-\d{2})/);
        if (rangeMatch) {
          const start = new Date(rangeMatch[1]);
          const end = new Date(rangeMatch[2]);
          return date >= start && date <= end;
        }
      } catch {
        return false;
      }
      return false;
    });
  };

  const today = new Date();

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Header Row */}
      <div className="grid border-b border-border bg-muted/30" 
           style={{ gridTemplateColumns: '220px repeat(7, 1fr)' }}>
        {/* Mitarbeiter Header */}
        <div className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-r border-border">
          Mitarbeiter
        </div>
        
        {/* Day Headers */}
        {weekDates.map((date) => {
          const isToday = isSameDay(date, today);
          const dayName = format(date, 'EEE', { locale: de }).toUpperCase();
          
          return (
            <div
              key={date.toISOString()}
              className={cn(
                "px-2 py-3 text-center border-r border-border last:border-r-0",
                isToday && "bg-primary/10"
              )}
            >
              <div className={cn(
                "text-xs font-medium",
                isToday ? "text-primary" : "text-muted-foreground"
              )}>
                {dayName}
              </div>
              <div className={cn(
                "text-lg font-bold",
                isToday ? "text-primary" : "text-foreground"
              )}>
                {format(date, 'dd.MM.')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Employee Rows */}
      <div className="divide-y divide-border">
        {employees.map((employee) => {
          const weekHours = getWeeklyHours(employee.id);
          const sollStunden = employee.soll_wochenstunden || 40;
          const initials = employee.name
            .split(' ')
            .map(n => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          
          // Check for week-spanning absence
          const hasAbsenceThisWeek = weekDates.some(d => getAbwesenheit(employee.id, d));
          
          return (
            <div 
              key={employee.id} 
              className="grid hover:bg-muted/20 transition-colors"
              style={{ gridTemplateColumns: '220px repeat(7, 1fr)' }}
            >
              {/* Employee Info Column */}
              <div className="px-4 py-3 border-r border-border bg-card flex items-center gap-3">
                <div 
                  className="relative"
                  style={{ '--ring-color': employee.farbe_kalender } as React.CSSProperties}
                >
                  <Avatar className="h-10 w-10 ring-2 ring-offset-2 ring-offset-background" style={{ boxShadow: `0 0 0 2px ${employee.farbe_kalender}` }}>
                    <AvatarImage src={employee.avatar_url || undefined} alt={employee.name} />
                    <AvatarFallback 
                      className="text-white font-semibold text-sm"
                      style={{ backgroundColor: employee.farbe_kalender }}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">
                    {employee.name}
                  </div>
                  <div className={cn(
                    "text-xs font-medium",
                    weekHours > sollStunden ? "text-destructive" : "text-primary"
                  )}>
                    {weekHours}/{sollStunden} Std.
                  </div>
                </div>
              </div>

              {/* Day Cells */}
              {weekDates.map((date) => {
                const dayAppointments = getAppointmentsForEmployeeAndDate(employee.id, date);
                const abwesenheit = getAbwesenheit(employee.id, date);
                const dropZoneId = `${employee.id}-${format(date, 'yyyy-MM-dd')}`;
                const isToday = isSameDay(date, today);

                return (
                  <div 
                    key={date.toISOString()} 
                    className={cn(
                      "min-h-[100px] border-r border-border last:border-r-0 relative",
                      isToday && "bg-primary/5"
                    )}
                  >
                    {abwesenheit ? (
                      // Abwesenheitsanzeige
                      <div className="h-full flex items-center justify-center p-2">
                        <div className="text-xs text-muted-foreground italic text-center">
                          <span className="text-primary/70">Abwesenheit:</span>
                          <br />
                          {abwesenheit.grund || 'Urlaub'}
                        </div>
                      </div>
                    ) : (
                      <EnhancedDropZone
                        id={dropZoneId}
                        isEmpty={dayAppointments.length === 0}
                        isWeekend={false}
                        employeeName={employee.name}
                        date={format(date, 'dd.MM.yyyy')}
                        onClick={() => onSlotClick(employee.id, date)}
                        className="h-full p-2"
                      >
                        <div className="space-y-1.5">
                          {dayAppointments.map((appointment) => (
                            <ProAppointmentCard
                              key={appointment.id}
                              appointment={appointment}
                              isDragging={activeAppointmentId === appointment.id}
                              isConflicting={conflictingAppointments.has(appointment.id)}
                              isHighlighted={highlightedAppointmentId === appointment.id}
                              onClick={() => onEditAppointment(appointment)}
                              onCut={() => onCut(appointment)}
                            />
                          ))}
                        </div>
                      </EnhancedDropZone>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
