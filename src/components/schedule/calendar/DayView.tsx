import React, { useMemo } from 'react';
import { format, isSameDay, isToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserX } from 'lucide-react';
import type { Employee, CalendarAppointment } from '@/types/domain';

interface Abwesenheit {
  id: string;
  mitarbeiter_id: string;
  grund: string;
  zeitraum: string;
  typ?: string;
  status?: string;
}

interface DayViewProps {
  employees: Employee[];
  appointments: CalendarAppointment[];
  currentDate: Date;
  onEditAppointment: (appointment: CalendarAppointment) => void;
  onSlotClick: (employeeId: string, date: Date) => void;
  abwesenheiten?: Abwesenheit[];
  hiddenEmployeeIds?: Set<string>;
}

const START_HOUR = 6;
const END_HOUR = 22;
const SLOT_HEIGHT = 48; // px per 30 min
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

export function DayView({
  employees,
  appointments,
  currentDate,
  onEditAppointment,
  onSlotClick,
  abwesenheiten = [],
  hiddenEmployeeIds = new Set(),
}: DayViewProps) {
  const visibleEmployees = useMemo(
    () => employees.filter((e) => !hiddenEmployeeIds.has(e.id)),
    [employees, hiddenEmployeeIds]
  );

  const dayAppointments = useMemo(
    () => appointments.filter((a) => isSameDay(new Date(a.start_at), currentDate)),
    [appointments, currentDate]
  );

  const unassignedDayApps = useMemo(
    () => dayAppointments.filter((a) => !a.mitarbeiter_id),
    [dayAppointments]
  );

  const showUnassignedCol = unassignedDayApps.length > 0;

  const totalSlots = (END_HOUR - START_HOUR) * 2; // 30-min slots
  const gridHeight = totalSlots * SLOT_HEIGHT;
  const showNowLine = isToday(currentDate);

  const nowOffset = useMemo(() => {
    if (!showNowLine) return 0;
    const now = new Date();
    const hours = now.getHours() + now.getMinutes() / 60;
    return (hours - START_HOUR) * SLOT_HEIGHT * 2;
  }, [showNowLine]);

  const getAbwesenheit = (employeeId: string): Abwesenheit | undefined => {
    return abwesenheiten.find((a) => {
      if (a.mitarbeiter_id !== employeeId) return false;
      try {
        const rangeMatch = a.zeitraum.match(
          /\[?"?(\d{4}-\d{2}-\d{2}).*?,.*?"?(\d{4}-\d{2}-\d{2})/
        );
        if (rangeMatch) {
          const start = new Date(rangeMatch[1]);
          const end = new Date(rangeMatch[2]);
          return currentDate >= start && currentDate <= end;
        }
      } catch {
        return false;
      }
      return false;
    });
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div
        className="grid border-b border-border bg-muted/30"
        style={{
          gridTemplateColumns: `80px repeat(${visibleEmployees.length}, 1fr)${showUnassignedCol ? ' 1fr' : ''}`,
        }}
      >
        <div className="px-2 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-r border-border">
          Zeit
        </div>
        {visibleEmployees.map((emp) => {
          const initials = emp.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          return (
            <div
              key={emp.id}
              className={cn('px-2 py-3 text-center border-r border-border', !showUnassignedCol && 'last:border-r-0')}
            >
              <div className="flex flex-col items-center gap-1">
                <Avatar className="h-8 w-8" style={{ boxShadow: `0 0 0 2px ${emp.farbe_kalender}` }}>
                  <AvatarImage src={emp.avatar_url || undefined} alt={emp.name} />
                  <AvatarFallback
                    className="text-white font-semibold text-[10px]"
                    style={{ backgroundColor: emp.farbe_kalender }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-foreground truncate max-w-[100px]">
                  {emp.name}
                </span>
              </div>
            </div>
          );
        })}
        {/* Unzugeordnet-Spalte Header */}
        {showUnassignedCol && (
          <div className="px-2 py-3 text-center border-r border-border last:border-r-0 bg-amber-50/40 dark:bg-amber-950/10">
            <div className="flex flex-col items-center gap-1">
              <div
                className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"
                style={{ boxShadow: '0 0 0 2px #94A3B8' }}
              >
                <UserX className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300 truncate max-w-[100px]">
                Nicht zugeordnet
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Time Grid */}
      <div className="relative" style={{ height: gridHeight }}>
        {/* Time labels + horizontal lines */}
        {HOURS.map((hour) => {
          const top = (hour - START_HOUR) * SLOT_HEIGHT * 2;
          return (
            <React.Fragment key={hour}>
              <div
                className="absolute left-0 w-[80px] text-xs text-muted-foreground text-right pr-2 -translate-y-1/2 z-10"
                style={{ top }}
              >
                {format(new Date(2000, 0, 1, hour), 'HH:mm')}
              </div>
              <div
                className="absolute left-[80px] right-0 border-t border-border/50"
                style={{ top }}
              />
              {/* Half-hour line */}
              <div
                className="absolute left-[80px] right-0 border-t border-border/20"
                style={{ top: top + SLOT_HEIGHT }}
              />
            </React.Fragment>
          );
        })}

        {/* Employee columns */}
        <div
          className="absolute left-[80px] right-0 top-0 grid h-full"
          style={{
            gridTemplateColumns: `repeat(${visibleEmployees.length}, 1fr)${showUnassignedCol ? ' 1fr' : ''}`,
          }}
        >
          {visibleEmployees.map((emp) => {
            const empApps = dayAppointments.filter(
              (a) => a.mitarbeiter_id === emp.id
            );
            const absence = getAbwesenheit(emp.id);

            return (
              <div
                key={emp.id}
                className={cn(
                  'relative border-r border-border cursor-pointer',
                  !showUnassignedCol && 'last:border-r-0'
                )}
                onClick={(e) => {
                  // Only trigger if clicking the background, not an appointment
                  if ((e.target as HTMLElement).closest('[data-appointment]')) return;
                  onSlotClick(emp.id, currentDate);
                }}
              >
                {absence && (
                  <div className="absolute inset-0 bg-muted/40 flex items-center justify-center z-[1]">
                    <span className="text-xs text-muted-foreground italic">
                      {absence.typ === 'urlaub'
                        ? 'Urlaub'
                        : absence.typ === 'krank'
                        ? 'Krankheit'
                        : absence.typ === 'fortbildung'
                        ? 'Fortbildung'
                        : 'Abwesend'}
                    </span>
                  </div>
                )}

                {empApps.map((app) => {
                  const start = new Date(app.start_at);
                  const end = new Date(app.end_at);
                  const startHours = start.getHours() + start.getMinutes() / 60;
                  const endHours = end.getHours() + end.getMinutes() / 60;
                  const top = Math.max(0, (startHours - START_HOUR) * SLOT_HEIGHT * 2);
                  const height = Math.max(
                    SLOT_HEIGHT / 2,
                    (endHours - startHours) * SLOT_HEIGHT * 2
                  );
                  const customerName = app.customer?.name || app.titel;

                  return (
                    <div
                      key={app.id}
                      data-appointment
                      className="absolute left-1 right-1 rounded-md px-2 py-1 text-xs text-white overflow-hidden cursor-pointer hover:opacity-90 transition-opacity z-[2]"
                      style={{
                        top,
                        height,
                        backgroundColor: emp.farbe_kalender || '#3B82F6',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditAppointment(app);
                      }}
                    >
                      <div className="font-semibold truncate">{customerName}</div>
                      <div className="opacity-80">
                        {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Unzugeordnet-Spalte */}
          {showUnassignedCol && (
            <div className="relative border-r border-border last:border-r-0 bg-amber-50/20 dark:bg-amber-950/5">
              {unassignedDayApps.map((app) => {
                const start = new Date(app.start_at);
                const end = new Date(app.end_at);
                const startHours = start.getHours() + start.getMinutes() / 60;
                const endHours = end.getHours() + end.getMinutes() / 60;
                const top = Math.max(0, (startHours - START_HOUR) * SLOT_HEIGHT * 2);
                const height = Math.max(
                  SLOT_HEIGHT / 2,
                  (endHours - startHours) * SLOT_HEIGHT * 2
                );
                const customerName = app.customer?.name || app.titel;
                return (
                  <div
                    key={app.id}
                    data-appointment
                    className="absolute left-1 right-1 rounded-md px-2 py-1 text-xs text-white overflow-hidden cursor-pointer hover:opacity-90 transition-opacity z-[2]"
                    style={{ top, height, backgroundColor: '#94A3B8' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditAppointment(app);
                    }}
                  >
                    <div className="font-semibold truncate">{customerName}</div>
                    <div className="opacity-80">
                      {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Current time line */}
        {showNowLine && nowOffset >= 0 && nowOffset <= gridHeight && (
          <div
            className="absolute left-[80px] right-0 z-20 pointer-events-none"
            style={{ top: nowOffset }}
          >
            <div className="relative">
              <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-destructive" />
              <div className="h-[2px] bg-destructive w-full" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
