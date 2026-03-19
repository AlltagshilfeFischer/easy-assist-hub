import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, subDays, addMonths, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, X, AlertCircle, Users } from 'lucide-react';
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
import { ProScheduleCalendar } from '@/components/schedule/calendar/ProScheduleCalendar';
// DayView entfernt — nur Wochen- und Monatsansicht
import { MonthView } from '@/components/schedule/calendar/MonthView';
import { ProScheduleHeader } from '@/components/schedule/ProScheduleHeader';
import { ProCalendarLegend } from '@/components/schedule/calendar/ProCalendarLegend';
import { EmployeeManagementDialog } from '@/components/schedule/dialogs/EmployeeManagementDialog';

import { AppointmentApprovalBar } from '@/components/schedule/AppointmentApprovalBar';
import { AppointmentDetailDialog } from '@/components/schedule/dialogs/AppointmentDetailDialog';
// CreateAppointmentDialog entfernt — CreateAppointmentFromSlotDialog wird für beides genutzt
import { CreateRecurringAppointmentDialog } from '@/components/schedule/dialogs/CreateRecurringAppointmentDialog';
import { CreateAppointmentFromSlotDialog } from '@/components/schedule/dialogs/CreateAppointmentFromSlotDialog';
import { ConflictWarningDialog } from '@/components/schedule/dialogs/ConflictWarningDialog';
import { DraggableAppointment } from '@/components/schedule/DraggableAppointment';
import { AIAppointmentCreator } from '@/components/schedule/ai/AIAppointmentCreator';
import { ConflictsNavigationCard } from '@/components/schedule/panels/ConflictsNavigationCard';
import { DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent } from '@dnd-kit/core';

import type { Employee, Customer, CalendarAppointment } from '@/types/domain';

type LocalAppointment = CalendarAppointment & {
  customer?: Customer;
  employee?: Employee;
};

