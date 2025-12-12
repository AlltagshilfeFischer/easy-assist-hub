import { useState, useMemo, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
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
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useSidebar } from '@/components/ui/sidebar';
import { ModernWeekCalendar } from '@/components/schedule/ModernWeekCalendar';
import { WeekNavigationBar } from '@/components/schedule/WeekNavigationBar';
import { CalendarLegend } from '@/components/schedule/CalendarLegend';
import { EmployeeManagementDialog } from '@/components/schedule/EmployeeManagementDialog';
import { CalendarStats } from '@/components/schedule/CalendarStats';
import { UnassignedAppointmentsBar } from '@/components/schedule/UnassignedAppointmentsBar';
import { AppointmentApprovalBar } from '@/components/schedule/AppointmentApprovalBar';
import { AppointmentDetailDialog } from '@/components/schedule/AppointmentDetailDialog';
import { CreateAppointmentDialog } from '@/components/schedule/CreateAppointmentDialog';
import { CreateRecurringAppointmentDialog } from '@/components/schedule/CreateRecurringAppointmentDialog';
import { CreateAppointmentFromSlotDialog } from '@/components/schedule/CreateAppointmentFromSlotDialog';
import { ConflictWarningDialog } from '@/components/schedule/ConflictWarningDialog';
import { DraggableAppointment } from '@/components/schedule/DraggableAppointment';
import { AIAppointmentCreator } from '@/components/schedule/AIAppointmentCreator';
import { DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent } from '@dnd-kit/core';

interface Employee {
  id: string;
  vorname?: string;
  nachname?: string;
  name: string;
  telefon: string;
  ist_aktiv: boolean;
  max_termine_pro_tag: number;
  farbe_kalender: string;
  workload: number;
  benutzer?: {
    email: string;
    vorname: string;
    nachname: string;
  };
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  telefonnr: string | null;
  geburtsdatum: string | null;
  pflegegrad: number | null;
  adresse: string | null;
  stadtteil: string | null;
  aktiv: boolean;
  status: string | null;
  pflegekasse: string | null;
  versichertennummer: string | null;
  stunden_kontingent_monat: number | null;
  tage: string | null;
  mitarbeiter: string | null;
  angehoerige_ansprechpartner: string | null;
  farbe_kalender?: string;
}

interface Appointment {
  id: string;
  titel: string;
  kunden_id: string;
  mitarbeiter_id: string | null;
  start_at: string;
  end_at: string;
  customer?: Customer;
  employee?: Employee;
  vorlage_id?: string | null;
  ist_ausnahme?: boolean | null;
  ausnahme_grund?: string | null;
}

