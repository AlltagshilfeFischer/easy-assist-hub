import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, getWeek, startOfWeek, addWeeks } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarSearch, Clock, MapPin, User, ExternalLink, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmployees } from '@/hooks/useEmployees';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AppointmentDetailDialog } from '@/components/schedule/dialogs/AppointmentDetailDialog';
import { useCustomers } from '@/hooks/useCustomers';

interface UnassignedAppointment {
  id: string;
  titel: string;
  start_at: string;
  end_at: string;
  status: string;
  mitarbeiter_id: string | null;
  kunden_id: string | null;
  notizen: string | null;
  kategorie: string | null;
  vorlage_id: string | null;
  ist_ausnahme: boolean | null;
  ausnahme_grund: string | null;
  iststunden: number | null;
  ausweichort_id: string | null;
  customer: {
    id: string;
    name: string;
    vorname: string | null;
    nachname: string | null;
    farbe_kalender: string | null;
    stadtteil: string | null;
    telefonnr: string | null;
  } | null;
}

interface WeekGroup {
  weekKey: string;
  weekNumber: number;
  weekStart: Date;
  label: string;
  appointments: UnassignedAppointment[];
}

function useUnassignedAppointments() {
  return useQuery({
    queryKey: ['unassigned-appointments'],
    queryFn: async (): Promise<UnassignedAppointment[]> => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const rangeEnd = addWeeks(now, 26);

      const { data, error } = await supabase
        .from('termine')
        .select(`
          id, titel, start_at, end_at, status, mitarbeiter_id, kunden_id,
          notizen, kategorie, vorlage_id, ist_ausnahme, ausnahme_grund,
          iststunden, ausweichort_id,
          customer:kunden!termine_kunden_id_fkey(id, name, vorname, nachname, farbe_kalender, stadtteil, telefonnr)
        `)
        .or('mitarbeiter_id.is.null,status.eq.unassigned')
        .gte('start_at', now.toISOString())
        .lte('start_at', rangeEnd.toISOString())
        .order('start_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as UnassignedAppointment[];
    },
    staleTime: 30_000,
  });
}

export default function OffeneTermine() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: appointments = [], isLoading } = useUnassignedAppointments();
  const { data: employees = [] } = useEmployees();
  const { data: customers = [] } = useCustomers();
  const [editingAppointment, setEditingAppointment] = useState<UnassignedAppointment | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const weekGroups = useMemo((): WeekGroup[] => {
    const groups = new Map<string, WeekGroup>();

    for (const appt of appointments) {
      const date = new Date(appt.start_at);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekNumber = getWeek(date, { locale: de, weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');

      if (!groups.has(weekKey)) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        groups.set(weekKey, {
          weekKey,
          weekNumber,
          weekStart,
          label: `KW ${weekNumber} · ${format(weekStart, 'dd.MM.', { locale: de })} – ${format(weekEnd, 'dd.MM.yyyy', { locale: de })}`,
          appointments: [],
        });
      }
      groups.get(weekKey)!.appointments.push(appt);
    }

    return Array.from(groups.values()).sort((a, b) =>
      a.weekStart.getTime() - b.weekStart.getTime()
    );
  }, [appointments]);

  const handleAssign = async (appointmentId: string, employeeId: string) => {
    setAssigningId(appointmentId);
    try {
      const appt = appointments.find(a => a.id === appointmentId);
      const updateData: Record<string, unknown> = {
        mitarbeiter_id: employeeId,
        status: 'scheduled',
      };
      if (appt?.vorlage_id && !appt.ist_ausnahme) {
        updateData.ist_ausnahme = true;
        updateData.ausnahme_grund = 'Mitarbeiter zugewiesen über Offene Termine';
      }

      const { error } = await supabase
        .from('termine')
        .update(updateData)
        .eq('id', appointmentId);

      if (error) throw error;

      const emp = employees.find(e => e.id === employeeId);
      toast.success(`Zugewiesen an ${emp?.name ?? 'Mitarbeiter'}`);
      queryClient.invalidateQueries({ queryKey: ['unassigned-appointments'] });
    } catch {
      toast.error('Fehler beim Zuweisen');
    } finally {
      setAssigningId(null);
    }
  };

  const navigateToWeek = (weekStart: Date) => {
    navigate(`/dashboard/schedule-builder?week=${format(weekStart, 'yyyy-MM-dd')}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarSearch className="h-6 w-6 text-amber-500" />
          <div>
            <h1 className="text-xl font-semibold">Offene Termine</h1>
            <p className="text-sm text-muted-foreground">
              Alle unzugeordneten Termine der nächsten 26 Wochen
            </p>
          </div>
        </div>
        {appointments.length > 0 && (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mr-1.5" />
            {appointments.length} offen
          </Badge>
        )}
      </div>

      {/* Empty state */}
      {weekGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground border rounded-lg border-dashed">
          <CalendarSearch className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">Keine offenen Termine</p>
          <p className="text-sm mt-1">Alle Termine sind zugeordnet.</p>
        </div>
      )}

      {/* Week groups */}
      {weekGroups.map((group) => (
        <div key={group.weekKey} className="border rounded-lg overflow-hidden">
          {/* Week header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{group.label}</span>
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                {group.appointments.length} offen
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => navigateToWeek(group.weekStart)}
            >
              <ExternalLink className="h-3 w-3" />
              Im Dienstplan
            </Button>
          </div>

          {/* Appointments */}
          <div className="divide-y">
            {group.appointments.map((appt) => {
              const color = appt.customer?.farbe_kalender ?? '#10B981';
              const customerName = appt.customer
                ? [appt.customer.nachname, appt.customer.vorname].filter(Boolean).join(', ') || appt.customer.name
                : appt.titel;
              const startDate = new Date(appt.start_at);
              const endDate = new Date(appt.end_at);

              return (
                <div key={appt.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  {/* Farbstreifen */}
                  <div
                    className="w-1 self-stretch rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />

                  {/* Datum + Uhrzeit */}
                  <div className="w-32 flex-shrink-0">
                    <div className="text-sm font-medium">
                      {format(startDate, 'EEE, dd.MM.', { locale: de })}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3" />
                      {format(startDate, 'HH:mm')} – {format(endDate, 'HH:mm')}
                    </div>
                  </div>

                  {/* Kunde + Infos */}
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      className="text-sm font-medium hover:underline truncate block text-left"
                      onClick={() => setEditingAppointment(appt)}
                    >
                      {customerName}
                    </button>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {appt.customer?.stadtteil && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {appt.customer.stadtteil}
                        </span>
                      )}
                      {appt.kategorie && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {appt.kategorie}
                        </Badge>
                      )}
                      {appt.notizen && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 italic truncate max-w-[200px]">
                          {appt.notizen}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mitarbeiter-Zuweisung */}
                  <div className="w-48 flex-shrink-0">
                    <Select
                      value=""
                      onValueChange={(empId) => handleAssign(appt.id, empId)}
                      disabled={assigningId === appt.id}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>Mitarbeiter zuweisen</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id} className="text-sm">
                            {emp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Detail-Dialog */}
      {editingAppointment && (
        <AppointmentDetailDialog
          isOpen={true}
          onClose={() => setEditingAppointment(null)}
          appointment={editingAppointment as any}
          employees={employees as any}
          customers={customers as any}
          onUpdate={async () => {
            queryClient.invalidateQueries({ queryKey: ['unassigned-appointments'] });
            setEditingAppointment(null);
          }}
          onDuplicate={async () => {}}
        />
      )}
    </div>
  );
}