const ScheduleBuilderModern = () => {
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
  const [customerTimeWindows, setCustomerTimeWindows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiddenEmployeeIds, setHiddenEmployeeIds] = useState<Set<string>>(new Set());
  const [searchEmployee, setSearchEmployee] = useState('');
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
    targetDate?: Date;
  }>({
    show: false,
    appointmentId: '',
    employeeId: '',
    conflicts: [],
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

  const { toast } = useToast();

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

  const loadData = async () => {
    setLoading(true);
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
          customer:kunden(*),
          employee:mitarbeiter(*)
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
      
      // Initialize employee order if not set
      if (employeeOrder.length === 0) {
        setEmployeeOrder(transformedEmployees.map(emp => emp.id));
      }
      
      setCustomers(transformedCustomers);

      // Auto-complete: Vergangene scheduled-Termine sofort als completed behandeln
      const now = new Date();
      const autoCompletedIds: string[] = [];
      const finalAppointments = transformedAppointments.map(app => {
        if (app.status === 'scheduled' && new Date(app.end_at) < now) {
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
          .eq('status', 'scheduled')
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
      setLoading(false);
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

  const checkForConflicts = (appointmentId: string, employeeId: string, targetDate?: Date) => {
    const appointment = appointments.find(app => app.id === appointmentId);
    if (!appointment) return [];

    let appointmentStart = new Date(appointment.start_at);
    let appointmentEnd = new Date(appointment.end_at);

    // Wenn ein Ziel-Datum angegeben ist, berechne die neuen Zeiten
    if (targetDate) {
      const originalStart = new Date(appointment.start_at);
      const durationMs = new Date(appointment.end_at).getTime() - originalStart.getTime();
      appointmentStart = new Date(targetDate);
      appointmentStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
      appointmentEnd = new Date(appointmentStart.getTime() + durationMs);
    }

    return appointments.filter(existingApp =>
      existingApp.mitarbeiter_id === employeeId &&
      existingApp.id !== appointmentId &&
      new Date(existingApp.start_at) < appointmentEnd &&
      new Date(existingApp.end_at) > appointmentStart
    );
  };

  const assignAppointment = async (appointmentId: string, employeeId: string, targetDate?: Date, makeException: boolean = false) => {
    try {
      const appointment = appointments.find(app => app.id === appointmentId);
      if (!appointment) return;

      let updateData: any = { 
        mitarbeiter_id: employeeId, 
        status: 'scheduled' 
      };

      // Mark as exception if requested (for recurring appointments)
      if (makeException) {
        updateData.ist_ausnahme = true;
        updateData.ausnahme_grund = 'Verschoben per Drag & Drop';
      }

      // If target date is provided, adjust start_at and end_at to the new date while keeping the time
      if (targetDate) {
        const originalStart = new Date(appointment.start_at);
        const durationMs = new Date(appointment.end_at).getTime() - originalStart.getTime();
        
        // Create new dates with target date but original times
        const newStart = new Date(targetDate);
        newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds(), originalStart.getMilliseconds());
        
        const newEnd = new Date(newStart.getTime() + durationMs);
        
        updateData.start_at = newStart.toISOString();
        updateData.end_at = newEnd.toISOString();
        
        // Update local state immediately
        setAppointments(prev => prev.map(app =>
          app.id === appointmentId 
            ? { ...app, mitarbeiter_id: employeeId, start_at: newStart.toISOString(), end_at: newEnd.toISOString() } 
            : app
        ));
      } else {
        setAppointments(prev => prev.map(app =>
          app.id === appointmentId ? { ...app, mitarbeiter_id: employeeId } : app
        ));
      }

      const { error } = await supabase
        .from('termine')
        .update(updateData)
        .eq('id', appointmentId);

      if (error) throw error;

      const employee = employees.find(emp => emp.id === employeeId);
      const appointmentLabel = appointment?.customer?.name || appointment?.titel || 'Termin';

      toast({
        title: 'Erfolg',
        description: `${appointmentLabel} → ${employee?.name}${targetDate ? ` am ${format(targetDate, 'dd.MM.yyyy')}` : ''}`
      });
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

    // Handle drop into "Unassigned" zone — nur mitarbeiter_id entfernen, Datum behalten
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

        const { error } = await supabase
          .from('termine')
          .update(updateData)
          .eq('id', appointmentId);

        if (error) throw error;

        // Optimistisch lokalen State updaten
        setAppointments(prev => prev.map(app =>
          app.id === appointmentId
            ? { ...app, mitarbeiter_id: null, status: 'unassigned' as const }
            : app
        ));

        const appointmentLabel = appointment.customer?.name || appointment.titel || 'Termin';
        toast({
          title: 'Zuordnung entfernt',
          description: `${appointmentLabel} ist jetzt unzugeordnet`
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

    // Check for employee absences on target date
    const effectiveDate = targetDate || new Date(appointment.start_at);
    const hasAbsence = abwesenheiten.some(a => {
      if (a.mitarbeiter_id !== employeeId) return false;
      // zeitraum is a PostgreSQL TSTZRANGE stored as string "[start, end)"
      const match = a.zeitraum?.match(/[\[(](.+?),(.+?)[\])]/);
      if (!match) return false;
      const rangeStart = new Date(match[1].trim());
      const rangeEnd = new Date(match[2].trim());
      return effectiveDate >= rangeStart && effectiveDate < rangeEnd;
    });

    if (hasAbsence) {
      const absentEmployee = employees.find(e => e.id === employeeId);
      toast({
        title: 'Warnung: Mitarbeiter abwesend',
        description: `${absentEmployee?.name || 'Mitarbeiter'} ist an diesem Tag als abwesend eingetragen.`,
        variant: 'destructive'
      });
      // Warning only — don't block the assignment (per spec: "warnen, aber nicht blockieren")
    }

    const conflicts = checkForConflicts(appointmentId, employeeId, targetDate);

    if (conflicts.length > 0) {
      setConflictWarning({
        show: true,
        appointmentId,
        employeeId,
        conflicts,
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
      console.log('CreateAppointment payload received:', data);

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

      // Konflikt-Prüfung VOR dem Erstellen (nur wenn MA zugewiesen)
      if (payload.mitarbeiter_id && !data._skipConflictCheck) {
        const newStart = new Date(payload.start_at);
        const newEnd = new Date(payload.end_at);
        const conflicts = appointments.filter(existing =>
          existing.mitarbeiter_id === payload.mitarbeiter_id &&
          new Date(existing.start_at) < newEnd &&
          new Date(existing.end_at) > newStart
        );

        if (conflicts.length > 0) {
          // Daten zwischenspeichern, ConflictWarning zeigen
          setPendingCreateData(data);
          setConflictWarning({
            show: true,
            appointmentId: '__new__',
            employeeId: payload.mitarbeiter_id,
            conflicts,
            targetDate: newStart,
          });
          return;
        }
      }

      const { data: inserted, error } = await supabase
        .from('termine')
        .insert([{
          titel: payload.titel,
          kunden_id: payload.kunden_id ?? null,
          mitarbeiter_id: payload.mitarbeiter_id ?? null,
          start_at: payload.start_at,
          end_at: payload.end_at,
          status: payload.mitarbeiter_id ? 'scheduled' : 'unassigned',
          notizen: payload.notizen ?? null,
          kategorie: payload.kategorie ?? null,
        }])
        .select(`*, customer:kunden(*), employee:mitarbeiter(*)`)
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
          kategorie: inserted.kategorie,
          customer: inserted.customer ? { ...(inserted.customer as any), farbe_kalender: (inserted.customer as any).farbe_kalender || '#10B981' } : undefined,
          employee: empData ? {
            id: empData.id,
            name: empData.vorname && empData.nachname ? `${empData.vorname} ${empData.nachname}` : `Mitarbeiter ${empData.id.slice(0, 8)}`,
            farbe_kalender: empData.farbe_kalender || '#10B981',
          } as Employee : undefined,
        };
        setAppointments(prev => [...prev, newApp]);
      }

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
          ist_aktiv: true
        }])
        .select('id')
        .single();

      if (error) throw error;

      // 2) Try server-side generation first
      const fromDate = data.gueltig_von as string; // 'yyyy-MM-dd'
      const toDate = (data.gueltig_bis as string) || (() => {
        const d = new Date(fromDate);
        d.setDate(d.getDate() + 60); // generate ~2 months ahead if no end provided
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      })();

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

        const stepDays = data.intervall === 'biweekly' ? 14 : data.intervall === 'monthly' ? 28 : 7;
        const [hh, mm] = String(data.start_zeit || '09:00').split(':').map((n: string) => parseInt(n, 10));
        const duration = Number(data.dauer_minuten || 60);

        const rows: any[] = [];
        for (let d = new Date(first); d <= end; d.setDate(d.getDate() + stepDays)) {
          const startAt = new Date(d);
          startAt.setHours(hh, mm, 0, 0);
          const endAt = new Date(startAt.getTime() + duration * 60_000);

          rows.push({
            titel: data.titel,
            kunden_id: data.kunden_id,
            mitarbeiter_id: data.mitarbeiter_id ?? null,
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            status: data.mitarbeiter_id ? 'scheduled' : 'unassigned',
            vorlage_id: template?.id ?? null,
            notizen: data.notizen ?? null,
          });
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
      const { error } = await supabase
        .from('termine')
        .delete()
        .eq('id', appointmentId);

      if (error) throw error;

      // Optimistisch aus lokalem State entfernen
      setAppointments(prev => prev.filter(app => app.id !== appointmentId));

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

  const handlePasteAppointment = async (employeeId: string | null, targetDate: Date) => {
    if (!cutAppointment) return;

    try {
      const originalStart = new Date(cutAppointment.start_at);
      const originalEnd = new Date(cutAppointment.end_at);

      // Create new dates with target date but original times
      const newStart = new Date(targetDate);
      newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);

      const newEnd = new Date(targetDate);
      newEnd.setHours(originalEnd.getHours(), originalEnd.getMinutes(), 0, 0);

      const employee = employeeId ? employees.find(emp => emp.id === employeeId) : null;

      if (copyMode) {
        // COPY: Insert new appointment (Einzeltermin, no vorlage_id)
        const { data: newAppointment, error } = await supabase
          .from('termine')
          .insert({
            titel: cutAppointment.titel,
            kunden_id: cutAppointment.kunden_id,
            mitarbeiter_id: employeeId,
            start_at: newStart.toISOString(),
            end_at: newEnd.toISOString(),
            status: employeeId ? 'scheduled' : 'unassigned',
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
          const mapped: LocalAppointment = {
            ...newAppointment,
            customer: newAppointment.kunden ? { id: newAppointment.kunden.id, name: newAppointment.kunden.name, farbe_kalender: newAppointment.kunden.farbe_kalender } : undefined,
            employee: newAppointment.mitarbeiter ? { id: newAppointment.mitarbeiter.id, name: `${newAppointment.mitarbeiter.vorname || ''} ${newAppointment.mitarbeiter.nachname || ''}`.trim(), farbe_kalender: newAppointment.mitarbeiter.farbe_kalender || '#3B82F6' } : undefined,
          } as LocalAppointment;
          setAppointments(prev => [...prev, mapped]);
        }
        // Keep clipboard for multiple pastes in copy mode
      } else {
        // CUT: Move existing appointment
        const { error } = await supabase
          .from('termine')
          .update({
            mitarbeiter_id: employeeId,
            start_at: newStart.toISOString(),
            end_at: newEnd.toISOString(),
            status: employeeId ? 'scheduled' : 'unassigned'
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
            ? { ...app, mitarbeiter_id: employeeId, start_at: newStart.toISOString(), end_at: newEnd.toISOString(), status: employeeId ? 'scheduled' as const : 'unassigned' as const }
            : app
        ));
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
      <div className="h-[calc(100vh-4rem)] flex flex-col gap-3 p-4 bg-background overflow-hidden">
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

        {/* AI Appointment Creator — volle Breite */}
        <div className="flex-shrink-0">
          <AIAppointmentCreator onAppointmentCreated={loadData} />
        </div>

        {/* Konflikte-Popover — erscheint inline vor dem Kalender */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <ConflictsNavigationCard
            appointments={appointments}
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
                setEditingAppointment(appointment);
                setTimeout(() => setHighlightedAppointmentId(null), 3000);
              }
            }}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2 flex-shrink-0">
          <AppointmentApprovalBar />
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
            <Button onClick={() => setShowCreateAppointment(true)} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Neuer Termin
            </Button>
            <Button variant="outline" onClick={() => setShowCreateRecurring(true)} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Serientermin
            </Button>
          </div>
        </div>

        {/* Main Calendar Content */}
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
                appointments={appointments}
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
              />
            )}
            {viewMode === 'month' && (
              <MonthView
                employees={filteredEmployees}
                appointments={appointments}
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

        {/* Cut/Paste Bar */}
        {cutAppointment && (
          <Card className="flex-shrink-0 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M scissors" />
                    </svg>
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
          customerTimeWindows={editingAppointment ? customerTimeWindows.filter(tw => tw.kunden_id === editingAppointment.kunden_id) : []}
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

              // Optimistisch lokalen State updaten
              setAppointments(prev => prev.map(app =>
                app.id === appointment.id
                  ? { ...app, ...updateData, mitarbeiter_id: effectiveMitarbeiterId }
                  : app
              ));

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
        />

        <ConflictWarningDialog
          isOpen={conflictWarning.show}
          onClose={() => setConflictWarning({
            show: false,
            appointmentId: '',
            employeeId: '',
            conflicts: [],
            targetDate: undefined
          })}
          onConfirm={handleConflictConfirm}
          employeeName={employees.find(emp => emp.id === conflictWarning.employeeId)?.name || ''}
          appointmentTitle={
            conflictWarning.appointmentId === '__new__'
              ? (pendingCreateData?.titel as string) || 'Neuer Termin'
              : appointments.find(app => app.id === conflictWarning.appointmentId)?.titel || ''
          }
          conflictingAppointments={conflictWarning.conflicts}
          newAppointmentTime={
            conflictWarning.appointmentId === '__new__'
              ? { start: (pendingCreateData?.start_at as string) || '', end: (pendingCreateData?.end_at as string) || '' }
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
                    // Move only this appointment as an exception
                    const conflicts = checkForConflicts(
                      seriesMoveDialog.appointment.id,
                      seriesMoveDialog.employeeId,
                      seriesMoveDialog.targetDate
                    );
                    
                    if (conflicts.length > 0) {
                      setConflictWarning({
                        show: true,
                        appointmentId: seriesMoveDialog.appointment.id,
                        employeeId: seriesMoveDialog.employeeId,
                        conflicts,
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
                    const now = new Date().toISOString();
                    const { data: futureTermine, error: ftErr } = await supabase
                      .from('termine')
                      .select('id, start_at, end_at')
                      .eq('vorlage_id', vorlageId)
                      .eq('ist_ausnahme', false)
                      .gte('start_at', now);
                    if (ftErr) throw ftErr;

                    // 6. Update each future appointment with recalculated dates
                    if (futureTermine && futureTermine.length > 0) {
                      const updates = futureTermine.map((termin) => {
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
                      description: `Vorlage und ${futureTermine?.length || 0} zukünftige Termine wurden aktualisiert.`,
                    });

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
