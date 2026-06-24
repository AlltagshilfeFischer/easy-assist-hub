import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  format, getWeek, startOfWeek, addWeeks, isSameDay, parseISO,
  addDays, differenceInMinutes,
} from 'date-fns';
import { de } from 'date-fns/locale';
import {
  CalendarSearch, Clock, MapPin, User, ExternalLink,
  AlertTriangle, ChevronRight, CheckCircle2, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmployees } from '@/hooks/useEmployees';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AppointmentDetailDialog } from '@/components/schedule/dialogs/AppointmentDetailDialog';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface WeekAppointment {
  id: string;
  mitarbeiter_id: string | null;
  start_at: string;
  end_at: string;
  status: string;
}

interface WeekGroup {
  weekKey: string;
  weekNumber: number;
  weekStart: Date;
  label: string;
  appointments: UnassignedAppointment[];
}

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------

function useUnassignedAppointments() {
  return useQuery({
    queryKey: ['unassigned-appointments-board'],
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
          customer:kunden!termine_kunden_id_fkey(
            id, name, vorname, nachname, farbe_kalender, stadtteil, telefonnr
          )
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

function useWeekAppointments(weekStart: Date | null) {
  return useQuery({
    queryKey: ['week-appointments-board', weekStart?.toISOString()],
    enabled: !!weekStart,
    queryFn: async (): Promise<WeekAppointment[]> => {
      if (!weekStart) return [];
      const weekEnd = addDays(weekStart, 7);
      const { data, error } = await supabase
        .from('termine')
        .select('id, mitarbeiter_id, start_at, end_at, status')
        .gte('start_at', weekStart.toISOString())
        .lt('start_at', weekEnd.toISOString())
        .not('status', 'in', '(abgesagt_rechtzeitig,cancelled)');

      if (error) throw error;
      return (data ?? []) as WeekAppointment[];
    },
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function formatDuration(start: string, end: string): string {
  const mins = differenceInMinutes(new Date(end), new Date(start));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function AppointmentCard({
  appt,
  selected,
  onClick,
}: {
  appt: UnassignedAppointment;
  selected: boolean;
  onClick: () => void;
}) {
  const color = appt.customer?.farbe_kalender ?? '#10B981';
  const customerName = appt.customer
    ? [appt.customer.nachname, appt.customer.vorname].filter(Boolean).join(', ') || appt.customer.name
    : appt.titel;
  const startDate = new Date(appt.start_at);
  const endDate = new Date(appt.end_at);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border p-2.5 transition-all',
        'hover:border-primary/50 hover:shadow-sm',
        selected
          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30'
          : 'border-border bg-card',
      )}
    >
      <div className="flex items-start gap-2">
        <div
          className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{customerName}</div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {format(startDate, 'EEE dd.MM.', { locale: de })} · {format(startDate, 'HH:mm')}–{format(endDate, 'HH:mm')}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {appt.customer?.stadtteil && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <MapPin className="h-2.5 w-2.5" />
                {appt.customer.stadtteil}
              </span>
            )}
            {appt.kategorie && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                {appt.kategorie}
              </Badge>
            )}
          </div>
        </div>
        {selected && (
          <ChevronRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function OffeneTermine() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: unassigned = [], isLoading } = useUnassignedAppointments();
  const { data: employees = [] } = useEmployees();

  const [selectedAppt, setSelectedAppt] = useState<UnassignedAppointment | null>(null);
  const [viewWeekStart, setViewWeekStart] = useState<Date | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<UnassignedAppointment | null>(null);

  // Effective week shown on the right
  const effectiveWeekStart = useMemo(() => {
    if (viewWeekStart) return viewWeekStart;
    if (unassigned.length > 0) {
      return startOfWeek(new Date(unassigned[0].start_at), { weekStartsOn: 1 });
    }
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  }, [viewWeekStart, unassigned]);

  const weekDays = useMemo(() => getWeekDays(effectiveWeekStart), [effectiveWeekStart]);

  const { data: weekAppointments = [] } = useWeekAppointments(effectiveWeekStart);

  // Group unassigned by calendar week
  const weekGroups = useMemo((): WeekGroup[] => {
    const groups = new Map<string, WeekGroup>();
    for (const appt of unassigned) {
      const date = new Date(appt.start_at);
      const ws = startOfWeek(date, { weekStartsOn: 1 });
      const weekNumber = getWeek(date, { locale: de, weekStartsOn: 1 });
      const weekKey = format(ws, 'yyyy-MM-dd');
      if (!groups.has(weekKey)) {
        const we = addDays(ws, 6);
        groups.set(weekKey, {
          weekKey,
          weekNumber,
          weekStart: ws,
          label: `KW ${weekNumber} · ${format(ws, 'dd.MM.', { locale: de })} – ${format(we, 'dd.MM.', { locale: de })}`,
          appointments: [],
        });
      }
      groups.get(weekKey)!.appointments.push(appt);
    }
    return Array.from(groups.values()).sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  }, [unassigned]);

  // Workload: per employee per day → count of assigned appointments
  const workload = useMemo(() => {
    // map: employeeId → day-index (0-6) → count
    const map = new Map<string, number[]>();
    for (const emp of employees) {
      map.set(emp.id, Array(7).fill(0));
    }
    for (const appt of weekAppointments) {
      if (!appt.mitarbeiter_id) continue;
      const apptDate = new Date(appt.start_at);
      const dayIdx = weekDays.findIndex(d => isSameDay(d, apptDate));
      if (dayIdx >= 0) {
        const emp = map.get(appt.mitarbeiter_id);
        if (emp) emp[dayIdx]++;
      }
    }
    return map;
  }, [weekAppointments, employees, weekDays]);

  // Day index of selected appointment in the current week view
  const selectedDayIdx = useMemo(() => {
    if (!selectedAppt) return -1;
    const d = new Date(selectedAppt.start_at);
    return weekDays.findIndex(day => isSameDay(day, d));
  }, [selectedAppt, weekDays]);

  const handleSelectAppt = (appt: UnassignedAppointment) => {
    const ws = startOfWeek(new Date(appt.start_at), { weekStartsOn: 1 });
    setSelectedAppt(prev => prev?.id === appt.id ? null : appt);
    setViewWeekStart(ws);
  };

  const handleAssign = async (employeeId: string) => {
    if (!selectedAppt) return;
    setAssigning(true);
    try {
      const updateData: Record<string, unknown> = {
        mitarbeiter_id: employeeId,
        status: 'scheduled',
      };
      if (selectedAppt.vorlage_id && !selectedAppt.ist_ausnahme) {
        updateData.ist_ausnahme = true;
        updateData.ausnahme_grund = 'Mitarbeiter zugewiesen über Verplanung';
      }
      const { error } = await supabase
        .from('termine')
        .update(updateData)
        .eq('id', selectedAppt.id);
      if (error) throw error;

      const emp = employees.find(e => e.id === employeeId);
      toast.success(`Zugewiesen an ${emp?.name ?? 'Mitarbeiter'}`);
      setSelectedAppt(null);
      queryClient.invalidateQueries({ queryKey: ['unassigned-appointments-board'] });
      queryClient.invalidateQueries({ queryKey: ['week-appointments-board'] });
    } catch {
      toast.error('Fehler beim Zuweisen');
    } finally {
      setAssigning(false);
    }
  };

  const cellColor = (count: number, isHighlighted: boolean): string => {
    if (!isHighlighted) return 'bg-muted/30 text-muted-foreground';
    if (count === 0) return 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700';
    if (count <= 2) return 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700';
    return 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b flex-shrink-0">
        <div className="flex items-center gap-3">
          <CalendarSearch className="h-5 w-5 text-amber-500" />
          <div>
            <h1 className="text-base font-semibold leading-tight">Verplanung offener Termine</h1>
            <p className="text-xs text-muted-foreground">
              {unassigned.length === 0
                ? 'Alle Termine sind zugeordnet'
                : `${unassigned.length} unzugeordnete Termine in den nächsten 26 Wochen`}
            </p>
          </div>
        </div>
        {unassigned.length > 0 && (
          <Badge variant="secondary" className="gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            {unassigned.length} offen
          </Badge>
        )}
      </div>

      {unassigned.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mb-3 text-green-500 opacity-60" />
          <p className="font-medium">Alle Termine sind zugeordnet</p>
          <p className="text-sm mt-1">Keine offenen Termine in den nächsten 26 Wochen.</p>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* ------------------------------------------------------------------ */}
          {/* LEFT: Unassigned list                                               */}
          {/* ------------------------------------------------------------------ */}
          <div className="w-72 flex-shrink-0 border-r flex flex-col min-h-0">
            <div className="px-3 py-2 border-b bg-muted/30 flex-shrink-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Offene Termine
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-4">
              {weekGroups.map((group) => (
                <div key={group.weekKey}>
                  {/* Week label with jump button */}
                  <div className="flex items-center justify-between mb-1.5 px-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {group.label}
                      </span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 text-amber-600 border-amber-300">
                        {group.appointments.length}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      title="Im Dienstplan anzeigen"
                      onClick={() => navigate(`/dashboard/schedule-builder?week=${group.weekKey}`)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {group.appointments.map((appt) => (
                      <AppointmentCard
                        key={appt.id}
                        appt={appt}
                        selected={selectedAppt?.id === appt.id}
                        onClick={() => handleSelectAppt(appt)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* RIGHT: Planning grid                                                */}
          {/* ------------------------------------------------------------------ */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Selected appointment info bar */}
            {selectedAppt ? (
              <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border-b flex-shrink-0">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selectedAppt.customer?.farbe_kalender ?? '#10B981' }}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">
                    {selectedAppt.customer
                      ? [selectedAppt.customer.nachname, selectedAppt.customer.vorname].filter(Boolean).join(', ') || selectedAppt.customer.name
                      : selectedAppt.titel}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {format(new Date(selectedAppt.start_at), 'EEE, dd.MM. · HH:mm', { locale: de })}–{format(new Date(selectedAppt.end_at), 'HH:mm')}
                    {' '}· {formatDuration(selectedAppt.start_at, selectedAppt.end_at)}
                  </span>
                </div>
                <div className="text-xs text-primary font-medium flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  Mitarbeiter in der markierten Spalte anklicken
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelectedAppt(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0 bg-muted/20">
                <CalendarSearch className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Termin links auswählen → Mitarbeiter in der hervorgehobenen Spalte anklicken zum Zuweisen
                </span>
              </div>
            )}

            {/* Week navigation */}
            <div className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setViewWeekStart(prev => addWeeks(prev ?? effectiveWeekStart, -1))}
              >
                ← Vorwoche
              </Button>
              <div className="text-sm font-medium">
                KW {getWeek(effectiveWeekStart, { locale: de, weekStartsOn: 1 })} · {format(effectiveWeekStart, 'dd.MM.', { locale: de })} – {format(addDays(effectiveWeekStart, 6), 'dd.MM.yyyy', { locale: de })}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setViewWeekStart(prev => addWeeks(prev ?? effectiveWeekStart, 1))}
              >
                Nächste Woche →
              </Button>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4 w-36">
                      Mitarbeiter
                    </th>
                    {weekDays.map((day, idx) => {
                      const isHighlighted = idx === selectedDayIdx;
                      return (
                        <th
                          key={idx}
                          className={cn(
                            'text-center text-xs font-medium pb-2 px-1 rounded-t-md',
                            isHighlighted
                              ? 'text-primary bg-primary/5'
                              : 'text-muted-foreground',
                          )}
                        >
                          <div>{WEEKDAYS[idx]}</div>
                          <div className={cn('font-normal mt-0.5', isHighlighted && 'font-semibold text-primary')}>
                            {format(day, 'dd.MM.')}
                          </div>
                          {isHighlighted && selectedAppt && (
                            <div className="text-[9px] text-primary/70 mt-0.5">
                              {format(new Date(selectedAppt.start_at), 'HH:mm')}
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {employees.map((emp) => {
                    const counts = workload.get(emp.id) ?? Array(7).fill(0);
                    return (
                      <tr key={emp.id} className="group">
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: emp.farbe_kalender ?? '#3B82F6' }}
                            />
                            <span className="text-sm font-medium truncate max-w-[120px]">
                              {emp.name}
                            </span>
                          </div>
                        </td>
                        {weekDays.map((_, dayIdx) => {
                          const isHighlighted = dayIdx === selectedDayIdx;
                          const count = counts[dayIdx];
                          const canAssign = isHighlighted && selectedAppt && !assigning;

                          return (
                            <td key={dayIdx} className="px-1 py-1.5 text-center">
                              <button
                                type="button"
                                disabled={!canAssign}
                                onClick={() => canAssign && handleAssign(emp.id)}
                                className={cn(
                                  'w-full rounded-md border text-xs font-medium transition-all py-1.5 px-1',
                                  isHighlighted
                                    ? cn(
                                        cellColor(count, true),
                                        'border cursor-pointer hover:scale-105 hover:shadow-md active:scale-95',
                                      )
                                    : 'border-transparent cursor-default',
                                  !isHighlighted && count === 0 && 'text-muted-foreground/40',
                                  !isHighlighted && count > 0 && 'text-muted-foreground',
                                )}
                                title={
                                  isHighlighted
                                    ? `Zuweisen an ${emp.name} · ${count} Termin${count !== 1 ? 'e' : ''} an diesem Tag`
                                    : undefined
                                }
                              >
                                {count === 0 ? (
                                  <span className={isHighlighted ? 'text-green-600 dark:text-green-400' : 'opacity-30'}>
                                    {isHighlighted ? '+ frei' : '—'}
                                  </span>
                                ) : (
                                  <span>
                                    {isHighlighted
                                      ? `+ ${count} Termin${count !== 1 ? 'e' : ''}`
                                      : `${count}×`}
                                  </span>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {employees.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-12">
                  Keine aktiven Mitarbeiter gefunden.
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-2 border-t bg-muted/20 flex-shrink-0 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
                Frei
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
                1–2 Termine
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-100 border border-red-300" />
                Ausgelastet (3+)
              </div>
              <span className="ml-2 italic">Nur hervorgehobene Spalte (= Termintag) ist anklickbar</span>
            </div>
          </div>
        </div>
      )}

      {/* Detail dialog */}
      {editingAppointment && (
        <AppointmentDetailDialog
          isOpen={true}
          onClose={() => setEditingAppointment(null)}
          appointment={editingAppointment as any}
          employees={employees as any}
          customers={[]}
          onUpdate={async () => {
            queryClient.invalidateQueries({ queryKey: ['unassigned-appointments-board'] });
            setEditingAppointment(null);
          }}
          onDuplicate={async () => {}}
        />
      )}
    </div>
  );
}
