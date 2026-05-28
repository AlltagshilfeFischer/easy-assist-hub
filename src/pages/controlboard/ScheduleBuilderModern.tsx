import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, subDays, addMonths, subMonths, startOfMonth, endOfMonth, parseISO, isSameDay, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, X, AlertCircle, Users, Filter, Scissors } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { checkPauseConflict } from '@/lib/schedule/validatePause';
import { checkVerfuegbarkeit } from '@/lib/schedule/checkVerfuegbarkeit';
import { ProScheduleCalendar } from '@/components/schedule/calendar/ProScheduleCalendar';
// DayView entfernt — nur Wochen- und Monatsansicht
import { MonthView } from '@/components/schedule/calendar/MonthView';
import { ProScheduleHeader } from '@/components/schedule/ProScheduleHeader';
import { ProCalendarLegend } from '@/components/schedule/calendar/ProCalendarLegend';
import { EmployeeManagementDialog } from '@/components/schedule/dialogs/EmployeeManagementDialog';

import { AppointmentApprovalBar } from '@/components/schedule/AppointmentApprovalBar';
import { AbwesenheitVerwaltung } from '@/components/mitarbeiter/AbwesenheitVerwaltung';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Palmtree } from 'lucide-react';

import { AppointmentDetailDialog } from '@/components/schedule/dialogs/AppointmentDetailDialog';
// CreateAppointmentDialog entfernt — CreateAppointmentFromSlotDialog wird für beides genutzt
import { CreateRecurringAppointmentDialog } from '@/components/schedule/dialogs/CreateRecurringAppointmentDialog';
import { CreateAppointmentFromSlotDialog } from '@/components/schedule/dialogs/CreateAppointmentFromSlotDialog';
import { ConflictWarningDialog } from '@/components/schedule/dialogs/ConflictWarningDialog';
import { DraggableAppointment } from '@/components/schedule/DraggableAppointment';
import { AIAppointmentCreator } from '@/components/schedule/ai/AIAppointmentCreator';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { ConflictsNavigationCard } from '@/components/schedule/panels/ConflictsNavigationCard';
import { useAllVerfuegbarkeiten } from '@/hooks/useAllVerfuegbarkeiten';
import { DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent } from '@dnd-kit/core';

import type { Employee, Customer, CalendarAppointment } from '@/types/domain';

type LocalAppointment = CalendarAppointment & {
  customer?: Customer;
  employee?: Employee;
};

