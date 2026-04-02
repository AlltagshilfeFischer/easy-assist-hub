import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { CalendarClock, User, Clock, CheckCircle2, Users } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { suggestEmployees } from '@/lib/schedule/suggestEmployees';
import type { Verfuegbarkeit } from '@/hooks/useVerfuegbarkeiten';
import type { Employee, CalendarAppointment } from '@/types/domain';

interface UnassignedAppointmentsPanelProps {
  unassignedAppointments: CalendarAppointment[];
  allAppointments: CalendarAppointment[];
  employees: Employee[];
  verfuegbarkeiten: Verfuegbarkeit[];
  onAssignAppointment: (appointmentId: string, employeeId: string) => void;
  isLoading?: boolean;
}

export function UnassignedAppointmentsPanel({
  unassignedAppointments,
  allAppointments,
  employees,
  verfuegbarkeiten,
  onAssignAppointment,
  isLoading = false,
}: UnassignedAppointmentsPanelProps) {
  const { isGeschaeftsfuehrer, isGlobalAdmin } = useUserRole();
  const canAssign = isGeschaeftsfuehrer || isGlobalAdmin;

  const sortedUnassigned = useMemo(
    () =>
      [...unassignedAppointments].sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      ),
    [unassignedAppointments],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
        Lade...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0">
        <CalendarClock className="h-4 w-4 text-amber-500 flex-shrink-0" />
        <span className="text-sm font-medium flex-1">Offene Termine</span>
        {sortedUnassigned.length > 0 && (
          <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5">
            {sortedUnassigned.length}
          </Badge>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {sortedUnassigned.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="text-sm font-medium">Alle Termine zugewiesen</p>
            <p className="text-xs text-center px-4">
              Keine offenen Termine vorhanden.
            </p>
          </div>
        ) : (
          <div className="px-2 py-1 space-y-1">
            {sortedUnassigned.map(appt => (
              <AppointmentHoverItem
                key={appt.id}
                appointment={appt}
                allAppointments={allAppointments}
                employees={employees}
                verfuegbarkeiten={verfuegbarkeiten}
                canAssign={canAssign}
                onAssign={onAssignAppointment}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ─── Sub-component: one hover item ────────────────────────────────────────────

interface AppointmentHoverItemProps {
  appointment: CalendarAppointment;
  allAppointments: CalendarAppointment[];
  employees: Employee[];
  verfuegbarkeiten: Verfuegbarkeit[];
  canAssign: boolean;
  onAssign: (appointmentId: string, employeeId: string) => void;
}

function AppointmentHoverItem({
  appointment,
  allAppointments,
  employees,
  verfuegbarkeiten,
  canAssign,
  onAssign,
}: AppointmentHoverItemProps) {
  const suggestions = useMemo(
    () =>
      suggestEmployees({
        appointment,
        allAppointments,
        employees,
        verfuegbarkeiten,
      }).slice(0, 3),
    [appointment, allAppointments, employees, verfuegbarkeiten],
  );

  const customerName = appointment.customer?.name ?? appointment.titel ?? 'Unbekannter Kunde';
  const startDate = new Date(appointment.start_at);
  const endDate = new Date(appointment.end_at);

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className="flex items-start gap-2 rounded-md border bg-card px-3 py-2 cursor-default hover:bg-muted/50 transition-colors">
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium truncate">{customerName}</span>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
              <Clock className="h-3 w-3 flex-shrink-0" />
              <span>
                {format(startDate, 'EEE dd.MM.', { locale: de })}
                {' '}
                {format(startDate, 'HH:mm')}
                {' – '}
                {format(endDate, 'HH:mm')}
              </span>
            </div>
          </div>
          <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
        </div>
      </HoverCardTrigger>

      <HoverCardContent side="left" align="start" className="w-64 p-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Verfügbare Mitarbeiter
        </p>
        {suggestions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Keine verfügbaren Mitarbeiter
          </p>
        ) : (
          <div className="space-y-1.5">
            {suggestions.map(({ employee, score, reason }) => (
              <div
                key={employee.id}
                className="flex items-center gap-2 rounded-md border bg-background p-2"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: employee.farbe_kalender }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{employee.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{reason}</p>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 h-4 flex-shrink-0 font-mono"
                >
                  {score}
                </Badge>
                {canAssign && (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-6 text-[10px] px-1.5 flex-shrink-0"
                    onClick={() => onAssign(appointment.id, employee.id)}
                  >
                    <User className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