const ScheduleBuilderModern = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeOrder, setEmployeeOrder] = useState<string[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
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
  const [cutAppointment, setCutAppointment] = useState<Appointment | null>(null);
  const [seriesMoveDialog, setSeriesMoveDialog] = useState<{
    appointment: Appointment;
    employeeId: string;
    targetDate: Date;
  } | null>(null);
  
  const { toast } = useToast();
  const { setOpen } = useSidebar();

  useEffect(() => {
    const KEY = 'autoCollapsed:schedule-builder';
    if (!sessionStorage.getItem(KEY)) {
      sessionStorage.setItem(KEY, '1');
      setTimeout(() => setOpen(false), 0);
    }
    return () => {
      sessionStorage.removeItem(KEY);
    };
  }, []); // intentionally run once per mount

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: employeesData, error: employeesError } = await supabase
        .from('mitarbeiter')
        .select('*, benutzer!inner(*)')
        .order('created_at', { ascending: true });
      
      if (employeesError) throw employeesError;

      const { data: customersData, error: customersError } = await supabase
        .from('kunden')
        .select('*')
        .eq('aktiv', true)
        .order('name');
      
      if (customersError) throw customersError;

      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('termine')
        .select(`
          *,
          customer:kunden(*),
          employee:mitarbeiter(*)
        `)
        .order('start_at');
      
      if (appointmentsError) throw appointmentsError;

      const transformedEmployees = employeesData?.map(emp => {
        const benutzer = (emp as any).benutzer;
        const fullName = benutzer?.vorname && benutzer?.nachname 
          ? `${benutzer.vorname} ${benutzer.nachname}` 
          : `Mitarbeiter ${emp.id.slice(0, 8)}`;
        return {
          ...emp,
          name: fullName,
          workload: Math.floor(Math.random() * 40) + 60
        };
      }) || [];

      const transformedAppointments = appointmentsData?.map(app => {
        const empData = app.employee as any;
        return {
          id: app.id,
          titel: app.titel,
          kunden_id: app.kunden_id,
          mitarbeiter_id: app.mitarbeiter_id,
          start_at: app.start_at,
          end_at: app.end_at,
          customer: app.customer ? {
            id: app.customer.id,
            name: (app.customer as any).name || '',
            email: app.customer.email || null,
            telefonnr: (app.customer as any).telefonnr || null,
            geburtsdatum: (app.customer as any).geburtsdatum || null,
            pflegegrad: (app.customer as any).pflegegrad || null,
            adresse: (app.customer as any).adresse || null,
            stadtteil: (app.customer as any).stadtteil || null,
            aktiv: (app.customer as any).aktiv || false,
            pflegekasse: (app.customer as any).pflegekasse || null,
            versichertennummer: (app.customer as any).versichertennummer || null,
            stunden_kontingent_monat: (app.customer as any).stunden_kontingent_monat || null,
            mitarbeiter: (app.customer as any).mitarbeiter || null,
            angehoerige_ansprechpartner: (app.customer as any).angehoerige_ansprechpartner || null,
            farbe_kalender: (app.customer as any).farbe_kalender || '#10B981'
          } as Customer : undefined,
          employee: empData ? {
            id: empData.id,
            name: empData.vorname && empData.nachname ? `${empData.vorname} ${empData.nachname}` : `Mitarbeiter ${empData.id.slice(0, 8)}`,
            telefon: empData.telefon || '',
            ist_aktiv: empData.ist_aktiv || false,
            max_termine_pro_tag: empData.max_termine_pro_tag || 8,
            farbe_kalender: empData.farbe_kalender || '#10B981',
            workload: Math.floor(Math.random() * 40) + 60
          } as Employee : undefined
        } as Appointment;
      }) || [];

      const transformedCustomers = customersData?.map(cust => ({
        id: cust.id,
        name: (cust as any).name || '',
        email: cust.email || null,
        telefonnr: (cust as any).telefonnr || null,
        geburtsdatum: (cust as any).geburtsdatum || null,
        pflegegrad: (cust as any).pflegegrad || null,
        adresse: (cust as any).adresse || null,
        stadtteil: (cust as any).stadtteil || null,
        aktiv: (cust as any).aktiv || false,
        status: (cust as any).status || null,
        pflegekasse: (cust as any).pflegekasse || null,
        versichertennummer: (cust as any).versichertennummer || null,
        stunden_kontingent_monat: (cust as any).stunden_kontingent_monat || null,
        mitarbeiter: (cust as any).mitarbeiter || null,
        angehoerige_ansprechpartner: (cust as any).angehoerige_ansprechpartner || null
      }) as Customer) || [];

      setEmployees(transformedEmployees);
      
      // Initialize employee order if not set
      if (employeeOrder.length === 0) {
        setEmployeeOrder(transformedEmployees.map(emp => emp.id));
      }
      
      setCustomers(transformedCustomers);
      setAppointments(transformedAppointments);
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

  const getWeekDates = () => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
    const dates = [];
    let current = weekStart;

    while (current <= weekEnd) {
      dates.push(new Date(current));
      current = addDays(current, 1);
    }
    return dates;
  };

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
    return appointments.filter(app => !app.mitarbeiter_id);
  }, [appointments]);

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
    const unassigned = total - assigned;
    const conflicts = conflictingAppointments.size;
    const activeEmployees = employees.filter(e => e.ist_aktiv).length;
    const totalEmployees = employees.length;
    const avgWorkload = employees.length > 0 
      ? Math.round(employees.reduce((sum, e) => sum + (e.workload || 0), 0) / employees.length)
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
  }, [appointments, employees, conflictingAppointments]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const checkForConflicts = (appointmentId: string, employeeId: string) => {
    const appointment = appointments.find(app => app.id === appointmentId);
    if (!appointment) return [];

    const appointmentStart = new Date(appointment.start_at);
    const appointmentEnd = new Date(appointment.end_at);

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
        const originalEnd = new Date(appointment.end_at);
        
        // Create new dates with target date but original times
        const newStart = new Date(targetDate);
        newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds(), originalStart.getMilliseconds());
        
        const newEnd = new Date(targetDate);
        newEnd.setHours(originalEnd.getHours(), originalEnd.getMinutes(), originalEnd.getSeconds(), originalEnd.getMilliseconds());
        
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

      toast({
        title: 'Erfolg',
        description: `${appointment?.customer?.name} → ${employee?.name}${targetDate ? ` am ${format(targetDate, 'dd.MM.yyyy')}` : ''}`
      });

      await loadData();
    } catch (error) {
      console.error('Error assigning appointment:', error);
      toast({
        title: 'Fehler',
        description: 'Fehler beim Zuweisen des Termins.',
        variant: 'destructive'
      });
      await loadData();
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

    // Handle drop into "Unassigned" bar (ids like "unassigned-YYYY-MM-DD")
    if (overId.startsWith('unassigned-')) {
      try {
        const dateStr = overId.replace('unassigned-', '');
        const targetDate = new Date(dateStr);
        
        const originalStart = new Date(appointment.start_at);
        const originalEnd = new Date(appointment.end_at);
        
        // Create new dates with target date but original times
        const newStart = new Date(targetDate);
        newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
        
        const newEnd = new Date(targetDate);
        newEnd.setHours(originalEnd.getHours(), originalEnd.getMinutes(), 0, 0);

        const updateData: any = {
          mitarbeiter_id: null,
          status: 'unassigned',
          start_at: newStart.toISOString(),
          end_at: newEnd.toISOString()
        };

        // Mark as exception if it's a recurring appointment
        if (appointment.vorlage_id && !appointment.ist_ausnahme) {
          updateData.ist_ausnahme = true;
          updateData.ausnahme_grund = 'Verschoben per Drag & Drop';
        }

        const { error } = await supabase
          .from('termine')
          .update(updateData)
          .eq('id', appointmentId);

        if (error) throw error;

        toast({
          title: 'Erfolg',
          description: `Termin nicht zugewiesen am ${format(targetDate, 'dd.MM.yyyy')}`
        });

        await loadData();
      } catch (error) {
        toast({
          title: 'Fehler',
          description: 'Fehler beim Verschieben des Termins.',
          variant: 'destructive'
        });
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
      const weekDates = getWeekDates();
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

    const conflicts = checkForConflicts(appointmentId, employeeId);

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
    await assignAppointment(
      conflictWarning.appointmentId, 
      conflictWarning.employeeId, 
      conflictWarning.targetDate,
      false // Not making an exception here, as it's already determined
    );
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
        kunden_id: z.string().uuid('Ungültige Kunden-ID'),
        mitarbeiter_id: z.string().uuid().nullable().optional(),
        start_at: z
          .string()
          .min(1, 'Startzeit fehlt')
          .refine((v) => !isNaN(Date.parse(v)), { message: 'Ungültige Startzeit' }),
        end_at: z
          .string()
          .min(1, 'Endzeit fehlt')
          .refine((v) => !isNaN(Date.parse(v)), { message: 'Ungültige Endzeit' }),
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

      const { error } = await supabase
        .from('termine')
        .insert([{ 
          titel: payload.titel,
          kunden_id: payload.kunden_id,
          mitarbeiter_id: payload.mitarbeiter_id ?? null,
          start_at: payload.start_at,
          end_at: payload.end_at,
          status: payload.mitarbeiter_id ? 'scheduled' : 'unassigned'
        }]);

      if (error) throw error;

      toast({
        title: 'Erfolg',
        description: 'Termin wurde erstellt.'
      });

      await loadData();
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

      toast({
        title: 'Erfolg',
        description: 'Termin wurde gelöscht.'
      });

      await loadData();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      toast({
        title: 'Fehler',
        description: 'Fehler beim Löschen des Termins.',
        variant: 'destructive'
      });
      throw error; // Re-throw to let dialog know deletion failed
    }
  };

  const draggedAppointment = appointments.find(app => app.id === activeId);

  // Cut/Paste handlers
  const handleCutAppointment = (appointment: Appointment) => {
    setCutAppointment(appointment);
    toast({
      title: 'Ausgeschnitten',
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

      const employee = employeeId ? employees.find(emp => emp.id === employeeId) : null;
      toast({
        title: 'Eingefügt',
        description: employee 
          ? `${cutAppointment.customer?.name} → ${employee.name} am ${format(targetDate, 'dd.MM.yyyy')}`
          : `${cutAppointment.customer?.name} → Unzugeordnet am ${format(targetDate, 'dd.MM.yyyy')}`
      });

      setCutAppointment(null);
      await loadData();
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Fehler beim Einfügen des Termins.',
        variant: 'destructive'
      });
    }
  };

  const handleCancelCut = () => {
    setCutAppointment(null);
    toast({
      title: 'Abgebrochen',
      description: 'Ausschneiden wurde abgebrochen.'
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
      <div className="h-[calc(100vh-4rem)] flex flex-col gap-2 sm:gap-3 p-3 sm:p-4 bg-gradient-to-br from-background to-muted/20 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 flex-shrink-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Dienstplan & Terminverwaltung</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Professionelle Wochenansicht mit Drag & Drop
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <AppointmentApprovalBar />
            <Button variant="outline" onClick={() => setShowEmployeeDialog(true)} size="sm">
              <Users className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Mitarbeiter</span>
            </Button>
            <Button onClick={() => setShowCreateAppointment(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Neuer Termin</span>
              <span className="sm:hidden">Neu</span>
            </Button>
            <Button variant="outline" onClick={() => setShowCreateRecurring(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Serientermin</span>
              <span className="sm:hidden">Serie</span>
            </Button>
          </div>
        </div>

        {/* AI Appointment Creator */}
        <AIAppointmentCreator onAppointmentCreated={loadData} />

        {/* Stats */}
        <CalendarStats {...stats} />

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 flex-shrink-0">
          <WeekNavigationBar
            currentWeek={currentWeek}
            onPreviousWeek={() => setCurrentWeek(prev => subWeeks(prev, 1))}
            onNextWeek={() => setCurrentWeek(prev => addWeeks(prev, 1))}
            onToday={() => setCurrentWeek(new Date())}
          />
          <CalendarLegend />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Calendar */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Calendar Grid - Fixed Height */}
            <Card className="flex-1 shadow-lg overflow-hidden flex flex-col">
              <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                {/* Unassigned Bar - Above Calendar */}
                <UnassignedAppointmentsBar
                  appointments={appointments}
                  weekDates={getWeekDates()}
                  activeId={activeId}
                  onEditAppointment={setEditingAppointment}
                  onCut={handleCutAppointment}
                  onSlotClick={(date) => {
                    if (cutAppointment) {
                      handlePasteAppointment(null, date);
                    }
                  }}
                />
                
                {/* Calendar with scroll */}
                <div className="flex-1 overflow-auto">
                  <ModernWeekCalendar
                    employees={filteredEmployees}
                    appointments={appointments}
                    weekDates={getWeekDates()}
                    activeAppointmentId={activeId}
                    onEditAppointment={setEditingAppointment}
                    onSlotClick={handleSlotClick}
                    conflictingAppointments={conflictingAppointments}
                    onCut={handleCutAppointment}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Cut/Paste Bar */}
        {cutAppointment && (
          <Card className="flex-shrink-0 bg-amber-50 border-amber-200">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 p-2 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M scissors" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-sm">Ausgeschnitten:</div>
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
              <div className="text-xs text-amber-700 mt-2 flex items-center gap-1">
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
              const updateData: any = {
                titel: appointment.titel,
                status: appointment.status,
                mitarbeiter_id: appointment.mitarbeiter_id,
                kunden_id: appointment.kunden_id,
                start_at: appointment.start_at,
                end_at: appointment.end_at
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

              toast({
                title: 'Erfolg',
                description: appointment.ist_ausnahme 
                  ? 'Einzeltermin wurde als Ausnahme gespeichert.' 
                  : 'Termin wurde aktualisiert.'
              });

              await loadData();
              setEditingAppointment(null);
            } catch (error) {
              toast({
                title: 'Fehler',
                description: 'Fehler beim Aktualisieren.',
                variant: 'destructive'
              });
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
          appointmentTitle={appointments.find(app => app.id === conflictWarning.appointmentId)?.titel || ''}
          conflictingAppointments={conflictWarning.conflicts}
          newAppointmentTime={{
            start: appointments.find(app => app.id === conflictWarning.appointmentId)?.start_at || new Date().toISOString(),
            end: appointments.find(app => app.id === conflictWarning.appointmentId)?.end_at || new Date().toISOString()
          }}
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
                      seriesMoveDialog.employeeId
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
                onClick={() => {
                  if (seriesMoveDialog) {
                    toast({
                      title: 'Hinweis',
                      description: 'Das Verschieben ganzer Serien wird in einer zukünftigen Version implementiert.'
                    });
                    setSeriesMoveDialog(null);
                  }
                }}
              >
                Alle zukünftigen Termine
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <CreateAppointmentDialog
          open={showCreateAppointment}
          onOpenChange={setShowCreateAppointment}
          customers={customers}
          employees={employees}
          onSubmit={handleCreateAppointment}
        />

        <CreateRecurringAppointmentDialog
          open={showCreateRecurring}
          onOpenChange={setShowCreateRecurring}
          customers={customers}
          employees={employees}
          onSubmit={handleCreateRecurringAppointment}
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