const ScheduleBuilderModern = () => {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentWeek, setCurrentWeek] = useState(() => {
    const weekParam = searchParams.get('week');
    return weekParam ? parseISO(weekParam) : new Date();
  });
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [currentDay, setCurrentDay] = useState(new Date());
  const [calendarScale, setCalendarScale] = useState<number>(() => {
    const saved = localStorage.getItem('calendarScale');
    return saved ? parseFloat(saved) : 0.9;
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeOrder, setEmployeeOrder] = useState<string[]>([]);
  const [appointments, setAppointments] = useState<LocalAppointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loading, setLoading] = useState(true);
  const [hiddenEmployeeIds, setHiddenEmployeeIds] = useState<Set<string>>(new Set());
  const [searchEmployee, setSearchEmployee] = useState('');
  const [filterKundenId, setFilterKundenId] = useState<string | null>(null);
  const [filterKategorie, setFilterKategorie] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [showCreateAppointment, setShowCreateAppointment] = useState(false);
  const [showCreateRecurring, setShowCreateRecurring] = useState(false);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [showSlotDialog, setShowSlotDialog] = useState(false);
  const [slotDialogData, setSlotDialogData] = useState<{ employeeId: string; date: Date } | null>(null);
  const [conflictWarning, setConflictWarning] = useState<{
    show: boolean;
    appointmentId: string;
    employeeId: string;
    conflicts: any[];
    pauseViolations: any[];
    targetDate?: Date;
  }>({
    show: false,
    appointmentId: '',
    employeeId: '',
    conflicts: [],
    pauseViolations: [],
    targetDate: undefined
  });
  const [abwesenheiten, setAbwesenheiten] = useState<any[]>([]);
  const [cutAppointment, setCutAppointment] = useState<LocalAppointment | null>(null);
  const [copyMode, setCopyMode] = useState(false);
  const [highlightedAppointmentId, setHighlightedAppointmentId] = useState<string | null>(null);
  const [seriesMoveDialog, setSeriesMoveDialog] = useState<{
    appointment: LocalAppointment;
    employeeId: string;
    targetDate: Date;
  } | null>(null);
  const [pendingCreateData, setPendingCreateData] = useState<Record<string, unknown> | null>(null);
  const [absenceConfirm, setAbsenceConfirm] = useState<{
    show: boolean;
    appointmentId: string;
    employeeId: string;
    targetDate: Date | undefined;
    employeeName: string;
  }>({ show: false, appointmentId: '', employeeId: '', targetDate: undefined, employeeName: '' });
  const [pendingUpdateAppointment, setPendingUpdateAppointment] = useState<any | null>(null);
  const [verfuegbarkeitPending, setVerfuegbarkeitPending] = useState<{
    type: 'drag';
    appointmentId: string;
    employeeId: string;
    targetDate?: Date;
    hinweis: string;
  } | {
    type: 'paste';
    employeeId: string | null;
    targetDate: Date;
    hinweis: string;
  } | {
    type: 'create';
    createData: Record<string, unknown>;
    hinweis: string;
  } | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fire-and-forget: schreibt einen Eintrag in audit_log für Terminänderungen
  const logTerminChange = (
    terminId: string,
    operation: string,
    oldData?: Record<string, unknown>,
    newData?: Record<string, unknown>,
  ) => {
    supabase.from('audit_log').insert([{
      table_name: 'termine',
      row_id: terminId,
      operation,
      old_data: (oldData ?? null) as any,
      new_data: (newData ?? null) as any,
      actor_benutzer_id: user?.id ?? null,
    }]).then(({ error }) => {
      if (error) console.warn('[audit_log] Termin-Änderung nicht geloggt:', error.message);
    });
  };

  const { data: allVerfuegbarkeiten = [] } = useAllVerfuegbarkeiten();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const parseDateKeyAsLocalDate = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Supabase Realtime: reload when termine table changes on any client
  useEffect(() => {
    let reloadTimeout: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel('realtime-termine-schedule')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'termine' }, () => {
        if (reloadTimeout) clearTimeout(reloadTimeout);
        reloadTimeout = setTimeout(() => loadData(true), 500);
      })
      .subscribe();
    return () => {
      if (reloadTimeout) clearTimeout(reloadTimeout);
      supabase.removeChannel(channel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load persisted employee order from localStorage after user is known
  useEffect(() => {
    if (!user?.id) return;
    const stored = localStorage.getItem(`employeeOrder_${user.id}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEmployeeOrder(parsed);
        }
      } catch {
        // ignore malformed data
      }
    }
  }, [user?.id]);

  // Persist employee order to localStorage whenever it changes
  useEffect(() => {
    if (!user?.id || employeeOrder.length === 0) return;
    localStorage.setItem(`employeeOrder_${user.id}`, JSON.stringify(employeeOrder));
  }, [employeeOrder, user?.id]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Fetch employees and their roles in parallel
      const [employeesResult, rolesResult] = await Promise.all([
        supabase
          .from('mitarbeiter')
          .select('*, benutzer(*)')
          .eq('ist_aktiv', true)
          .order('created_at', { ascending: true }),
        supabase
          .from('user_roles')
          .select('user_id, role'),
      ]);
      
      if (employeesResult.error) throw employeesResult.error;

      // Build roles map
      const rolesMap: Record<string, string> = {};
      if (rolesResult.data) {
        for (const entry of rolesResult.data) {
          const current = rolesMap[entry.user_id];
          const priority: Record<string, number> = { globaladmin: 5, geschaeftsfuehrer: 4, admin: 3, buchhaltung: 2, mitarbeiter: 1 };
          if (!current || (priority[entry.role] || 0) > (priority[current] || 0)) {
            rolesMap[entry.user_id] = entry.role;
          }
        }
      }

      const transformedEmployees: Employee[] = employeesResult.data?.map((emp: any) => {
        const benutzer = emp.benutzer;
        const fullName = benutzer?.vorname && benutzer?.nachname 
          ? `${benutzer.vorname} ${benutzer.nachname}` 
          : [emp.vorname, emp.nachname].filter(Boolean).join(' ') || `Mitarbeiter ${emp.id.slice(0, 8)}`;
        // Get role from user_roles table (more reliable than benutzer.rolle)
        const userRole = emp.benutzer_id ? rolesMap[emp.benutzer_id] : undefined;
        return {
          ...emp,
          name: fullName,
          rolle: userRole || benutzer?.rolle || undefined,
        };
      }) || [];

      const { data: customersData, error: customersError } = await supabase
        .from('kunden')
        .select('*')
        .eq('aktiv', true)
        .order('name');
      
      if (customersError) throw customersError;

      // Load a rolling 6-month window (2 months back, 4 months forward) to avoid
      // loading the entire appointment history into memory
      const rangeStart = new Date();
      rangeStart.setMonth(rangeStart.getMonth() - 2);
      rangeStart.setHours(0, 0, 0, 0);
      const rangeEnd = new Date();
      rangeEnd.setMonth(rangeEnd.getMonth() + 4);
      rangeEnd.setHours(23, 59, 59, 999);

      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('termine')
        .select(`
          *,
          customer:kunden!termine_kunden_id_fkey(*),
          employee:mitarbeiter!termine_mitarbeiter_id_fkey(*)
        `)
        .gte('start_at', rangeStart.toISOString())
        .lte('start_at', rangeEnd.toISOString())
        .order('start_at');
      
      if (appointmentsError) throw appointmentsError;

      const transformedAppointments: LocalAppointment[] = appointmentsData?.map((app: any) => {
        const empData = app.employee;
        return {
          id: app.id,
          titel: app.titel,
          kunden_id: app.kunden_id,
          mitarbeiter_id: app.mitarbeiter_id,
          start_at: app.start_at,
          end_at: app.end_at,
          vorlage_id: app.vorlage_id,
          ist_ausnahme: app.ist_ausnahme,
          ausnahme_grund: app.ausnahme_grund,
          status: app.status,
          notizen: app.notizen,
          kategorie: app.kategorie,
          absage_datum: app.absage_datum ?? null,
          absage_kanal: app.absage_kanal ?? null,
          customer: app.customer ? {
            ...app.customer,
            farbe_kalender: app.customer.farbe_kalender || '#10B981'
          } as Customer : undefined,
          employee: empData ? {
            id: empData.id,
            name: empData.vorname && empData.nachname ? `${empData.vorname} ${empData.nachname}` : `Mitarbeiter ${empData.id.slice(0, 8)}`,
            telefon: empData.telefon || '',
            ist_aktiv: empData.ist_aktiv || false,
            max_termine_pro_tag: empData.max_termine_pro_tag || 8,
            farbe_kalender: empData.farbe_kalender || '#10B981',
          } as Employee : undefined
        };
      }) || [];

      const transformedCustomers: Customer[] = (customersData ?? []).map(cust => ({
        ...cust,
        name: cust.name || [cust.vorname, cust.nachname].filter(Boolean).join(' ') || `Kunde ${cust.kunden_nummer}`,
        farbe_kalender: cust.farbe_kalender || '#10B981',
      })) as Customer[];

      setEmployees(transformedEmployees);
      
      // Initialize employee order only if nothing is stored yet (localStorage wins)
      const storedOrder = user?.id
        ? localStorage.getItem(`employeeOrder_${user.id}`)
        : null;
      if (!storedOrder && employeeOrder.length === 0) {
        setEmployeeOrder(transformedEmployees.map(emp => emp.id));
      }
      
      setCustomers(transformedCustomers);

      // Auto-complete: Vergangene scheduled-Termine sofort als completed behandeln
      const now = new Date();
      const autoCompletedIds: string[] = [];
      const finalAppointments = transformedAppointments.map(app => {
        if (['scheduled', 'in_progress'].includes(app.status) && new Date(app.end_at) < now) {
          autoCompletedIds.push(app.id);
          return { ...app, status: 'completed' as const };
        }
        return app;
      });
      setAppointments(finalAppointments);

      // Fire-and-forget: DB-Update für auto-completed Termine
      if (autoCompletedIds.length > 0) {
        const autoNow = new Date().toISOString();
        supabase
          .from('termine')
          .update({
            status: 'completed' as Database['public']['Enums']['termin_status'],
            auto_completed_at: autoNow,
            updated_at: autoNow,
          })
          .in('id', autoCompletedIds)
          .in('status', ['scheduled', 'in_progress'])
          .then(({ error }) => {
            if (error) console.error('Auto-complete update error:', error);
          });
      }

      // Load approved absences for the schedule
      const { data: abwesenheitenData } = await supabase
        .from('mitarbeiter_abwesenheiten')
        .select('id, mitarbeiter_id, grund, zeitraum, typ, status, von, bis')
        .eq('status', 'approved');
      setAbwesenheiten(abwesenheitenData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Fehler',
        description: 'Daten konnten nicht geladen werden.',
        variant: 'destructive'
      });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const weekDates = useMemo(() => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
    const dates: Date[] = [];
    let current = weekStart;

    while (current <= weekEnd) {
      dates.push(new Date(current));
      current = addDays(current, 1);
    }
    return dates;
  }, [currentWeek]);

  const filteredEmployees = useMemo(() => {
    const filtered = employees.filter(emp => 
      emp.ist_aktiv && 
      !hiddenEmployeeIds.has(emp.id) && 
      emp.name.toLowerCase().includes(searchEmployee.toLowerCase())
    );
    
    // Sort by custom order
    return filtered.sort((a, b) => {
      const aIndex = employeeOrder.indexOf(a.id);
      const bIndex = employeeOrder.indexOf(b.id);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [employees, searchEmployee, hiddenEmployeeIds, employeeOrder]);

  // Filter appointments by selected criteria
  const displayedAppointments = useMemo(() => {
    let result = appointments;
    if (filterKundenId) result = result.filter(a => a.kunden_id === filterKundenId);
    if (filterKategorie) result = result.filter(a => a.kategorie === filterKategorie);
    if (filterStatus === 'abgesagt') {
      result = result.filter(a => ['cancelled', 'abgesagt_rechtzeitig', 'nicht_angetroffen'].includes(a.status ?? ''));
    } else if (filterStatus) {
      result = result.filter(a => a.status === filterStatus);
    }
    return result;
  }, [appointments, filterKundenId, filterKategorie, filterStatus]);

  const handleReorderEmployees = (reorderedEmployees: Employee[]) => {
    const newOrder = reorderedEmployees.map(emp => emp.id);
    setEmployeeOrder(newOrder);
    setEmployees(reorderedEmployees);
  };

  const unassignedAppointments = useMemo(() => {
    const visibleDays = new Set(weekDates.map((d) => format(d, 'yyyy-MM-dd')));
    
    return appointments.filter(app => {
      const isUnassigned = !app.mitarbeiter_id || app.status === 'unassigned';
      if (!isUnassigned) return false;
      const appointmentDateKey = format(new Date(app.start_at), 'yyyy-MM-dd');
      return visibleDays.has(appointmentDateKey);
    });
  }, [appointments, weekDates]);

  const conflictingAppointments = useMemo(() => {
    const conflicts = new Set<string>();
    const sortedApps = [...appointments].sort((a, b) => 
      new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );

    sortedApps.forEach((app, index) => {
      if (!app.mitarbeiter_id) return;
      
      for (let i = index + 1; i < sortedApps.length; i++) {
        const other = sortedApps[i];
        if (other.mitarbeiter_id !== app.mitarbeiter_id) continue;
        
        const appStart = new Date(app.start_at);
        const appEnd = new Date(app.end_at);
        const otherStart = new Date(other.start_at);
        const otherEnd = new Date(other.end_at);

        if (appStart < otherEnd && appEnd > otherStart) {
          conflicts.add(app.id);
          conflicts.add(other.id);
        }
      }
    });

    return conflicts;
  }, [appointments]);

  const stats = useMemo(() => {
    const total = appointments.length;
    const assigned = appointments.filter(app => app.mitarbeiter_id).length;
    const unassigned = unassignedAppointments.length;
    const conflicts = conflictingAppointments.size;
    const activeEmployees = employees.filter(e => e.ist_aktiv).length;
    const totalEmployees = employees.length;

    // Compute real workload: appointments per employee / max_termine_pro_tag
    const avgWorkload = activeEmployees > 0
      ? Math.round(
          employees
            .filter(e => e.ist_aktiv)
            .reduce((sum, e) => {
              const empApps = appointments.filter(a => a.mitarbeiter_id === e.id).length;
              const max = e.max_termine_pro_tag || 8;
              return sum + (empApps / max) * 100;
            }, 0) / activeEmployees
        )
      : 0;

    return {
      totalAppointments: total,
      assignedAppointments: assigned,
      unassignedAppointments: unassigned,
      conflictCount: conflicts,
      activeEmployees,
      totalEmployees,
      averageWorkload: avgWorkload
    };
  }, [appointments, employees, conflictingAppointments, unassignedAppointments]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const PAUSE_MINUTES = 15;

  // Lokale Prüfung via State (für Drag&Drop — State ist dort aktuell genug).
  const isEmployeeAbsent = (employeeId: string, date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return abwesenheiten.some(a => {
      if (a.mitarbeiter_id !== employeeId || !a.von || !a.bis) return false;
      return dateStr >= a.von && dateStr <= a.bis;
    });
  };

  // DB-Abfrage für Abwesenheitsprüfung — zuverlässig, unabhängig vom State.
  // Nutzt DATE-Spalten von/bis direkt in SQL (kein Timezone-Problem).
  const queryMaAbwesend = async (employeeId: string, dateStr: string): Promise<boolean> => {
    const { data } = await supabase
      .from('mitarbeiter_abwesenheiten')
      .select('id')
      .eq('mitarbeiter_id', employeeId)
      .eq('status', 'approved')
      .lte('von', dateStr)
      .gte('bis', dateStr)
      .limit(1)
      .maybeSingle();
    return !!data;
  };

  const checkForConflicts = (appointmentId: string, employeeId: string, targetDate?: Date) => {
    const appointment = appointments.find(app => app.id === appointmentId);
    if (!appointment) return { overlaps: [] as typeof appointments, pauseViolations: [] as typeof appointments };

    let appointmentStart = new Date(appointment.start_at);
    let appointmentEnd = new Date(appointment.end_at);

    if (targetDate) {
      const originalStart = new Date(appointment.start_at);
      const durationMs = new Date(appointment.end_at).getTime() - originalStart.getTime();
      appointmentStart = new Date(targetDate);
      appointmentStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
      appointmentEnd = new Date(appointmentStart.getTime() + durationMs);
    }

    const pauseMs = PAUSE_MINUTES * 60 * 1000;
    const sameEmployee = appointments.filter(
      a => a.mitarbeiter_id === employeeId && a.id !== appointmentId
    );

    const overlaps = sameEmployee.filter(existing =>
      new Date(existing.start_at) < appointmentEnd &&
      new Date(existing.end_at) > appointmentStart
    );

    const pauseViolations = sameEmployee.filter(existing => {
      const existStart = new Date(existing.start_at);
      const existEnd = new Date(existing.end_at);
      // Skip if already a direct overlap
      if (existStart < appointmentEnd && existEnd > appointmentStart) return false;
      // Check if gap < 15 min (before or after)
      const gapBefore = appointmentStart.getTime() - existEnd.getTime();
      const gapAfter = existStart.getTime() - appointmentEnd.getTime();
      return (gapBefore >= 0 && gapBefore < pauseMs) || (gapAfter >= 0 && gapAfter < pauseMs);
    });

    return { overlaps, pauseViolations };
  };

  // Wenn ein Termin in die Vergangenheit verschoben wird und ein MA zugewiesen ist → completed
  const resolveStatus = (endAt: Date, employeeId: string | null): 'completed' | 'scheduled' | 'unassigned' => {
    if (!employeeId) return 'unassigned';
    return endAt < new Date() ? 'completed' : 'scheduled';
  };

  const assignAppointment = async (appointmentId: string, employeeId: string, targetDate?: Date, makeException: boolean = false) => {
    try {
      const appointment = appointments.find(app => app.id === appointmentId);
      if (!appointment) return;

      // Mark as exception if requested (for recurring appointments)
      const originalStart = new Date(appointment.start_at);
      let newEnd = new Date(appointment.end_at);
      let newStart = originalStart;

      if (targetDate) {
        const durationMs = newEnd.getTime() - originalStart.getTime();
        newStart = new Date(targetDate);
        newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds(), originalStart.getMilliseconds());
        newEnd = new Date(newStart.getTime() + durationMs);
      }

      const computedStatus = resolveStatus(newEnd, employeeId);

      let updateData: any = {
        mitarbeiter_id: employeeId,
        status: computedStatus,
      };

      if (makeException) {
        updateData.ist_ausnahme = true;
        updateData.ausnahme_grund = 'Verschoben per Drag & Drop';
      }

      if (targetDate) {
        updateData.start_at = newStart.toISOString();
        updateData.end_at = newEnd.toISOString();

        setAppointments(prev => prev.map(app =>
          app.id === appointmentId
            ? { ...app, mitarbeiter_id: employeeId, start_at: newStart.toISOString(), end_at: newEnd.toISOString(), status: computedStatus }
            : app
        ));
      } else {
        setAppointments(prev => prev.map(app =>
          app.id === appointmentId ? { ...app, mitarbeiter_id: employeeId, status: computedStatus } : app
        ));
      }

      const { error } = await supabase
        .from('termine')
        .update(updateData)
        .eq('id', appointmentId);

      if (error) throw error;

      // Terminhistorie loggen (fire-and-forget)
      const emp = employees.find(e => e.id === employeeId);
      const oldEmpName = employees.find(e => e.id === appointment.mitarbeiter_id)?.name ?? '—';
      const wasRescheduled = !!targetDate && !isSameDay(new Date(appointment.start_at), targetDate);
      logTerminChange(
        appointmentId,
        wasRescheduled
          ? `Verschoben → ${emp?.name ?? employeeId} am ${format(targetDate!, 'dd.MM.yyyy')}`
          : `Zugewiesen: ${oldEmpName} → ${emp?.name ?? employeeId}`,
        { mitarbeiter_id: appointment.mitarbeiter_id, start_at: appointment.start_at },
        { mitarbeiter_id: employeeId, start_at: updateData.start_at ?? appointment.start_at },
      );

      const employee = employees.find(emp => emp.id === employeeId);
      const appointmentLabel = appointment?.customer?.name || appointment?.titel || 'Termin';

      toast({
        title: 'Erfolg',
        description: `${appointmentLabel} → ${employee?.name}${targetDate ? ` am ${format(targetDate, 'dd.MM.yyyy')}` : ''}`
      });
      queryClient.invalidateQueries({ queryKey: ['unassigned-count'] });
      queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });
    } catch (error: any) {
      console.error('Error assigning appointment:', error);
      const errorMsg = error?.message?.includes('network')
        ? 'Netzwerkfehler — bitte Verbindung prüfen.'
        : `Fehler beim Zuweisen: ${error?.message || 'Unbekannter Fehler'}`;
      toast({
        title: 'Fehler',
        description: errorMsg,
        variant: 'destructive'
      });
      await loadData(); // Nur bei Fehler: Zustand synchronisieren
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const appointmentId = active.id as string;
    const overId = over.id as string;
    const appointment = appointments.find(app => app.id === appointmentId);
    if (!appointment) return;

    // Handle drop into "Unassigned" zone — mitarbeiter_id entfernen + ggf. Datum aendern
    if (overId === 'unassigned' || overId.startsWith('unassigned-')) {
      try {
        const updateData: Record<string, unknown> = {
          mitarbeiter_id: null,
          status: 'unassigned',
        };

        // Mark as exception if it's a recurring appointment
        if (appointment.vorlage_id && !appointment.ist_ausnahme) {
          updateData.ist_ausnahme = true;
          updateData.ausnahme_grund = 'Zuordnung entfernt per Drag & Drop';
        }

        // Wenn auf einen bestimmten Tag gedroppt (unassigned-YYYY-MM-DD), Datum anpassen
        const unassignedDateMatch = overId.match(/^unassigned-(\d{4}-\d{2}-\d{2})$/);
        let newStartAt = appointment.start_at;
        let newEndAt = appointment.end_at;
        if (unassignedDateMatch) {
          const targetDate = new Date(unassignedDateMatch[1]);
          const originalStart = new Date(appointment.start_at);
          const originalEnd = new Date(appointment.end_at);
          const durationMs = originalEnd.getTime() - originalStart.getTime();

          const newStart = new Date(targetDate);
          newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds(), 0);
          const newEnd = new Date(newStart.getTime() + durationMs);

          // Nur updaten wenn sich das Datum tatsaechlich aendert
          if (!isSameDay(originalStart, targetDate)) {
            updateData.start_at = newStart.toISOString();
            updateData.end_at = newEnd.toISOString();
            newStartAt = newStart.toISOString();
            newEndAt = newEnd.toISOString();
          }
        }

        const { error } = await supabase
          .from('termine')
          .update(updateData)
          .eq('id', appointmentId);

        if (error) throw error;

        // Optimistisch lokalen State updaten
        setAppointments(prev => prev.map(app =>
          app.id === appointmentId
            ? { ...app, mitarbeiter_id: null, status: 'unassigned' as const, start_at: newStartAt, end_at: newEndAt }
            : app
        ));

        queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });

        const appointmentLabel = appointment.customer?.name || appointment.titel || 'Termin';
        const dateChanged = unassignedDateMatch && !isSameDay(new Date(appointment.start_at), new Date(unassignedDateMatch[1]));
        toast({
          title: dateChanged ? 'Verschoben & Zuordnung entfernt' : 'Zuordnung entfernt',
          description: dateChanged
            ? `${appointmentLabel} auf ${format(new Date(newStartAt), 'EEEE dd.MM.', { locale: de })} verschoben`
            : `${appointmentLabel} ist jetzt unzugeordnet`
        });
      } catch (error) {
        toast({
          title: 'Fehler',
          description: 'Fehler beim Entfernen der Zuordnung.',
          variant: 'destructive'
        });
        await loadData();
      }
      return;
    }

    // Extract employee ID and date from drop zone ID format: "<employeeId>-YYYY-MM-DD" or "employee-<employeeId>-<dayIndex>"
    let employeeId: string;
    let targetDate: Date | undefined;
    
    // Try format: "employee-<employeeId>-<dayIndex>" (from CalendarGrid)
    const gridMatch = overId.match(/^employee-(.+)-(\d+)$/);
    if (gridMatch) {
      employeeId = gridMatch[1];
      const dayIndex = parseInt(gridMatch[2]);
      targetDate = weekDates[dayIndex];
    } else {
      // Try format: "<employeeId>-YYYY-MM-DD" (from ModernWeekCalendar)
      const dateMatch = overId.match(/^(.*)-(\d{4}-\d{2}-\d{2})$/);
      if (!dateMatch) {
        toast({
          title: 'Fehler',
          description: 'Ungültiger Zielbereich. Bitte auf einen Mitarbeiter ziehen.',
          variant: 'destructive'
        });
        return;
      }
      employeeId = dateMatch[1];
      targetDate = new Date(dateMatch[2]);
    }

    // Validate employee ID
    if (!employeeId || !employees.find(emp => emp.id === employeeId)) {
      toast({
        title: 'Fehler',
        description: 'Ungültiger Zielbereich. Bitte auf einen Mitarbeiter ziehen.',
        variant: 'destructive'
      });
      return;
    }

    // Erstgespräch darf nicht per Drag & Drop an einen Mitarbeiter zugewiesen werden
    if (appointment.kategorie === 'Erstgespräch') {
      const targetEmployee = employees.find(emp => emp.id === employeeId);
      if (targetEmployee?.rolle === 'mitarbeiter') {
        toast({
          title: 'Erstgespräch nicht möglich',
          description: `${targetEmployee.name} ist Mitarbeiter. Erstgespräche dürfen nur von der Geschäftsführung durchgeführt werden.`,
          variant: 'destructive'
        });
        return;
      }
    }

    // Check if this is a recurring appointment that hasn't been marked as exception (appointment already defined at function start)
    if (appointment.vorlage_id && !appointment.ist_ausnahme) {
      // Show dialog to ask if user wants to move just this appointment or the series
      setSeriesMoveDialog({ 
        appointment, 
        employeeId, 
        targetDate: targetDate || new Date(appointment.start_at) 
      });
      return;
    }

    // G-14: Check for employee absences on target date — show AlertDialog confirmation
    const effectiveDate = targetDate || new Date(appointment.start_at);
    const hasAbsence = isEmployeeAbsent(employeeId, effectiveDate);

    if (hasAbsence) {
      const absentEmployee = employees.find(e => e.id === employeeId);
      toast({
        title: 'Mitarbeiter abwesend',
        description: `${absentEmployee?.name || 'Mitarbeiter'} ist abwesend — Termin bleibt offen.`,
      });
      return;
    }

    // Verfügbarkeits-Check: Termin außerhalb des eingetragenen Zeitfensters?
    {
      const origStart = new Date(appointment.start_at);
      const origEnd = new Date(appointment.end_at);
      const durationMs = origEnd.getTime() - origStart.getTime();
      const checkStart = targetDate
        ? (() => { const ns = new Date(targetDate); ns.setHours(origStart.getHours(), origStart.getMinutes(), origStart.getSeconds(), origStart.getMilliseconds()); return ns; })()
        : origStart;
      const checkEnd = new Date(checkStart.getTime() + durationMs);
      const verfResult = checkVerfuegbarkeit(employeeId, checkStart.toISOString(), checkEnd.toISOString(), allVerfuegbarkeiten);
      if (verfResult.outsideWindow) {
        const hinweis = !verfResult.hasEntries
          ? 'Für diesen Mitarbeiter sind keine Verfügbarkeiten hinterlegt.'
          : verfResult.noEntryForDay
            ? 'Der Mitarbeiter ist an diesem Wochentag laut Verfügbarkeit nicht verfügbar.'
            : 'Der Termin liegt außerhalb der eingetragenen Verfügbarkeitszeit des Mitarbeiters.';
        setVerfuegbarkeitPending({ type: 'drag', appointmentId, employeeId, targetDate, hinweis });
        return;
      }
    }

    const { overlaps, pauseViolations } = checkForConflicts(appointmentId, employeeId, targetDate);

    if (overlaps.length > 0 || pauseViolations.length > 0) {
      setConflictWarning({
        show: true,
        appointmentId,
        employeeId,
        conflicts: overlaps,
        pauseViolations,
        targetDate
      });
    } else {
      await assignAppointment(appointmentId, employeeId, targetDate);
    }
  };

  const handleConflictConfirm = async () => {
    if (conflictWarning.appointmentId === '__new__' && pendingCreateData) {
      // Neuen Termin trotzdem erstellen (Konflikt-Check überspringen)
      await handleCreateAppointment({ ...pendingCreateData, _skipConflictCheck: true });
      setPendingCreateData(null);
    } else if (conflictWarning.appointmentId === '__update__' && pendingUpdateAppointment) {
      // Termin-Bearbeitung trotzdem speichern (Pause-Check überspringen)
      await performAppointmentUpdate(pendingUpdateAppointment);
      setPendingUpdateAppointment(null);
    } else {
      await assignAppointment(
        conflictWarning.appointmentId,
        conflictWarning.employeeId,
        conflictWarning.targetDate,
        false
      );
    }
    setConflictWarning({
      show: false,
      appointmentId: '',
      employeeId: '',
      conflicts: [],
      pauseViolations: [],
      targetDate: undefined
    });
  };

  const handleSlotClick = (employeeId: string, date: Date) => {
    // If we have a cut appointment, paste it
    if (cutAppointment) {
      handlePasteAppointment(employeeId, date);
    } else {
      setSlotDialogData({ employeeId, date });
      setShowSlotDialog(true);
    }
  };

  const handleCreateAppointment = async (data: any) => {
    try {

      const appointmentSchema = z.object({
        titel: z.string().trim().min(1, 'Titel ist erforderlich'),
        kunden_id: z.string().uuid('Ungültige Kunden-ID').nullable().optional(),
        mitarbeiter_id: z.string().uuid().nullable().optional(),
        start_at: z
          .string()
          .min(1, 'Startzeit fehlt')
          .refine((v) => !isNaN(Date.parse(v)), { message: 'Ungültige Startzeit' }),
        end_at: z
          .string()
          .min(1, 'Endzeit fehlt')
          .refine((v) => !isNaN(Date.parse(v)), { message: 'Ungültige Endzeit' }),
        notizen: z.string().nullable().optional(),
        kategorie: z.string().nullable().optional(),
        ausweichort_id: z.string().uuid().nullable().optional(),
      }).refine(
        (vals) => new Date(vals.end_at).getTime() > new Date(vals.start_at).getTime(),
        { path: ['end_at'], message: 'Endzeit muss nach Startzeit liegen' }
      );

      const parsed = appointmentSchema.safeParse(data);
      if (!parsed.success) {
        const message = parsed.error.issues?.[0]?.message || 'Bitte Eingaben prüfen.';
        toast({
          title: 'Ungültige Eingaben',
          description: message,
          variant: 'destructive',
        });
        return;
      }

      const payload = parsed.data;

      // Verfügbarkeits-Check VOR dem Erstellen (nur wenn MA zugewiesen)
      if (payload.mitarbeiter_id && !data._skipVerfuegbarkeitCheck) {
        const verfResult = checkVerfuegbarkeit(
          payload.mitarbeiter_id,
          payload.start_at,
          payload.end_at,
          allVerfuegbarkeiten
        );
        if (verfResult.outsideWindow) {
          const hinweis = !verfResult.hasEntries
            ? 'Für diesen Mitarbeiter sind keine Verfügbarkeiten hinterlegt.'
            : verfResult.noEntryForDay
              ? 'Der Mitarbeiter ist an diesem Wochentag laut Verfügbarkeit nicht verfügbar.'
              : 'Der Termin liegt außerhalb der eingetragenen Verfügbarkeitszeit des Mitarbeiters.';
          setVerfuegbarkeitPending({ type: 'create', createData: data as Record<string, unknown>, hinweis });
          return;
        }
      }

      // Konflikt-Prüfung VOR dem Erstellen (nur wenn MA zugewiesen)
      if (payload.mitarbeiter_id && !data._skipConflictCheck) {
        const newStart = new Date(payload.start_at);
        const newEnd = new Date(payload.end_at);
        const pauseMs = PAUSE_MINUTES * 60 * 1000;

        const sameEmployee = appointments.filter(
          a => a.mitarbeiter_id === payload.mitarbeiter_id
        );

        const overlaps = sameEmployee.filter(existing =>
          new Date(existing.start_at) < newEnd &&
          new Date(existing.end_at) > newStart
        );

        const pauseViolations = sameEmployee.filter(existing => {
          const existStart = new Date(existing.start_at);
          const existEnd = new Date(existing.end_at);
          if (existStart < newEnd && existEnd > newStart) return false;
          const gapBefore = newStart.getTime() - existEnd.getTime();
          const gapAfter = existStart.getTime() - newEnd.getTime();
          return (gapBefore >= 0 && gapBefore < pauseMs) || (gapAfter >= 0 && gapAfter < pauseMs);
        });

        if (overlaps.length > 0 || pauseViolations.length > 0) {
          setPendingCreateData(data);
          setConflictWarning({
            show: true,
            appointmentId: '__new__',
            employeeId: payload.mitarbeiter_id,
            conflicts: overlaps,
            pauseViolations,
            targetDate: newStart,
          });
          return;
        }
      }

      // Abwesenheits-Check — harter Blocker (kein Fallback auf "offen")
      const finalMitarbeiterId = payload.mitarbeiter_id ?? null;
      if (finalMitarbeiterId) {
        const apptDateStr = format(new Date(payload.start_at), 'yyyy-MM-dd');
        const maAbwesend = await queryMaAbwesend(finalMitarbeiterId, apptDateStr);
        if (maAbwesend) {
          const emp = employees.find(e => e.id === payload.mitarbeiter_id);
          toast({ title: 'Mitarbeiter abwesend', description: `${emp?.name || 'Mitarbeiter'} ist an diesem Tag abwesend. Bitte anderen Mitarbeiter wählen.`, variant: 'destructive' });
          return;
        }
      }

      const { data: inserted, error } = await supabase
        .from('termine')
        .insert([{
          titel: payload.titel,
          kunden_id: payload.kunden_id ?? null,
          mitarbeiter_id: finalMitarbeiterId,
          start_at: payload.start_at,
          end_at: payload.end_at,
          status: finalMitarbeiterId ? 'scheduled' : 'unassigned',
          notizen: payload.notizen ?? null,
          kategorie: payload.kategorie ?? null,
          ausweichort_id: payload.ausweichort_id ?? null,
        }])
        .select(`*, customer:kunden!termine_kunden_id_fkey(*), employee:mitarbeiter!termine_mitarbeiter_id_fkey(*)`)
        .single();

      if (error) throw error;

      // Optimistisch in lokalen State einfügen
      if (inserted) {
        const empData = inserted.employee as any;
        const newApp: LocalAppointment = {
          id: inserted.id,
          titel: inserted.titel,
          kunden_id: inserted.kunden_id,
          mitarbeiter_id: inserted.mitarbeiter_id,
          start_at: inserted.start_at,
          end_at: inserted.end_at,
          vorlage_id: inserted.vorlage_id,
          ist_ausnahme: inserted.ist_ausnahme,
          ausnahme_grund: inserted.ausnahme_grund,
          status: inserted.status,
          notizen: inserted.notizen,
          kategorie: inserted.kategorie as any,
          customer: inserted.customer ? { ...(inserted.customer as any), farbe_kalender: (inserted.customer as any).farbe_kalender || '#10B981' } : undefined,
          employee: empData ? {
            id: empData.id,
            name: empData.vorname && empData.nachname ? `${empData.vorname} ${empData.nachname}` : `Mitarbeiter ${empData.id.slice(0, 8)}`,
            farbe_kalender: empData.farbe_kalender || '#10B981',
          } as Employee : undefined,
        };
        setAppointments(prev => [...prev, newApp]);
      }

      queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });

      toast({
        title: 'Erfolg',
        description: 'Termin wurde erstellt.'
      });

      setShowCreateAppointment(false);
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: `Fehler beim Erstellen des Termins: ${error?.message || error}`,
        variant: 'destructive'
      });
    }
  };

  const handleCreateRecurringAppointment = async (data: any) => {
    try {
      // 1) Create template and return its id
      const { data: template, error } = await supabase
        .from('termin_vorlagen')
        .insert([{
          titel: data.titel,
          kunden_id: data.kunden_id,
          mitarbeiter_id: data.mitarbeiter_id,
          wochentag: data.wochentag,
          start_zeit: data.start_zeit,
          dauer_minuten: data.dauer_minuten,
          intervall: data.intervall,
          gueltig_von: data.gueltig_von,
          gueltig_bis: data.gueltig_bis,
          notizen: data.notizen,
          ausweichort_id: data.ausweichort_id ?? null,
          ist_aktiv: true
        }])
        .select('id')
        .single();

      if (error) throw error;

      // 2) Try server-side generation first
      const fromDate = data.gueltig_von as string; // 'yyyy-MM-dd'
      const toDate = (data.gueltig_bis as string) || format(addMonths(new Date(fromDate), 12), 'yyyy-MM-dd');

      const { data: genCount, error: genError } = await supabase.rpc('generate_termine_from_vorlagen', {
        p_from: fromDate,
        p_to: toDate
      });

      if (genError) throw genError;

      let created = Number(genCount ?? 0);

      // 3) If nothing generated (likely wegen Zeitfenster/Verfügbarkeit), fall back to client-side generation
      if (created === 0) {
        // Only a hint to the user, but do not block creation
        toast({
          title: 'Hinweis',
          description: 'Es wurden keine Termine durch die Regeln erzeugt. Erzeuge Termine trotzdem (Zeitfenster ignoriert).',
        });

        const start = new Date(`${fromDate}T00:00:00`);
        const end = new Date(`${toDate}T00:00:00`);
        const targetDow = ((Number(data.wochentag) % 7) + 7) % 7; // normalisiere auf 0-6

        // Find first occurrence on/after start matching weekday
        const first = new Date(start);
        while (first.getDay() !== targetDow) first.setDate(first.getDate() + 1);

        const stepDays = data.intervall === 'biweekly' ? 14 : 7;
        const isMonthly = data.intervall === 'monthly';
        const [hh, mm] = String(data.start_zeit || '09:00').split(':').map((n: string) => parseInt(n, 10));
        const duration = Number(data.dauer_minuten || 60);

        // Abwesenheiten für den MA im Zeitraum vorab laden (ein Query für alle Instanzen)
        let maAbwesenheiten: { von: string; bis: string }[] = [];
        if (data.mitarbeiter_id) {
          const { data: absData } = await supabase
            .from('mitarbeiter_abwesenheiten')
            .select('von, bis')
            .eq('mitarbeiter_id', data.mitarbeiter_id)
            .eq('status', 'approved')
            .lte('von', toDate)
            .gte('bis', fromDate);
          maAbwesenheiten = (absData ?? []).filter(a => a.von && a.bis);
        }

        const isAbsentOn = (dateStr: string) =>
          maAbwesenheiten.some(a => dateStr >= a.von && dateStr <= a.bis);

        const rows: any[] = [];
        let d = new Date(first);
        while (d <= end) {
          const startAt = new Date(d);
          startAt.setHours(hh, mm, 0, 0);
          const endAt = new Date(startAt.getTime() + duration * 60_000);
          const dateStr = format(startAt, 'yyyy-MM-dd');
          const absent = isAbsentOn(dateStr);

          rows.push({
            titel: data.titel,
            kunden_id: data.kunden_id,
            mitarbeiter_id: absent ? null : (data.mitarbeiter_id ?? null),
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            status: (data.mitarbeiter_id && !absent) ? 'scheduled' : 'unassigned',
            vorlage_id: template?.id ?? null,
            notizen: data.notizen ?? null,
            ausweichort_id: data.ausweichort_id ?? null,
          });

          d = isMonthly ? addMonths(d, 1) : new Date(d.setDate(d.getDate() + stepDays));
        }

        if (rows.length > 0) {
          const { error: insertErr } = await supabase.from('termine').insert(rows);
          if (insertErr) throw insertErr;
          created = rows.length;
        }
      }

      if (created === 0) {
        toast({
          title: 'Hinweis',
          description: 'Es wurden keine Termine erzeugt. Prüfe Zeitraum, Wochentag und Verfügbarkeiten.',
        });
      } else {
        toast({
          title: 'Erfolg',
          description: `Regeltermin erstellt. ${created} Termine erzeugt.`,
        });
      }

      // Jump calendar to the first generated week so the user sees the result
      setCurrentWeek(new Date(fromDate));

      queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });
      await loadData();
      setShowCreateRecurring(false);
    } catch (error: any) {
      console.error('Error creating recurring appointment:', error);
      toast({
        title: 'Fehler',
        description: `Fehler beim Erstellen des Regeltermins: ${error?.message || error}`,
        variant: 'destructive'
      });
    }
  };

  const handleSlotSingleAppointment = async (data: any) => {
    await handleCreateAppointment(data);
    setShowSlotDialog(false);
  };

  const handleSlotRecurringAppointment = async (data: any) => {
    await handleCreateRecurringAppointment(data);
    setShowSlotDialog(false);
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    try {
      // rechnungspositionen hat ON DELETE RESTRICT → muss vor termine gelöscht werden
      // termin_aenderungen hat ON DELETE CASCADE → wird von DB automatisch gelöscht
      const { error: rpError } = await supabase
        .from('rechnungspositionen')
        .delete()
        .eq('termin_id', appointmentId);
      if (rpError) throw rpError;

      const { error } = await supabase
        .from('termine')
        .delete()
        .eq('id', appointmentId);
      if (error) throw error;

      // Optimistisch aus lokalem State entfernen
      setAppointments(prev => prev.filter(app => app.id !== appointmentId));

      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });

      toast({
        title: 'Erfolg',
        description: 'Termin wurde gelöscht.'
      });
    } catch (error) {
      console.error('Error deleting appointment:', error);
      toast({
        title: 'Fehler',
        description: 'Fehler beim Löschen des Termins.',
        variant: 'destructive'
      });
      await loadData(); // Bei Fehler: Zustand synchronisieren
      throw error;
    }
  };

  const handleDeleteSeries = async (vorlageId: string, _mode: 'single' | 'all') => {
    try {
      // Use start of today so appointments earlier today are also included
      const todayStart = startOfDay(new Date()).toISOString();

      const { data: betroffene, error: fetchError } = await supabase
        .from('termine')
        .select('id')
        .eq('vorlage_id', vorlageId)
        .gte('start_at', todayStart);
      if (fetchError) throw fetchError;

      if (betroffene && betroffene.length > 0) {
        const ids = betroffene.map(t => t.id);
        // rechnungspositionen hat ON DELETE RESTRICT → muss vor termine gelöscht werden
        const { error: rpErr } = await supabase.from('rechnungspositionen').delete().in('termin_id', ids);
        if (rpErr) throw rpErr;
      }

      const { error: vorlagenErr } = await supabase
        .from('termin_vorlagen')
        .update({ ist_aktiv: false })
        .eq('id', vorlageId);
      if (vorlagenErr) throw vorlagenErr;

      const { error: termineErr } = await supabase
        .from('termine')
        .delete()
        .eq('vorlage_id', vorlageId)
        .gte('start_at', todayStart);
      if (termineErr) throw termineErr;

      queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });
      toast({ title: 'Terminserie gelöscht' });
      await loadData();
    } catch (error) {
      console.error('Error deleting series:', error);
      toast({ title: 'Fehler', description: 'Fehler beim Löschen der Serie.', variant: 'destructive' });
      await loadData();
      throw error;
    }
  };

  const draggedAppointment = appointments.find(app => app.id === activeId);

  // Cut/Copy/Paste handlers
  const handleCutAppointment = (appointment: LocalAppointment) => {
    setCutAppointment(appointment);
    setCopyMode(false);
    toast({
      title: 'Ausgeschnitten',
      description: `Termin "${appointment.titel}" kann jetzt eingefügt werden.`
    });
  };

  const handleCopyAppointment = (appointment: LocalAppointment) => {
    setCutAppointment(appointment);
    setCopyMode(true);
    toast({
      title: 'Kopiert',
      description: `Termin "${appointment.titel}" kann jetzt eingefügt werden.`
    });
  };

  const handlePasteAppointment = async (employeeId: string | null, targetDate: Date, skipVerfuegbarkeitCheck = false) => {
    if (!cutAppointment) return;

    try {
      const originalStart = new Date(cutAppointment.start_at);
      const originalEnd = new Date(cutAppointment.end_at);

      // Create new dates with target date but original times
      const newStart = new Date(targetDate);
      newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);

      const newEnd = new Date(targetDate);
      newEnd.setHours(originalEnd.getHours(), originalEnd.getMinutes(), 0, 0);

      // Abwesenheits-Check — harter Blocker
      if (employeeId) {
        const hasAbsence = isEmployeeAbsent(employeeId, targetDate);
        if (hasAbsence) {
          const emp = employees.find(e => e.id === employeeId);
          toast({ title: 'Mitarbeiter abwesend', description: `${emp?.name || 'Mitarbeiter'} ist an diesem Tag abwesend — Termin kann nicht eingefügt werden.`, variant: 'destructive' });
          return;
        }
      }

      // Verfügbarkeits-Check
      if (employeeId && !skipVerfuegbarkeitCheck) {
        const verfResult = checkVerfuegbarkeit(employeeId, newStart.toISOString(), newEnd.toISOString(), allVerfuegbarkeiten);
        if (verfResult.outsideWindow) {
          const hinweis = !verfResult.hasEntries
            ? 'Für diesen Mitarbeiter sind keine Verfügbarkeiten hinterlegt.'
            : verfResult.noEntryForDay
              ? 'Der Mitarbeiter ist an diesem Wochentag laut Verfügbarkeit nicht verfügbar.'
              : 'Der Termin liegt außerhalb der eingetragenen Verfügbarkeitszeit des Mitarbeiters.';
          setVerfuegbarkeitPending({ type: 'paste', employeeId, targetDate, hinweis });
          return;
        }
      }

      const employee = employeeId ? employees.find(emp => emp.id === employeeId) : null;

      if (copyMode) {
        // COPY: Insert new appointment (Einzeltermin, no vorlage_id)
        const copyStatus = resolveStatus(newEnd, employeeId ?? null);
        const { data: newAppointment, error } = await supabase
          .from('termine')
          .insert({
            titel: cutAppointment.titel,
            kunden_id: cutAppointment.kunden_id,
            mitarbeiter_id: employeeId,
            start_at: newStart.toISOString(),
            end_at: newEnd.toISOString(),
            status: copyStatus,
            vorlage_id: null,
            ist_ausnahme: false,
            notizen: cutAppointment.notizen ?? null,
            kategorie: cutAppointment.kategorie ?? null,
          })
          .select('*, kunden(*), mitarbeiter(*)')
          .single();

        if (error) throw error;

        toast({
          title: 'Kopiert & Eingefügt',
          description: employee
            ? `${cutAppointment.customer?.name} → ${employee.name} am ${format(targetDate, 'dd.MM.yyyy')}`
            : `${cutAppointment.customer?.name} → Unzugeordnet am ${format(targetDate, 'dd.MM.yyyy')}`
        });

        // Add new appointment to local state
        if (newAppointment) {
          const mapped = {
            ...newAppointment,
            customer: newAppointment.kunden ? { id: newAppointment.kunden.id, name: newAppointment.kunden.name, farbe_kalender: newAppointment.kunden.farbe_kalender } : undefined,
            employee: newAppointment.mitarbeiter ? { id: newAppointment.mitarbeiter.id, name: `${newAppointment.mitarbeiter.vorname || ''} ${newAppointment.mitarbeiter.nachname || ''}`.trim(), farbe_kalender: newAppointment.mitarbeiter.farbe_kalender || '#3B82F6' } : undefined,
          } as unknown as LocalAppointment;
          setAppointments(prev => [...prev, mapped]);
        }
        queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });
        // Keep clipboard for multiple pastes in copy mode
      } else {
        // CUT: Move existing appointment
        const cutStatus = resolveStatus(newEnd, employeeId ?? null);
        const isSeriesInstance = cutAppointment.vorlage_id && !cutAppointment.ist_ausnahme;
        const { error } = await supabase
          .from('termine')
          .update({
            mitarbeiter_id: employeeId,
            start_at: newStart.toISOString(),
            end_at: newEnd.toISOString(),
            status: cutStatus,
            // Goldene Regel: Regeltermin-Instanz wird zur Ausnahme, damit Regenerierung sie nicht überschreibt
            ...(isSeriesInstance && { ist_ausnahme: true, ausnahme_grund: 'Manuell verschoben' }),
          })
          .eq('id', cutAppointment.id);

        if (error) throw error;

        toast({
          title: 'Eingefügt',
          description: employee
            ? `${cutAppointment.customer?.name} → ${employee.name} am ${format(targetDate, 'dd.MM.yyyy')}`
            : `${cutAppointment.customer?.name} → Unzugeordnet am ${format(targetDate, 'dd.MM.yyyy')}`
        });

        setAppointments(prev => prev.map(app =>
          app.id === cutAppointment.id
            ? {
                ...app,
                mitarbeiter_id: employeeId,
                start_at: newStart.toISOString(),
                end_at: newEnd.toISOString(),
                status: cutStatus,
                ...(isSeriesInstance && { ist_ausnahme: true, ausnahme_grund: 'Manuell verschoben' }),
              }
            : app
        ));
        queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });
        setCutAppointment(null);
        setCopyMode(false);
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Fehler beim Einfügen des Termins.',
        variant: 'destructive'
      });
    }
  };

  const handleCancelCut = () => {
    const wasCopy = copyMode;
    setCutAppointment(null);
    setCopyMode(false);
    toast({
      title: 'Abgebrochen',
      description: wasCopy ? 'Kopieren wurde abgebrochen.' : 'Ausschneiden wurde abgebrochen.'
    });
  };

  // G-14: Abwesenheits-Bestätigung nach Drop — Zuweisung trotz Abwesenheit fortführen
  const handleAbsenceConfirm = async () => {
    const { appointmentId, employeeId, targetDate } = absenceConfirm;
    setAbsenceConfirm({ show: false, appointmentId: '', employeeId: '', targetDate: undefined, employeeName: '' });

    const { overlaps, pauseViolations } = checkForConflicts(appointmentId, employeeId, targetDate);
    if (overlaps.length > 0 || pauseViolations.length > 0) {
      setConflictWarning({
        show: true,
        appointmentId,
        employeeId,
        conflicts: overlaps,
        pauseViolations,
        targetDate,
      });
    } else {
      await assignAppointment(appointmentId, employeeId, targetDate);
    }
  };

  const handleVerfuegbarkeitConfirm = async () => {
    if (!verfuegbarkeitPending) return;
    const pending = verfuegbarkeitPending;
    setVerfuegbarkeitPending(null);

    if (pending.type === 'drag') {
      const { overlaps, pauseViolations } = checkForConflicts(pending.appointmentId, pending.employeeId, pending.targetDate);
      if (overlaps.length > 0 || pauseViolations.length > 0) {
        setConflictWarning({
          show: true,
          appointmentId: pending.appointmentId,
          employeeId: pending.employeeId,
          conflicts: overlaps,
          pauseViolations,
          targetDate: pending.targetDate,
        });
      } else {
        await assignAppointment(pending.appointmentId, pending.employeeId, pending.targetDate);
      }
    } else if (pending.type === 'create') {
      await handleCreateAppointment({ ...pending.createData, _skipVerfuegbarkeitCheck: true });
    } else {
      await handlePasteAppointment(pending.employeeId, pending.targetDate, true);
    }
  };

  // G-09: Termin duplizieren — Original bleibt, Kopie +7 Tage, Status unassigned
  const handleDuplicateAppointment = async (appointment: LocalAppointment) => {
    try {
      const originalStart = new Date(appointment.start_at);
      const originalEnd = new Date(appointment.end_at);
      const durationMs = originalEnd.getTime() - originalStart.getTime();

      const newStart = addDays(originalStart, 7);
      const newEnd = new Date(newStart.getTime() + durationMs);

      const { data: inserted, error } = await supabase
        .from('termine')
        .insert([{
          titel: appointment.titel,
          kunden_id: appointment.kunden_id ?? null,
          mitarbeiter_id: null,
          start_at: newStart.toISOString(),
          end_at: newEnd.toISOString(),
          status: 'unassigned' as Database['public']['Enums']['termin_status'],
          vorlage_id: null,
          ist_ausnahme: false,
          notizen: appointment.notizen ?? null,
          kategorie: appointment.kategorie ?? null,
        }])
        .select(`*, customer:kunden!termine_kunden_id_fkey(*), employee:mitarbeiter!termine_mitarbeiter_id_fkey(*)`)
        .single();

      if (error) throw error;

      if (inserted) {
        const newApp: LocalAppointment = {
          id: inserted.id,
          titel: inserted.titel,
          kunden_id: inserted.kunden_id,
          mitarbeiter_id: inserted.mitarbeiter_id,
          start_at: inserted.start_at,
          end_at: inserted.end_at,
          vorlage_id: inserted.vorlage_id,
          ist_ausnahme: inserted.ist_ausnahme,
          ausnahme_grund: inserted.ausnahme_grund,
          status: inserted.status,
          notizen: inserted.notizen,
          kategorie: inserted.kategorie as LocalAppointment['kategorie'],
          customer: inserted.customer
            ? { ...(inserted.customer as any), farbe_kalender: (inserted.customer as any).farbe_kalender || '#10B981' }
            : undefined,
          employee: undefined,
        };
        setAppointments(prev => [...prev, newApp]);
        setCurrentWeek(newStart);
      }

      queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });

      toast({
        title: 'Termin kopiert',
        description: `Kopie erstellt (+7 Tage, Status: unzugeordnet)`,
      });
    } catch (error: any) {
      console.error('Error duplicating appointment:', error);
      toast({
        title: 'Fehler',
        description: `Fehler beim Duplizieren: ${error?.message || 'Unbekannter Fehler'}`,
        variant: 'destructive',
      });
    }
  };

  /**
   * Perform the actual DB update for an appointment from AppointmentDetailDialog.
   * Called directly when no pause conflict, or after user confirms override.
   */
  const performAppointmentUpdate = async (appointment: any) => {
    try {
      // Bug 11: Wenn Status → unassigned, Mitarbeiter entfernen
      const effectiveMitarbeiterId = appointment.status === 'unassigned'
        ? null
        : appointment.mitarbeiter_id;

      const updateData: any = {
        titel: appointment.titel,
        status: appointment.status,
        mitarbeiter_id: effectiveMitarbeiterId,
        kunden_id: appointment.kunden_id ?? null,
        start_at: appointment.start_at,
        end_at: appointment.end_at,
        notizen: appointment.notizen ?? null,
        iststunden: appointment.iststunden ?? null,
        kategorie: appointment.kategorie ?? null,
        absage_datum: appointment.absage_datum ?? null,
        absage_kanal: appointment.absage_kanal ?? null,
      };

      // Include series exception fields if present
      if (appointment.ist_ausnahme !== undefined) {
        updateData.ist_ausnahme = appointment.ist_ausnahme;
      }
      if (appointment.ausnahme_grund) {
        updateData.ausnahme_grund = appointment.ausnahme_grund;
      }

      const { error } = await supabase
        .from('termine')
        .update(updateData)
        .eq('id', appointment.id);

      if (error) throw error;

      // Terminhistorie loggen (fire-and-forget)
      const oldApp = appointments.find(a => a.id === appointment.id);
      if (oldApp) {
        const oldData: Record<string, unknown> = {};
        const newData: Record<string, unknown> = {};
        const STATUS_LABELS: Record<string, string> = {
          unassigned: 'Offen', scheduled: 'Geplant', in_progress: 'In Bearb.',
          completed: 'Abgeschlossen', cancelled: 'Abgesagt (kurzfr.)',
          nicht_angetroffen: 'Nicht angetroffen', abgesagt_rechtzeitig: 'Rechtz. abgesagt',
          abgerechnet: 'Abgerechnet', bezahlt: 'Bezahlt',
        };
        let operation = 'Aktualisiert';

        if (oldApp.status !== appointment.status) {
          oldData.status = oldApp.status;
          newData.status = appointment.status;
          operation = `Status: ${STATUS_LABELS[oldApp.status ?? ''] ?? oldApp.status} → ${STATUS_LABELS[appointment.status] ?? appointment.status}`;
        } else if (oldApp.mitarbeiter_id !== effectiveMitarbeiterId) {
          const oldEmp = employees.find(e => e.id === oldApp.mitarbeiter_id)?.name ?? '—';
          const newEmp = employees.find(e => e.id === effectiveMitarbeiterId)?.name ?? '—';
          oldData.mitarbeiter_id = oldApp.mitarbeiter_id;
          newData.mitarbeiter_id = effectiveMitarbeiterId;
          operation = `Mitarbeiter: ${oldEmp} → ${newEmp}`;
        } else if (oldApp.start_at !== appointment.start_at) {
          oldData.start_at = oldApp.start_at;
          oldData.end_at = oldApp.end_at;
          newData.start_at = appointment.start_at;
          newData.end_at = appointment.end_at;
          operation = `Verschoben: ${format(new Date(oldApp.start_at), 'dd.MM. HH:mm', { locale: de })} → ${format(new Date(appointment.start_at), 'dd.MM. HH:mm', { locale: de })}`;
        }
        logTerminChange(appointment.id, operation, oldData, newData);
      }

      // Optimistisch lokalen State updaten
      setAppointments(prev => prev.map(app =>
        app.id === appointment.id
          ? { ...app, ...updateData, mitarbeiter_id: effectiveMitarbeiterId }
          : app
      ));

      queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });

      toast({
        title: 'Erfolg',
        description: appointment.ist_ausnahme
          ? 'Einzeltermin wurde als Ausnahme gespeichert.'
          : 'Termin wurde aktualisiert.'
      });

      setEditingAppointment(null);
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Fehler beim Aktualisieren.',
        variant: 'destructive'
      });
      await loadData(); // Bei Fehler: synchronisieren
    }
  };

  /**
   * Called by AppointmentDetailDialog.onUpdate.
   * Runs pause validation first, then either saves directly or shows ConflictWarningDialog.
   */
  const handleAppointmentUpdate = async (appointment: any) => {
    const effectiveMitarbeiterId = appointment.status === 'unassigned'
      ? null
      : appointment.mitarbeiter_id;

    // Only validate when a Mitarbeiter is assigned
    if (effectiveMitarbeiterId) {
      const newStart = new Date(appointment.start_at);
      const newEnd = new Date(appointment.end_at);

      const result = checkPauseConflict(
        effectiveMitarbeiterId,
        newStart,
        newEnd,
        appointments,
        appointment.id, // exclude the appointment being edited
      );

      if (result.hasConflict) {
        setPendingUpdateAppointment(appointment);
        setConflictWarning({
          show: true,
          appointmentId: '__update__',
          employeeId: effectiveMitarbeiterId,
          conflicts: result.overlappingAppointments,
          pauseViolations: result.violatingAppointments,
          targetDate: newStart,
        });
        return; // Wait for user confirmation
      }
    }

    await performAppointmentUpdate(appointment);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Lade Daten...</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] flex flex-col gap-2 sm:gap-3 p-2 sm:p-4 bg-background overflow-hidden">
        {/* Pro Header */}
        <ProScheduleHeader
          currentWeek={currentWeek}
          onPreviousWeek={() => {
            if (viewMode === 'week') setCurrentWeek(prev => subWeeks(prev, 1));
            else setCurrentWeek(prev => subMonths(prev, 1));
          }}
          onNextWeek={() => {
            if (viewMode === 'week') setCurrentWeek(prev => addWeeks(prev, 1));
            else setCurrentWeek(prev => addMonths(prev, 1));
          }}
          onToday={() => {
            setCurrentWeek(new Date());
            setCurrentDay(new Date());
          }}
          onEmployeeManagement={() => setShowEmployeeDialog(true)}
          view={viewMode}
          onViewChange={setViewMode}
        />

        {/* Filter-Zeile */}
        <div className="flex items-center gap-2 px-1 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

          {/* Kundenfilter */}
          <Select
            value={filterKundenId ?? '__all__'}
            onValueChange={(v) => setFilterKundenId(v === '__all__' ? null : v)}
          >
            <SelectTrigger className="w-36 sm:w-48 h-8 text-xs sm:text-sm">
              <SelectValue placeholder="Alle Kunden" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Kunden</SelectItem>
              {customers
                .sort((a, b) => ((a.nachname ?? '') + (a.vorname ?? '')).localeCompare((b.nachname ?? '') + (b.vorname ?? '')))
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {[c.nachname, c.vorname].filter(Boolean).join(', ') || c.name || 'Unbenannt'}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {/* Kategoriefilter */}
          <Select
            value={filterKategorie ?? '__all__'}
            onValueChange={(v) => setFilterKategorie(v === '__all__' ? null : v)}
          >
            <SelectTrigger className="w-32 sm:w-40 h-8 text-xs sm:text-sm">
              <SelectValue placeholder="Alle Labels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Labels</SelectItem>
              <SelectItem value="Kundentermin">Kundentermin</SelectItem>
              <SelectItem value="Erstgespräch">Erstgespräch</SelectItem>
              <SelectItem value="Regelbesuch">Regelbesuch</SelectItem>
              <SelectItem value="Schulung">Schulung</SelectItem>
              <SelectItem value="Meeting">Meeting</SelectItem>
              <SelectItem value="Bewerbungsgespräch">Bewerbungsgespräch</SelectItem>
              <SelectItem value="Intern">Intern</SelectItem>
              <SelectItem value="Blocker">Blocker</SelectItem>
              <SelectItem value="Sonstiges">Sonstiges</SelectItem>
            </SelectContent>
          </Select>

          {/* Statusfilter */}
          <Select
            value={filterStatus ?? '__all__'}
            onValueChange={(v) => setFilterStatus(v === '__all__' ? null : v)}
          >
            <SelectTrigger className="w-32 sm:w-40 h-8 text-xs sm:text-sm">
              <SelectValue placeholder="Alle Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Status</SelectItem>
              <SelectItem value="unassigned">Offen</SelectItem>
              <SelectItem value="scheduled">Geplant</SelectItem>
              <SelectItem value="in_progress">In Bearbeitung</SelectItem>
              <SelectItem value="completed">Abgeschlossen</SelectItem>
              <SelectItem value="abgesagt">Abgesagt (alle)</SelectItem>
              <SelectItem value="cancelled">Kurzfristig abgesagt</SelectItem>
              <SelectItem value="abgesagt_rechtzeitig">Rechtzeitig abgesagt</SelectItem>
              <SelectItem value="nicht_angetroffen">Nicht angetroffen</SelectItem>
              <SelectItem value="abgerechnet">Abgerechnet</SelectItem>
              <SelectItem value="bezahlt">Bezahlt</SelectItem>
            </SelectContent>
          </Select>

          {/* Reset-Button wenn irgendein Filter aktiv */}
          {(filterKundenId || filterKategorie || filterStatus) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={() => { setFilterKundenId(null); setFilterKategorie(null); setFilterStatus(null); }}
            >
              <X className="h-3 w-3" />
              Filter zurücksetzen
            </Button>
          )}
        </div>

        {/* AI Appointment Creator — nur wenn KI-Modus aktiv */}
        {settings.aiModeEnabled && (
          <div className="flex-shrink-0">
            <AIAppointmentCreator onAppointmentCreated={loadData} />
          </div>
        )}

        {/* Konflikte-Popover — erscheint inline vor dem Kalender */}
        {/* Konflikte + Genehmigungen + Actions — eine Zeile */}
        <div className="flex items-center justify-between gap-2 flex-shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <ConflictsNavigationCard
              appointments={displayedAppointments}
              onNavigateToConflict={(appointmentId) => {
                const appointment = appointments.find(a => a.id === appointmentId);
                if (appointment) {
                  const appointmentDate = new Date(appointment.start_at);
                  const appointmentWeekStart = startOfWeek(appointmentDate, { weekStartsOn: 1 });
                  const currentWeekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });

                  if (appointmentWeekStart.getTime() !== currentWeekStart.getTime()) {
                    setCurrentWeek(appointmentDate);
                  }

                  setHighlightedAppointmentId(appointmentId);
                  // Zum Termin scrollen (kein Dialog oeffnen)
                  setTimeout(() => {
                    const el = document.querySelector(`[data-appointment-id="${appointmentId}"]`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }, 100);
                  setTimeout(() => setHighlightedAppointmentId(null), 4000);
                }
              }}
            />
            <AppointmentApprovalBar />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Palmtree className="h-4 w-4 text-emerald-600" />
                  Abwesenheiten
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader className="mb-4">
                  <SheetTitle>Abwesenheiten verwalten</SheetTitle>
                </SheetHeader>
                <AbwesenheitVerwaltung embedded onAbwesenheitCreated={loadData} />
              </SheetContent>
            </Sheet>
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom-Steuerung */}
            <div className="flex items-center gap-1 border rounded-md px-1 bg-card">
              <button
                type="button"
                onClick={() => {
                  const next = Math.max(0.6, parseFloat((calendarScale - 0.1).toFixed(1)));
                  setCalendarScale(next);
                  localStorage.setItem('calendarScale', String(next));
                }}
                className="p-1 hover:bg-muted rounded text-sm font-mono leading-none"
                title="Verkleinern"
              >−</button>
              <span className="text-xs text-muted-foreground w-10 text-center select-none">
                {Math.round(calendarScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = Math.min(1.3, parseFloat((calendarScale + 0.1).toFixed(1)));
                  setCalendarScale(next);
                  localStorage.setItem('calendarScale', String(next));
                }}
                className="p-1 hover:bg-muted rounded text-sm font-mono leading-none"
                title="Vergrößern"
              >+</button>
            </div>
            <Button onClick={() => setShowCreateAppointment(true)} size="sm" className="gap-1 sm:gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Neuer Termin</span>
              <span className="sm:hidden">Neu</span>
            </Button>
          </div>
        </div>

        {/* Main Content: Calendar + Unassigned Panel */}
        <div className="flex-1 flex flex-row min-h-0 gap-2 overflow-hidden">
          {/* Calendar */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            {/* Calendar Grid */}
            <div className="flex-1 overflow-auto">
              <div style={{ zoom: calendarScale }}>
              {viewMode === 'week' && (
                <ProScheduleCalendar
                  employees={filteredEmployees}
                  allEmployees={[...employees.filter(e => e.ist_aktiv)].sort((a, b) => {
                    const ai = employeeOrder.indexOf(a.id);
                    const bi = employeeOrder.indexOf(b.id);
                    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                  })}
                  appointments={displayedAppointments}
                  abwesenheiten={abwesenheiten}
                  weekDates={weekDates}
                  activeAppointmentId={activeId}
                  onEditAppointment={setEditingAppointment}
                  onSlotClick={handleSlotClick}
                  conflictingAppointments={conflictingAppointments}
                  onCut={handleCutAppointment}
                  onCopy={handleCopyAppointment}
                  highlightedAppointmentId={highlightedAppointmentId}
                  hiddenEmployeeIds={hiddenEmployeeIds}
                  onToggleEmployee={(id) => {
                    setHiddenEmployeeIds(prev => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    });
                  }}
                  onReorderEmployees={(orderedIds) => {
                    setEmployeeOrder(orderedIds);
                  }}
                  verfuegbarkeiten={allVerfuegbarkeiten}
                  onAssignAppointment={(appointmentId, employeeId) =>
                    assignAppointment(appointmentId, employeeId)
                  }
                  onEmployeeClick={(id) => navigate(`/dashboard/admin?openMitarbeiter=${id}`)}
                />
              )}
              {viewMode === 'month' && (
                <MonthView
                  employees={filteredEmployees}
                  appointments={displayedAppointments}
                  currentMonth={currentWeek}
                  onEditAppointment={setEditingAppointment}
                  onSlotClick={handleSlotClick}
                />
              )}
              </div>
            </div>

            {/* Legend Footer */}
            <ProCalendarLegend />
          </div>

        </div>

        {/* Cut/Paste Bar */}
        {cutAppointment && (
          <Card className="flex-shrink-0 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-lg">
                    <Scissors className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{copyMode ? 'Kopiert:' : 'Ausgeschnitten:'}</div>
                    <div className="text-sm text-muted-foreground">
                      {cutAppointment.titel} - {cutAppointment.customer?.name}
                      {' '}am {format(new Date(cutAppointment.start_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleCancelCut}>
                  <X className="h-4 w-4 mr-1" />
                  Abbrechen
                </Button>
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-300 mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Klicken Sie auf einen leeren Zeitslot, um den Termin einzufügen
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dialogs */}
        <AppointmentDetailDialog
          isOpen={!!editingAppointment}
          onClose={() => setEditingAppointment(null)}
          appointment={editingAppointment}
          employees={employees}
          customers={customers}
          onDuplicate={async (appt) => { await handleDuplicateAppointment(appt as LocalAppointment); }}
          onUpdate={async (appointment) => {
            try {
              // Bug 11: Wenn Status → unassigned, Mitarbeiter entfernen
              const effectiveMitarbeiterId = appointment.status === 'unassigned'
                ? null
                : appointment.mitarbeiter_id;

              const updateData: any = {
                titel: appointment.titel,
                status: appointment.status,
                mitarbeiter_id: effectiveMitarbeiterId,
                kunden_id: appointment.kunden_id ?? null,
                start_at: appointment.start_at,
                end_at: appointment.end_at,
                notizen: appointment.notizen ?? null,
                iststunden: appointment.iststunden ?? null,
                kategorie: appointment.kategorie ?? null,
                absage_datum: appointment.absage_datum ?? null,
                absage_kanal: appointment.absage_kanal ?? null,
              };

              // Include series exception fields if present
              if (appointment.ist_ausnahme !== undefined) {
                updateData.ist_ausnahme = appointment.ist_ausnahme;
              }
              if (appointment.ausnahme_grund) {
                updateData.ausnahme_grund = appointment.ausnahme_grund;
              }
              
              const { error } = await supabase
                .from('termine')
                .update(updateData)
                .eq('id', appointment.id);

              if (error) throw error;

              // Terminhistorie loggen (fire-and-forget)
              const oldApp = appointments.find(a => a.id === appointment.id);
              if (oldApp) {
                const oldData: Record<string, unknown> = {};
                const newData: Record<string, unknown> = {};
                const STATUS_LABELS: Record<string, string> = {
                  unassigned: 'Offen', scheduled: 'Geplant', in_progress: 'In Bearb.',
                  completed: 'Abgeschlossen', cancelled: 'Abgesagt (kurzfr.)',
                  nicht_angetroffen: 'Nicht angetroffen', abgesagt_rechtzeitig: 'Rechtz. abgesagt',
                  abgerechnet: 'Abgerechnet', bezahlt: 'Bezahlt',
                };
                let operation = 'Aktualisiert';

                if (oldApp.status !== appointment.status) {
                  oldData.status = oldApp.status;
                  newData.status = appointment.status;
                  operation = `Status: ${STATUS_LABELS[oldApp.status ?? ''] ?? oldApp.status} → ${STATUS_LABELS[appointment.status] ?? appointment.status}`;
                } else if (oldApp.mitarbeiter_id !== effectiveMitarbeiterId) {
                  const oldEmp = employees.find(e => e.id === oldApp.mitarbeiter_id)?.name ?? '—';
                  const newEmp = employees.find(e => e.id === effectiveMitarbeiterId)?.name ?? '—';
                  oldData.mitarbeiter_id = oldApp.mitarbeiter_id;
                  newData.mitarbeiter_id = effectiveMitarbeiterId;
                  operation = `Mitarbeiter: ${oldEmp} → ${newEmp}`;
                } else if (oldApp.start_at !== appointment.start_at) {
                  oldData.start_at = oldApp.start_at;
                  oldData.end_at = oldApp.end_at;
                  newData.start_at = appointment.start_at;
                  newData.end_at = appointment.end_at;
                  operation = `Verschoben: ${format(new Date(oldApp.start_at), 'dd.MM. HH:mm', { locale: de })} → ${format(new Date(appointment.start_at), 'dd.MM. HH:mm', { locale: de })}`;
                }
                logTerminChange(appointment.id, operation, oldData, newData);
              }

              // Optimistisch lokalen State updaten
              setAppointments(prev => prev.map(app =>
                app.id === appointment.id
                  ? { ...app, ...updateData, mitarbeiter_id: effectiveMitarbeiterId }
                  : app
              ));

              queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });

              toast({
                title: 'Erfolg',
                description: appointment.ist_ausnahme
                  ? 'Einzeltermin wurde als Ausnahme gespeichert.'
                  : 'Termin wurde aktualisiert.'
              });

              setEditingAppointment(null);
            } catch (error) {
              toast({
                title: 'Fehler',
                description: 'Fehler beim Aktualisieren.',
                variant: 'destructive'
              });
              await loadData(); // Bei Fehler: synchronisieren
            }
          }}
          onDelete={handleDeleteAppointment}
          onDeleteSeries={handleDeleteSeries}
        />

        <ConflictWarningDialog
          isOpen={conflictWarning.show}
          onClose={() => setConflictWarning({
            show: false,
            appointmentId: '',
            employeeId: '',
            conflicts: [],
            pauseViolations: [],
            targetDate: undefined
          })}
          onConfirm={handleConflictConfirm}
          employeeName={employees.find(emp => emp.id === conflictWarning.employeeId)?.name || ''}
          appointmentTitle={
            conflictWarning.appointmentId === '__new__'
              ? (pendingCreateData?.titel as string) || 'Neuer Termin'
              : conflictWarning.appointmentId === '__update__'
                ? pendingUpdateAppointment?.titel || 'Termin bearbeiten'
                : appointments.find(app => app.id === conflictWarning.appointmentId)?.titel || ''
          }
          conflictingAppointments={conflictWarning.conflicts}
          pauseViolations={conflictWarning.pauseViolations}
          newAppointmentTime={
            conflictWarning.appointmentId === '__new__'
              ? { start: (pendingCreateData?.start_at as string) || '', end: (pendingCreateData?.end_at as string) || '' }
              : conflictWarning.appointmentId === '__update__'
                ? { start: pendingUpdateAppointment?.start_at || '', end: pendingUpdateAppointment?.end_at || '' }
                : {
                    start: appointments.find(app => app.id === conflictWarning.appointmentId)?.start_at || new Date().toISOString(),
                    end: appointments.find(app => app.id === conflictWarning.appointmentId)?.end_at || new Date().toISOString()
                  }
          }
        />

        {/* Series Move Dialog */}
        <AlertDialog open={!!seriesMoveDialog} onOpenChange={(open) => !open && setSeriesMoveDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Regeltermin verschieben</AlertDialogTitle>
              <AlertDialogDescription>
                Dieser Termin ist Teil einer wiederkehrenden Serie. Möchten Sie nur diesen einzelnen Termin verschieben oder die gesamte Serie?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (seriesMoveDialog) {
                    // G-14: Check for employee absences on target date before proceeding
                    const singleAbsence = isEmployeeAbsent(seriesMoveDialog.employeeId, seriesMoveDialog.targetDate);
                    if (singleAbsence) {
                      const absentEmp = employees.find(e => e.id === seriesMoveDialog.employeeId);
                      setAbsenceConfirm({
                        show: true,
                        appointmentId: seriesMoveDialog.appointment.id,
                        employeeId: seriesMoveDialog.employeeId,
                        targetDate: seriesMoveDialog.targetDate,
                        employeeName: absentEmp?.name || 'Mitarbeiter',
                      });
                      setSeriesMoveDialog(null);
                      return;
                    }

                    // Move only this appointment as an exception
                    const { overlaps, pauseViolations } = checkForConflicts(
                      seriesMoveDialog.appointment.id,
                      seriesMoveDialog.employeeId,
                      seriesMoveDialog.targetDate
                    );

                    if (overlaps.length > 0 || pauseViolations.length > 0) {
                      setConflictWarning({
                        show: true,
                        appointmentId: seriesMoveDialog.appointment.id,
                        employeeId: seriesMoveDialog.employeeId,
                        conflicts: overlaps,
                        pauseViolations,
                        targetDate: seriesMoveDialog.targetDate
                      });
                      setSeriesMoveDialog(null);
                    } else {
                      await assignAppointment(
                        seriesMoveDialog.appointment.id,
                        seriesMoveDialog.employeeId,
                        seriesMoveDialog.targetDate,
                        true // makeException = true
                      );
                      setSeriesMoveDialog(null);
                    }
                  }
                }}
              >
                Nur diesen Termin
              </AlertDialogAction>
              <AlertDialogAction
                onClick={async () => {
                  if (!seriesMoveDialog) return;
                  const { appointment, employeeId, targetDate } = seriesMoveDialog;
                  const vorlageId = appointment.vorlage_id;
                  if (!vorlageId) return;

                  // G-14: Check for employee absences on the target date
                  const seriesAbsence = isEmployeeAbsent(employeeId, targetDate);
                  if (seriesAbsence) {
                    const absentEmp = employees.find(e => e.id === employeeId);
                    setAbsenceConfirm({
                      show: true,
                      appointmentId: appointment.id,
                      employeeId,
                      targetDate,
                      employeeName: absentEmp?.name || 'Mitarbeiter',
                    });
                    setSeriesMoveDialog(null);
                    return;
                  }

                  try {
                    // 1. Compute new weekday (DB: 0=Mo … 6=So)
                    const jsDay = targetDate.getDay(); // 0=Sun
                    const newWochentag = jsDay === 0 ? 6 : jsDay - 1;

                    // 2. Derive new start time from the drop target date
                    //    The targetDate already encodes the target time slot via the hour
                    const newStartZeit = format(targetDate, 'HH:mm:ss');

                    // 3. Get original template for duration
                    const { data: vorlage, error: vErr } = await supabase
                      .from('termin_vorlagen')
                      .select('dauer_minuten')
                      .eq('id', vorlageId)
                      .single();
                    if (vErr || !vorlage) throw vErr || new Error('Vorlage nicht gefunden');

                    const dauerMinuten = vorlage.dauer_minuten;

                    // 4. Update template
                    const { error: tplErr } = await supabase
                      .from('termin_vorlagen')
                      .update({
                        wochentag: newWochentag,
                        start_zeit: newStartZeit,
                        mitarbeiter_id: employeeId || null,
                      })
                      .eq('id', vorlageId);
                    if (tplErr) throw tplErr;

                    // 5. Fetch all future non-exception appointments of this series
                    //    PLUS den aktuell verschobenen Termin (auch wenn er heute/in der Vergangenheit liegt)
                    const now = new Date().toISOString();
                    const { data: futureTermine, error: ftErr } = await supabase
                      .from('termine')
                      .select('id, start_at, end_at')
                      .eq('vorlage_id', vorlageId)
                      .eq('ist_ausnahme', false)
                      .gte('start_at', now);
                    if (ftErr) throw ftErr;

                    // Den aktuellen Termin hinzufuegen falls er nicht in der Liste ist
                    const allTermine = [...(futureTermine || [])];
                    if (!allTermine.some((t) => t.id === appointment.id)) {
                      allTermine.push({ id: appointment.id, start_at: appointment.start_at, end_at: appointment.end_at });
                    }

                    // 6. Update each appointment with recalculated dates
                    if (allTermine.length > 0) {
                      const updates = allTermine.map((termin) => {
                        const origDate = new Date(termin.start_at);
                        const origJsDay = origDate.getDay();
                        const origMondayIdx = origJsDay === 0 ? 6 : origJsDay - 1;
                        let dayOffset = newWochentag - origMondayIdx;
                        // Keep within same week (adjust ±6 days max)
                        if (dayOffset > 3) dayOffset -= 7;
                        if (dayOffset < -3) dayOffset += 7;

                        const newStart = new Date(origDate);
                        newStart.setDate(newStart.getDate() + dayOffset);
                        // Set new time
                        const [hh, mm] = newStartZeit.split(':').map(Number);
                        newStart.setHours(hh, mm, 0, 0);

                        const newEnd = new Date(newStart.getTime() + dauerMinuten * 60000);

                        return supabase
                          .from('termine')
                          .update({
                            start_at: newStart.toISOString(),
                            end_at: newEnd.toISOString(),
                            mitarbeiter_id: employeeId || null,
                            status: employeeId ? 'scheduled' as const : 'unassigned' as const,
                          })
                          .eq('id', termin.id);
                      });

                      const results = await Promise.all(updates);
                      const failed = results.filter(r => r.error);
                      if (failed.length > 0) {
                        console.error('Einige Termine konnten nicht aktualisiert werden:', failed);
                      }
                    }

                    toast({
                      title: 'Serie verschoben',
                      description: `Vorlage und ${allTermine.length} Termine wurden aktualisiert.`,
                    });

                    queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });
                    await loadData();
                  } catch (err: any) {
                    console.error('Fehler beim Verschieben der Serie:', err);
                    toast({
                      title: 'Fehler',
                      description: err?.message || 'Serie konnte nicht verschoben werden.',
                      variant: 'destructive',
                    });
                  } finally {
                    setSeriesMoveDialog(null);
                  }
                }}
              >
                Alle zukünftigen Termine
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Verfügbarkeits-Warnung: Drag & Drop / Copy-Paste außerhalb des Zeitfensters */}
        <AlertDialog open={!!verfuegbarkeitPending} onOpenChange={(open) => !open && setVerfuegbarkeitPending(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Außerhalb der Verfügbarkeit</AlertDialogTitle>
              <AlertDialogDescription>
                {verfuegbarkeitPending?.hinweis} Trotzdem zuweisen?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={handleVerfuegbarkeitConfirm}>
                Trotzdem zuweisen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Einheitlicher Termin-Dialog: sowohl für "+" Button als auch für Slot-Klick */}
        <CreateAppointmentFromSlotDialog
          open={showCreateAppointment}
          onOpenChange={setShowCreateAppointment}
          customers={customers}
          employees={employees}
          onSubmitSingle={async (data) => {
            await handleCreateAppointment(data);
            setShowCreateAppointment(false);
          }}
          onSubmitRecurring={async (data) => {
            await handleCreateRecurringAppointment(data);
            setShowCreateAppointment(false);
          }}
        />

        <EmployeeManagementDialog
          open={showEmployeeDialog}
          onOpenChange={setShowEmployeeDialog}
          employees={employees}
          hiddenEmployeeIds={hiddenEmployeeIds}
          onToggleEmployee={(id) => {
            setHiddenEmployeeIds(prev => {
              const newSet = new Set(prev);
              if (newSet.has(id)) {
                newSet.delete(id);
              } else {
                newSet.add(id);
              }
              return newSet;
            });
          }}
          onReorderEmployees={handleReorderEmployees}
          searchQuery={searchEmployee}
          onSearchChange={setSearchEmployee}
        />

        {slotDialogData && (
          <CreateAppointmentFromSlotDialog
            open={showSlotDialog}
            onOpenChange={setShowSlotDialog}
            prefilledData={slotDialogData}
            customers={customers}
            employees={employees}
            onSubmitSingle={handleSlotSingleAppointment}
            onSubmitRecurring={handleSlotRecurringAppointment}
          />
        )}

        <DragOverlay>
          {draggedAppointment ? (
            <DraggableAppointment appointment={draggedAppointment} isDragging={true} />
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
};

export default ScheduleBuilderModern;
