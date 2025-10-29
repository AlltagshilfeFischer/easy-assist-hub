import { useState, useMemo, useEffect, useRef } from 'react';
import { format, startOfWeek, endOfWeek, addDays, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, addWeeks, subWeeks } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarDays, ChevronLeft, ChevronRight, User, Clock, AlertTriangle, Users, Calendar, TrendingUp, Filter, Search, Eye, Bell, GripVertical, MapPin, Phone, Settings2, Sparkles, ChevronDown, Plus, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { AppointmentApprovalDialog } from '@/components/schedule/AppointmentApprovalDialog';
import { ConflictWarningDialog } from '@/components/schedule/ConflictWarningDialog';
import { AppointmentDetailDialog } from '@/components/schedule/AppointmentDetailDialog';
import { DraggableAppointment } from '@/components/schedule/DraggableAppointment';
import { UnassignedAppointmentsBar } from '@/components/schedule/UnassignedAppointmentsBar';
import { CreateAppointmentDialog } from '@/components/schedule/CreateAppointmentDialog';
import { CreateRecurringAppointmentDialog } from '@/components/schedule/CreateRecurringAppointmentDialog';
import { CreateAppointmentFromSlotDialog } from '@/components/schedule/CreateAppointmentFromSlotDialog';
import { ModernWeekCalendar } from '@/components/schedule/ModernWeekCalendar';
import { WeekNavigationBar } from '@/components/schedule/WeekNavigationBar';
import { CalendarLegend } from '@/components/schedule/CalendarLegend';
import { EmployeeFilterSidebar } from '@/components/schedule/EmployeeFilterSidebar';
import { CalendarStats } from '@/components/schedule/CalendarStats';
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
  notfall_name: string | null;
  notfall_telefon: string | null;
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
}
const ScheduleBuilder = () => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [searchEmployee, setSearchEmployee] = useState('');
  const [searchAppointment, setSearchAppointment] = useState('');
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [hiddenEmployeeIds, setHiddenEmployeeIds] = useState<Set<string>>(new Set());
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSectionOpen, setAiSectionOpen] = useState(false);

  const handleToggleEmployee = (employeeId: string) => {
    setHiddenEmployeeIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  const goToPreviousWeek = () => {
    setCurrentWeek(prev => subWeeks(prev, 1));
  };
  
  const goToNextWeek = () => {
    setCurrentWeek(prev => addWeeks(prev, 1));
  };

  const goToToday = () => {
    setCurrentWeek(new Date());
  };

  // Real data from Supabase
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerAvailability, setCustomerAvailability] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [pendingChanges, setPendingChanges] = useState<any[]>([]);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [employeeOrder, setEmployeeOrder] = useState<string[]>([]);
  const [conflictWarning, setConflictWarning] = useState<{
    show: boolean;
    appointmentId: string;
    employeeId: string;
    conflicts: any[];
  }>({
    show: false,
    appointmentId: '',
    employeeId: '',
    conflicts: []
  });
  const [showCreateAppointment, setShowCreateAppointment] = useState(false);
  const [showCreateRecurring, setShowCreateRecurring] = useState(false);
  const [showSlotDialog, setShowSlotDialog] = useState(false);
  const [slotDialogData, setSlotDialogData] = useState<{ employeeId: string; date: Date } | null>(null);
  const {
    toast
  } = useToast();

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8
    }
  }), useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates
  }));

  // Load data from Supabase
  useEffect(() => {
    loadData();
  }, []);

  // Scroll to today on initial load
  useEffect(() => {
    if (!loading && appointments.length > 0) {
      scrollToToday();
    }
  }, [loading]);
  const loadData = async () => {
    setLoading(true);
    try {
      // Load employees with benutzer relation
      const {
        data: employeesData,
        error: employeesError
      } = await supabase.from('mitarbeiter').select('*, benutzer!inner(*)').order('created_at', {
        ascending: true
      });
      if (employeesError) throw employeesError;

      // Load customers with availability
      const {
        data: customersData,
        error: customersError
      } = await supabase.from('kunden').select(`
          *,
          availability:kunden_zeitfenster(*)
        `).eq('aktiv', true).order('name');
      if (customersError) throw customersError;

      // Load appointments
      const {
        data: appointmentsData,
        error: appointmentsError
      } = await supabase.from('termine').select(`
          *,
          customer:kunden(*),
          employee:mitarbeiter(*)
        `).order('start_at');
      if (appointmentsError) throw appointmentsError;

      // Load pending changes
      const {
        data: pendingChangesData,
        error: changesError
      } = await supabase.from('termin_aenderungen').select(`
          *,
          requester:benutzer!requested_by(*),
          old_customer:kunden!old_kunden_id(*),
          new_customer:kunden!new_kunden_id(*),
          old_employee:mitarbeiter!old_mitarbeiter_id(*),
          new_employee:mitarbeiter!new_mitarbeiter_id(*)
        `).eq('status', 'pending').order('created_at', {
        ascending: false
      });
      if (changesError) throw changesError;

      // Transform employees data to match our interface
      const transformedEmployees = employeesData?.map(emp => {
        const benutzer = (emp as any).benutzer;
        const fullName = benutzer?.vorname && benutzer?.nachname ? `${benutzer.vorname} ${benutzer.nachname}` : `Mitarbeiter ${emp.id.slice(0, 8)}`;
        return {
          ...emp,
          name: fullName,
          workload: Math.floor(Math.random() * 40) + 60
        };
      }) || [];

      // Transform appointments data to match our interface
      const transformedAppointments = appointmentsData?.map(app => ({
        ...app,
        customer: app.customer ? {
          id: app.customer.id,
          name: (app.customer as any).name || '',
          email: app.customer.email || null,
          telefonnr: (app.customer as any).telefonnr || null,
          geburtsdatum: (app.customer as any).geburtsdatum || null,
          pflegegrad: (app.customer as any).pflegegrad || null,
          adresse: (app.customer as any).adresse || null,
          stadtteil: (app.customer as any).stadtteil || null,
          notfall_name: (app.customer as any).notfall_name || null,
          notfall_telefon: (app.customer as any).notfall_telefon || null,
          aktiv: (app.customer as any).aktiv || false,
          status: (app.customer as any).status || null,
          pflegekasse: (app.customer as any).pflegekasse || null,
          versichertennummer: (app.customer as any).versichertennummer || null,
          stunden_kontingent_monat: (app.customer as any).stunden_kontingent_monat || null,
          tage: (app.customer as any).tage || null,
          mitarbeiter: (app.customer as any).mitarbeiter || null,
          angehoerige_ansprechpartner: (app.customer as any).angehoerige_ansprechpartner || null,
          farbe_kalender: (app.customer as any).farbe_kalender || '#10B981'
        } as Customer : undefined,
        employee: app.employee ? {
          ...app.employee,
          name: (app.employee as any).benutzer?.email || `Mitarbeiter ${app.employee.id.slice(0, 8)}`,
          workload: Math.floor(Math.random() * 40) + 60
        } : undefined
      })) || [];

      // Transform customers data
      const transformedCustomers = customersData?.map(cust => ({
        id: cust.id,
        name: (cust as any).name || '',
        email: cust.email || null,
        telefonnr: (cust as any).telefonnr || null,
        geburtsdatum: (cust as any).geburtsdatum || null,
        pflegegrad: (cust as any).pflegegrad || null,
        adresse: (cust as any).adresse || null,
        stadtteil: (cust as any).stadtteil || null,
        notfall_name: (cust as any).notfall_name || null,
        notfall_telefon: (cust as any).notfall_telefon || null,
        aktiv: (cust as any).aktiv || false,
        status: (cust as any).status || null,
        pflegekasse: (cust as any).pflegekasse || null,
        versichertennummer: (cust as any).versichertennummer || null,
        stunden_kontingent_monat: (cust as any).stunden_kontingent_monat || null,
        tage: (cust as any).tage || null,
        mitarbeiter: (cust as any).mitarbeiter || null,
        angehoerige_ansprechpartner: (cust as any).angehoerige_ansprechpartner || null
      }) as Customer) || [];
      setEmployees(transformedEmployees);
      setCustomers(transformedCustomers);
      setAppointments(transformedAppointments);

      // Process customer availability
      const availabilityMap: Record<string, any[]> = {};
      customersData?.forEach(customer => {
        if (customer.availability) {
          availabilityMap[customer.id] = customer.availability;
        }
      });
      setCustomerAvailability(availabilityMap);

      // Set pending changes
      setPendingChanges(pendingChangesData || []);

      // Initialize employee order if not set
      if (employeeOrder.length === 0) {
        setEmployeeOrder(transformedEmployees.map(emp => emp.id));
      }
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
  const filteredEmployees = useMemo(() => {
    const filtered = employees.filter(emp => emp.ist_aktiv && !hiddenEmployeeIds.has(emp.id) && emp.name.toLowerCase().includes(searchEmployee.toLowerCase()));

    // Sort by custom order first, then by selected criteria
    return filtered.sort((a, b) => {
      const aIndex = employeeOrder.indexOf(a.id);
      const bIndex = employeeOrder.indexOf(b.id);

      // If both have custom order, use that
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      // If only one has custom order, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // Otherwise use selected sorting criteria
      switch (sortEmployees) {
        case 'workload':
          return b.workload - a.workload;
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [employees, searchEmployee, sortEmployees, employeeOrder, hiddenEmployeeIds]);
  const openAppointments = useMemo(() => {
    return appointments.filter(app => !app.mitarbeiter_id);
  }, [appointments]);
  const filteredAppointments = useMemo(() => {
    return openAppointments.filter(app => {
      const matchesSearch = app.titel.toLowerCase().includes(searchAppointment.toLowerCase());
      return matchesSearch;
    });
  }, [openAppointments, searchAppointment]);
  const getMonthDates = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const dates = [];
    let current = monthStart; // Start at the 1st of the month

    // Get all days from start of month to end of month
    while (current <= monthEnd) {
      dates.push(new Date(current));
      current = addDays(current, 1);
    }
    return dates;
  };

  const getWeekDates = () => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 }); // Sunday
    const dates = [];
    let current = weekStart;

    while (current <= weekEnd) {
      dates.push(new Date(current));
      current = addDays(current, 1);
    }
    return dates;
  };

  const getCurrentDates = () => {
    return viewMode === 'month' ? getMonthDates() : getWeekDates();
  };

  // Auto-scroll to center current day
  useEffect(() => {
    if (scrollAreaRef.current && !loading) {
      const dates = getCurrentDates();
      const today = new Date();
      const todayIndex = dates.findIndex(date => format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'));
      if (todayIndex !== -1) {
        // Calculate scroll position to center today
        const cellWidth = DAY_COL_WIDTH; // from shared config
        const employeeColumnWidth = EMPLOYEE_COL_WIDTH;
        const scrollToX = employeeColumnWidth + todayIndex * cellWidth - scrollAreaRef.current.clientWidth / 2 + cellWidth / 2;
        setTimeout(() => {
          scrollAreaRef.current?.scrollTo({
            left: Math.max(0, scrollToX),
            behavior: 'smooth'
          });
        }, 100);
      }
    }
  }, [currentMonth, currentWeek, viewMode, loading]);

  // DnD event handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };
  const handleEmployeeSort = (event: DragEndEvent) => {
    const {
      active,
      over
    } = event;
    if (!over || active.id === over.id) {
      return;
    }

    // Extract employee IDs from the sort prefixed IDs
    const activeEmployeeId = (active.id as string).replace('employee-sort-', '');
    const overEmployeeId = (over.id as string).replace('employee-sort-', '');
    const oldIndex = employeeOrder.indexOf(activeEmployeeId);
    const newIndex = employeeOrder.indexOf(overEmployeeId);
    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = [...employeeOrder];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, activeEmployeeId);
      setEmployeeOrder(newOrder);
    }
  };
  const checkForConflicts = (appointmentId: string, employeeId: string) => {
    const appointment = appointments.find(app => app.id === appointmentId);
    if (!appointment) return [];
    const appointmentStart = new Date(appointment.start_at);
    const appointmentEnd = new Date(appointment.end_at);
    return appointments.filter(existingApp => existingApp.mitarbeiter_id === employeeId && existingApp.id !== appointmentId &&
    // Check for time overlap
    new Date(existingApp.start_at) < appointmentEnd && new Date(existingApp.end_at) > appointmentStart);
  };
  const assignAppointment = async (appointmentId: string, employeeId: string) => {
    try {
      console.log('Assigning appointment:', appointmentId, 'to employee:', employeeId);

      // Update local state immediately for instant UI feedback
      setAppointments(prev => prev.map(app => app.id === appointmentId ? {
        ...app,
        mitarbeiter_id: employeeId,
        status: 'scheduled'
      } : app));
      const appointment = appointments.find(app => app.id === appointmentId);
      const employee = employees.find(emp => emp.id === employeeId);

      // Only update mitarbeiter_id and status - keep original time unchanged
      const {
        error
      } = await supabase.from('termine').update({
        mitarbeiter_id: employeeId,
        status: 'scheduled'
      }).eq('id', appointmentId);
      if (error) throw error;
      toast({
        title: 'Erfolg',
        description: `${appointment?.customer?.name} → ${employee?.name}`
      });
    } catch (error: any) {
      console.error('Error assigning appointment:', error);
      // Revert local state on error
      setAppointments(prev => prev.map(app => app.id === appointmentId ? {
        ...app,
        mitarbeiter_id: null,
        status: 'unassigned'
      } : app));
      toast({
        title: 'Zuordnung fehlgeschlagen',
        description: 'Technisches Problem aufgetreten.',
        variant: 'destructive'
      });
    }
  };
  const handleConflictConfirm = () => {
    assignAppointment(conflictWarning.appointmentId, conflictWarning.employeeId);
    setConflictWarning({
      show: false,
      appointmentId: '',
      employeeId: '',
      conflicts: []
    });
  };
  const handleCreateAppointment = async (appointmentData: any) => {
    try {
      const {
        error
      } = await supabase.from('termine').insert({
        ...appointmentData,
        status: appointmentData.mitarbeiter_id ? 'scheduled' : 'unassigned'
      });
      if (error) throw error;
      toast({
        title: 'Erfolg',
        description: 'Termin wurde erstellt.'
      });
      await loadData();
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      toast({
        title: 'Fehler',
        description: error.message || 'Termin konnte nicht erstellt werden.',
        variant: 'destructive'
      });
    }
  };
  const handleCreateRecurringAppointment = async (templateData: any) => {
    try {
      // Insert template
      const { data: templateResult, error: templateError } = await supabase
        .from('termin_vorlagen')
        .insert({
          ...templateData,
          ist_aktiv: true
        })
        .select()
        .single();
      
      if (templateError) throw templateError;

      // Generate initial appointments from template
      const { error: generateError } = await supabase.rpc('generate_termine_from_vorlagen', {
        p_from: templateData.gueltig_von,
        p_to: templateData.gueltig_bis || format(addMonths(new Date(templateData.gueltig_von), 3), 'yyyy-MM-dd')
      });

      if (generateError) throw generateError;

      toast({
        title: 'Erfolg',
        description: 'Terminserie wurde erstellt und Termine generiert.'
      });
      await loadData();
    } catch (error: any) {
      console.error('Error creating recurring appointment:', error);
      toast({
        title: 'Fehler',
        description: error.message || 'Regeltermin konnte nicht erstellt werden.',
        variant: 'destructive'
      });
    }
  };

  const handleSlotClick = (employeeId: string, date: Date) => {
    setSlotDialogData({ employeeId, date });
    setShowSlotDialog(true);
  };

  const handleSlotSingleAppointment = async (data: any) => {
    await handleCreateAppointment(data);
  };

  const handleSlotRecurringAppointment = async (data: any) => {
    await handleCreateRecurringAppointment(data);
  };
  const handleSmartMatch = (customerId: string, employeeId: string) => {
    // Pre-populate the create appointment dialog with customer and employee
    setShowCreateAppointment(true);
    // Note: You would need to modify CreateAppointmentDialog to accept initial values
  };
  const autoAssignAppointments = async () => {
    if (openAppointments.length === 0) return;
    let assignedCount = 0;
    for (const appointment of openAppointments) {
      // Simple auto-assignment logic: find employee with lowest workload
      const availableEmployees = employees.filter(emp => emp.ist_aktiv).map(emp => ({
        ...emp,
        currentLoad: appointments.filter(app => app.mitarbeiter_id === emp.id).length
      })).filter(emp => emp.currentLoad < (emp.max_termine_pro_tag || 8)).sort((a, b) => a.currentLoad - b.currentLoad);
      if (availableEmployees.length > 0) {
        try {
          const {
            error
          } = await supabase.from('termine').update({
            mitarbeiter_id: availableEmployees[0].id,
            status: 'scheduled'
          }).eq('id', appointment.id);
          if (!error) {
            assignedCount++;
          }
        } catch (error) {
          console.error('Error auto-assigning appointment:', error);
        }
      }
    }
    toast({
      title: 'Auto-Zuweisung abgeschlossen',
      description: `${assignedCount} von ${openAppointments.length} Terminen wurden zugewiesen.`
    });
    setTimeout(() => {
      loadData();
    }, 100);
  };
  const handleDragEnd = async (event: DragEndEvent) => {
    const {
      active,
      over
    } = event;
    console.log('=== DRAG END EVENT ===');
    console.log('Active ID:', active.id);
    console.log('Over ID:', over?.id);
    if (!over) {
      console.log('❌ No drop target detected');
      setActiveId(null);
      return;
    }
    const activeIdStr = active.id as string;

    // Handle employee sorting (different logic)
    if (activeIdStr.startsWith('employee-sort-')) {
      console.log('📋 Handling employee sorting');
      handleEmployeeSort(event);
      setActiveId(null);
      return;
    }

    // Handle appointment assignment
    const appointmentId = activeIdStr;
    const appointment = appointments.find(app => app.id === appointmentId);
    if (!appointment) {
      console.log('❌ Appointment not found:', appointmentId);
      setActiveId(null);
      return;
    }
    console.log('📅 Found appointment:', appointment.titel);

    // Parse drop target
    const overIdStr = over.id.toString();
    console.log('🎯 Drop target:', overIdStr);

    // Case 1: Dropping on employee zone (assignment)
    if (overIdStr.startsWith('employee-')) {
      const parts = overIdStr.split('-');
      console.log('🔍 Parsing employee drop zone:', parts);
      if (parts.length >= 3 && parts[0] === 'employee') {
        // Extract employee ID (handle UUIDs with dashes)
        const employeeId = parts.slice(1, -1).join('-');
        console.log('✅ Extracted employee ID:', employeeId);

        // Verify employee exists
        const employee = employees.find(emp => emp.id === employeeId);
        if (!employee) {
          console.log('❌ Employee not found:', employeeId);
          toast({
            title: 'Fehler',
            description: 'Mitarbeiter nicht gefunden.',
            variant: 'destructive'
          });
          setActiveId(null);
          return;
        }
        console.log('🎯 Assigning to employee:', employee.name);
        await assignAppointment(appointmentId, employeeId);
      } else {
        console.log('❌ Could not parse employee ID from drop zone');
        toast({
          title: 'Fehler',
          description: 'Ungültiger Drop-Bereich.',
          variant: 'destructive'
        });
      }
    }

    // Case 2: Dropping on unassigned area (unassignment)
    else if (overIdStr === 'unassigned' || overIdStr.startsWith('unassigned-')) {
      console.log('📤 Unassigning appointment');
      try {
        // Update local state immediately for instant UI feedback
        setAppointments(prev => prev.map(app => app.id === appointmentId ? {
          ...app,
          mitarbeiter_id: null,
          status: 'unassigned'
        } : app));
        const {
          error
        } = await supabase.from('termine').update({
          mitarbeiter_id: null,
          status: 'unassigned'
        }).eq('id', appointmentId);
        if (error) {
          // Revert local state on error
          loadData();
          throw error;
        }
        toast({
          title: 'Erfolg',
          description: `Termin "${appointment.titel}" wurde zu offenen Terminen verschoben.`
        });
      } catch (error) {
        console.error('Error unassigning appointment:', error);
        toast({
          title: 'Fehler',
          description: 'Termin konnte nicht verschoben werden.',
          variant: 'destructive'
        });
      }
    }

    // Case 3: Unknown drop target
    else {
      console.log('❌ Unknown drop target:', overIdStr);
    }
    setActiveId(null);
  };
  const navigateMonth = (direction: number) => {
    setCurrentMonth(direction > 0 ? addMonths(currentMonth, 1) : subMonths(currentMonth, 1));
  };
  const getAppointmentCount = (employeeId: string, dayIndex: number) => {
    const date = getCurrentDates()[dayIndex];
    return appointments.filter(app => app.mitarbeiter_id === employeeId && format(new Date(app.start_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')).length;
  };
  const getAppointmentsForDate = (employeeId: string, dayIndex: number) => {
    const date = getCurrentDates()[dayIndex];
    return appointments.filter(app => app.mitarbeiter_id === employeeId && format(new Date(app.start_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
  };

  const handleAiRequest = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte geben Sie eine Anfrage ein',
        variant: 'destructive'
      });
      return;
    }

    setAiLoading(true);
    try {
      const response = await fetch('https://k01-2025-u36730.vm.elestio.app/webhook/020c0892-ebaf-4746-bfa1-3ead30e499c2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Webhook-Anfrage fehlgeschlagen');
      }

      toast({
        title: 'Erfolg',
        description: 'Termine werden erstellt...'
      });
      setAiPrompt('');
      
      // Reload data after a short delay to show new appointments
      setTimeout(() => {
        loadData();
      }, 2000);
    } catch (error) {
      console.error('AI Request Error:', error);
      toast({
        title: 'Fehler',
        description: 'Fehler beim Erstellen der Termine',
        variant: 'destructive'
      });
    } finally {
      setAiLoading(false);
    }
  };

  const examplePrompts = [
    'Erstelle einen Einzeltermin am Montag um 14:00 Uhr',
    'Erstelle einen Serientermin jeden Mittwoch um 10:00 Uhr',
    'Füge einen Notfalltermin für heute um 16:00 Uhr hinzu'
  ];

  const draggedAppointment = activeId ? appointments.find(app => app.id === activeId) : null;
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>;
  }
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="p-6 space-y-6 bg-gradient-to-br from-background to-muted/20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Dienstplan   Builder  </h1>
            
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowEmployeeManager(true)}>
              <Settings2 className="h-4 w-4 mr-2" />
              Mitarbeiter verwalten
              <Badge variant="secondary" className="ml-2">
                {filteredEmployees.length}
              </Badge>
            </Button>
            <Button onClick={() => setShowCreateAppointment(true)}>
              <CalendarDays className="h-4 w-4 mr-2" />
              Termin erstellen
            </Button>
            <Button variant="outline" onClick={() => setShowCreateRecurring(true)}>
              <Clock className="h-4 w-4 mr-2" />
              Regeltermin
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowApprovalDialog(true)}>
              <Bell className="h-4 w-4 mr-2" />
              Genehmigungen ({pendingChanges.length})
            </Button>
          </div>
        </div>


        {/* AI Agent Section */}
        <Collapsible open={aiSectionOpen} onOpenChange={setAiSectionOpen}>
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-primary/5 transition-colors p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">KI-Assistent für Terminplanung</CardTitle>
                      <p className="text-sm text-muted-foreground font-normal">Beschreiben Sie, welche Termine erstellt werden sollen</p>
                    </div>
                  </div>
                  <ChevronDown className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform duration-200",
                    aiSectionOpen && "transform rotate-180"
                  )} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className="p-6 pt-0">
                <div className="space-y-3">
                  <Textarea
                    placeholder="z.B. 'Erstelle einen Einzeltermin am Montag um 14:00 Uhr'"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="min-h-[100px] resize-none"
                    disabled={aiLoading}
                  />

                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground">Beispiele:</span>
                    {examplePrompts.map((prompt, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        onClick={() => setAiPrompt(prompt)}
                        disabled={aiLoading}
                        className="text-xs h-7"
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>

                  <Button 
                    onClick={handleAiRequest}
                    disabled={aiLoading || !aiPrompt.trim()}
                    className="w-full"
                  >
                    {aiLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Termine werden erstellt...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Termine mit KI erstellen
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-200 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-700" />
                </div>
                <div>
                  <p className="text-sm text-orange-700 font-medium">Offene Termine</p>
                  <p className="text-2xl font-bold text-orange-800">{openAppointments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-200 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-sm text-blue-700 font-medium">Zugewiesene Termine</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {appointments.filter(app => app.mitarbeiter_id).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-200 rounded-lg">
                  <Users className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <p className="text-sm text-green-700 font-medium">Aktive Mitarbeiter</p>
                  <p className="text-2xl font-bold text-green-800">
                    {employees.filter(emp => emp.ist_aktiv).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-200 rounded-lg">
                  <CalendarDays className="h-5 w-5 text-purple-700" />
                </div>
                <div>
                  <p className="text-sm text-purple-700 font-medium">Heutige Termine</p>
                  <p className="text-2xl font-bold text-purple-800">
                    {appointments.filter(app => format(new Date(app.start_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>


        {/* Employee Manager Dialog */}
        <Dialog open={showEmployeeManager} onOpenChange={setShowEmployeeManager}>
          <DialogContent className="max-w-2xl h-[90vh] p-0 flex flex-col">
            <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-primary/5 to-primary/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl">Mitarbeiter verwalten</DialogTitle>
                  <DialogDescription>
                    {filteredEmployees.length} von {employees.filter(e => e.ist_aktiv).length} Mitarbeitern sichtbar
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {/* Controls */}
              <div className="px-6 py-4 space-y-4 border-b bg-muted/30">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Mitarbeiter durchsuchen..." value={searchEmployee} onChange={e => setSearchEmployee(e.target.value)} className="pl-9 h-10" />
                </div>

                <div className="flex gap-2">
                  <Select value={sortEmployees} onValueChange={setSortEmployees}>
                    <SelectTrigger className="h-10 flex-1">
                      <SelectValue placeholder="Sortieren nach..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Nach Name
                        </div>
                      </SelectItem>
                      <SelectItem value="workload">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Nach Auslastung
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => {
                  setEmployeeOrder(employees.map(emp => emp.id));
                  setHiddenEmployeeIds(new Set());
                  setSearchEmployee('');
                }} className="h-10">
                    Reset
                  </Button>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id="toggle-all" checked={hiddenEmployeeIds.size === 0} onCheckedChange={checked => {
                    if (checked) {
                      setHiddenEmployeeIds(new Set());
                    } else {
                      setHiddenEmployeeIds(new Set(employees.filter(e => e.ist_aktiv).map(e => e.id)));
                    }
                  }} />
                    <label htmlFor="toggle-all" className="text-sm font-medium cursor-pointer">
                      Alle {hiddenEmployeeIds.size === 0 ? 'ausblenden' : 'einblenden'}
                    </label>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Eye className="h-3 w-3" />
                    {filteredEmployees.length} sichtbar
                  </Badge>
                </div>
              </div>

              {/* Employee List */}
              <div className="flex-1 min-h-0 overflow-hidden px-6 py-4">
                <ScrollArea className="h-full">
                  <div className="space-y-3 pr-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <GripVertical className="h-4 w-4" />
                    <span>Zum Sortieren ziehen</span>
                  </div>

                  <SortableContext items={employees.filter(e => e.ist_aktiv).map(emp => `employee-sort-${emp.id}`)} strategy={verticalListSortingStrategy}>
                    {employees.filter(e => e.ist_aktiv).map(employee => {
                      const isVisible = !hiddenEmployeeIds.has(employee.id);
                      const appointmentCount = appointments.filter(app => app.mitarbeiter_id === employee.id).length;
                      return <SortableEmployeeCard key={`employee-sort-${employee.id}`} id={`employee-sort-${employee.id}`} employee={employee} currentAppointments={appointments}>
                          <div className={cn("transition-opacity duration-200", !isVisible && "opacity-40")}>
                            <Card className={cn("border-2 transition-all duration-200 cursor-grab active:cursor-grabbing hover:shadow-md", isVisible ? "border-primary/20 bg-card hover:border-primary/40" : "border-muted bg-muted/50")}>
                              <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                  {/* Drag Handle */}
                                  <div className="flex-shrink-0">
                                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                                  </div>

                                  {/* Checkbox */}
                                  <Checkbox checked={isVisible} onCheckedChange={checked => {
                                  const newHidden = new Set(hiddenEmployeeIds);
                                  if (checked) {
                                    newHidden.delete(employee.id);
                                  } else {
                                    newHidden.add(employee.id);
                                  }
                                  setHiddenEmployeeIds(newHidden);
                                }} className="flex-shrink-0" />

                                  {/* Color Indicator */}
                                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{
                                  backgroundColor: employee.farbe_kalender
                                }} />

                                  {/* Employee Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{employee.name}</p>
                                  </div>

                                  {/* Appointment Count */}
                                  <Badge variant="secondary" className="flex-shrink-0">
                                    {appointmentCount} Termine
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </SortableEmployeeCard>;
                    })}
                  </SortableContext>
                </div>
                </ScrollArea>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 gap-6">

          {/* Main Schedule Grid */}
          <div>
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4" />
                  Masterkalender
                  <div className="ml-auto flex items-center gap-2">
                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-muted rounded-lg p-1 mr-2">
                      <Button 
                        variant={viewMode === 'week' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setViewMode('week')}
                        className="h-7 px-3"
                      >
                        Woche
                      </Button>
                      <Button 
                        variant={viewMode === 'month' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setViewMode('month')}
                        className="h-7 px-3"
                      >
                        Monat
                      </Button>
                    </div>

                    {/* Navigation */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={viewMode === 'month' ? goToPreviousMonth : goToPreviousWeek} 
                      className="h-8 px-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[180px] text-center">
                      {viewMode === 'month' 
                        ? format(currentMonth, 'MMMM yyyy', { locale: de })
                        : `${format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'dd. MMM', { locale: de })} - ${format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'dd. MMM yyyy', { locale: de })}`
                      }
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={viewMode === 'month' ? goToNextMonth : goToNextWeek} 
                      className="h-8 px-2"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="default" size="sm" onClick={scrollToToday} className="h-8 px-3 ml-2">
                      Heute
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ScrollArea className="w-full" ref={scrollAreaRef}>
                  <div className="space-y-3">
                    {/* Quick Actions Bar - Scrolls with calendar content */}
                    <div className="flex items-center justify-between gap-2 px-2 bg-muted/50 rounded-lg p-2">{}
                      <div className="flex items-center gap-2">
                        <Button onClick={scrollToPreviousWeek} variant="outline" size="sm" className="h-9 px-3">
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Vorherige Woche
                        </Button>
                        <Button onClick={scrollToNextWeek} variant="outline" size="sm" className="h-9 px-3">
                          Nächste Woche
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                        <Button onClick={scrollToToday} variant="default" size="sm" className="h-9 px-3">
                          Heute
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input placeholder="Termine suchen..." value={searchAppointment} onChange={e => setSearchAppointment(e.target.value)} className="w-48 h-9" />
                      </div>
                    </div>
                    {/* Unassigned Appointments Bar */}
                    <UnassignedAppointmentsBar appointments={appointments} weekDates={getCurrentDates()} activeId={activeId} onEditAppointment={setEditingAppointment} />
                    
                    {/* Calendar Grid */}
                    <CalendarGrid 
                      employees={filteredEmployees} 
                      appointments={appointments} 
                      weekDates={getCurrentDates()} 
                      activeId={activeId} 
                      onEditAppointment={setEditingAppointment}
                      onSlotClick={handleSlotClick}
                    />
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        <AppointmentDetailDialog isOpen={!!editingAppointment} onClose={() => setEditingAppointment(null)} appointment={editingAppointment} employees={employees} customers={customers} onUpdate={async appointment => {
        try {
          const {
            error
          } = await supabase.from('termine').update({
            titel: appointment.titel,
            status: appointment.status,
            mitarbeiter_id: appointment.mitarbeiter_id,
            kunden_id: appointment.kunden_id,
            start_at: appointment.start_at,
            end_at: appointment.end_at
          }).eq('id', appointment.id);
          if (error) throw error;
          toast({
            title: 'Erfolg',
            description: 'Termin wurde erfolgreich aktualisiert.'
          });
          await loadData();
          setEditingAppointment(null);
        } catch (error: any) {
          const msg = String(error?.message ?? error);
          const isOverlap = /termine_no_overlap|overlap|conflicting key value/i.test(msg);
          toast({
            title: 'Fehler',
            description: isOverlap ? 'Konflikt: Der Termin überschneidet sich mit einem bestehenden Termin.' : 'Fehler beim Aktualisieren des Termins.',
            variant: 'destructive'
          });
          throw error;
        }
      }} />

        <AppointmentApprovalDialog isOpen={showApprovalDialog} onClose={() => setShowApprovalDialog(false)} changes={pendingChanges} onApprovalAction={() => {
        loadData();
        setShowApprovalDialog(false);
      }} />

        <ConflictWarningDialog isOpen={conflictWarning.show} onClose={() => setConflictWarning({
        show: false,
        appointmentId: '',
        employeeId: '',
        conflicts: []
      })} onConfirm={handleConflictConfirm} employeeName={employees.find(emp => emp.id === conflictWarning.employeeId)?.name || ''} appointmentTitle={appointments.find(app => app.id === conflictWarning.appointmentId)?.titel || ''} conflictingAppointments={conflictWarning.conflicts} newAppointmentTime={{
        start: appointments.find(app => app.id === conflictWarning.appointmentId)?.start_at || new Date().toISOString(),
        end: appointments.find(app => app.id === conflictWarning.appointmentId)?.end_at || new Date().toISOString()
      }} />

        <CreateAppointmentDialog open={showCreateAppointment} onOpenChange={setShowCreateAppointment} customers={customers} employees={employees} onSubmit={handleCreateAppointment} />

        <CreateRecurringAppointmentDialog open={showCreateRecurring} onOpenChange={setShowCreateRecurring} customers={customers} employees={employees} onSubmit={handleCreateRecurringAppointment} />

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
      </div>

      <DragOverlay>
        {draggedAppointment ? <DraggableAppointment appointment={draggedAppointment} isDragging={true} /> : null}
      </DragOverlay>
    </DndContext>;
};
export default ScheduleBuilder;