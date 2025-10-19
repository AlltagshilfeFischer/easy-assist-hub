import { useState, useMemo, useEffect, useRef } from 'react';
import { format, startOfWeek, addDays, parseISO, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { CalendarDays, ChevronLeft, ChevronRight, User, Clock, AlertTriangle, Users, Calendar, TrendingUp, Filter, Search, Eye, Bell, GripVertical, MapPin, Phone } from 'lucide-react';
import { EMPLOYEE_COL_WIDTH, DAY_COL_WIDTH } from '@/components/schedule/gridConfig';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AppointmentApprovalDialog } from '@/components/schedule/AppointmentApprovalDialog';
import { ConflictWarningDialog } from '@/components/schedule/ConflictWarningDialog';
import { CalendarGrid } from '@/components/schedule/CalendarGrid';
import { AppointmentDetailDialog } from '@/components/schedule/AppointmentDetailDialog';
import { DraggableAppointment } from '@/components/schedule/DraggableAppointment';
import { DropZone } from '@/components/schedule/DropZone';
import { EmployeeCard } from '@/components/schedule/EmployeeCard';
import { SortableEmployeeCard } from '@/components/schedule/SortableEmployeeCard';
import { UnassignedAppointmentsBar } from '@/components/schedule/UnassignedAppointmentsBar';
import { CreateAppointmentDialog } from '@/components/schedule/CreateAppointmentDialog';
import { CreateRecurringAppointmentDialog } from '@/components/schedule/CreateRecurringAppointmentDialog';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [searchEmployee, setSearchEmployee] = useState('');
  const [searchAppointment, setSearchAppointment] = useState('');
  const [sortEmployees, setSortEmployees] = useState('name');
  const [filterPriority, setFilterPriority] = useState('all');
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [showEmployeeFilters, setShowEmployeeFilters] = useState(false);
  const [hiddenEmployeeIds, setHiddenEmployeeIds] = useState<Set<string>>(new Set());
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const scrollToToday = () => {
    setCurrentMonth(new Date());
    
    // Trigger scroll to center today after month change
    setTimeout(() => {
      if (scrollAreaRef.current) {
        const dates = getMonthDates();
        const today = new Date();
        const todayIndex = dates.findIndex(date => 
          format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
        );
        
        if (todayIndex !== -1) {
          const cellWidth = DAY_COL_WIDTH;
          const employeeColumnWidth = EMPLOYEE_COL_WIDTH;
          const scrollToX = employeeColumnWidth + (todayIndex * cellWidth) - (scrollAreaRef.current.clientWidth / 2) + (cellWidth / 2);
          
          scrollAreaRef.current.scrollTo({
            left: Math.max(0, scrollToX),
            behavior: 'smooth'
          });
        }
      }
    }, 200);
  };

  const scrollByWeeks = (weeks: number) => {
    if (scrollAreaRef.current) {
      const cellWidth = DAY_COL_WIDTH;
      const scrollAmount = cellWidth * 7 * weeks; // 7 days per week
      
      scrollAreaRef.current.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const scrollToPreviousWeek = () => {
    scrollByWeeks(-1);
  };

  const scrollToNextWeek = () => {
    scrollByWeeks(1);
  };
  
  const goToPreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };
  
  const goToNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
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
  }>({ show: false, appointmentId: '', employeeId: '', conflicts: [] });
  const [showCreateAppointment, setShowCreateAppointment] = useState(false);
  const [showCreateRecurring, setShowCreateRecurring] = useState(false);
  
  const { toast } = useToast();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load data from Supabase
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load employees with benutzer relation
      const { data: employeesData, error: employeesError } = await supabase
        .from('mitarbeiter')
        .select('*, benutzer!inner(*)')
        .order('created_at', { ascending: true });
      
      if (employeesError) throw employeesError;

      // Load customers with availability
      const { data: customersData, error: customersError } = await supabase
        .from('kunden')
        .select(`
          *,
          availability:kunden_zeitfenster(*)
        `)
        .eq('aktiv', true)
        .order('name');
      
      if (customersError) throw customersError;

      // Load appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('termine')
        .select(`
          *,
          customer:kunden(*),
          employee:mitarbeiter(*)
        `)
        .order('start_at');
      
      if (appointmentsError) throw appointmentsError;

      // Load pending changes
      const { data: pendingChangesData, error: changesError } = await supabase
        .from('termin_aenderungen')
        .select(`
          *,
          requester:benutzer!requested_by(*),
          old_customer:kunden!old_kunden_id(*),
          new_customer:kunden!new_kunden_id(*),
          old_employee:mitarbeiter!old_mitarbeiter_id(*),
          new_employee:mitarbeiter!new_mitarbeiter_id(*)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (changesError) throw changesError;

      // Transform employees data to match our interface
      const transformedEmployees = employeesData?.map(emp => {
        const benutzer = (emp as any).benutzer;
        const fullName = benutzer?.vorname && benutzer?.nachname 
          ? `${benutzer.vorname} ${benutzer.nachname}`
          : `Mitarbeiter ${emp.id.slice(0, 8)}`;
        
        return {
          ...emp,
          name: fullName,
          workload: Math.floor(Math.random() * 40) + 60,
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
        } as Customer : undefined,
        employee: app.employee ? {
          ...app.employee,
          name: (app.employee as any).benutzer?.email || `Mitarbeiter ${app.employee.id.slice(0, 8)}`,
          workload: Math.floor(Math.random() * 40) + 60,
        } : undefined,
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
        angehoerige_ansprechpartner: (cust as any).angehoerige_ansprechpartner || null,
      } as Customer)) || [];

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
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    const filtered = employees.filter(emp => 
      emp.ist_aktiv && 
      !hiddenEmployeeIds.has(emp.id) &&
      emp.name.toLowerCase().includes(searchEmployee.toLowerCase())
    );
    
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

  // Auto-scroll to center current day
  useEffect(() => {
    if (scrollAreaRef.current && !loading) {
      const dates = getMonthDates();
      const today = new Date();
      const todayIndex = dates.findIndex(date => 
        format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
      );
      
      if (todayIndex !== -1) {
        // Calculate scroll position to center today
const cellWidth = DAY_COL_WIDTH; // from shared config
        const employeeColumnWidth = EMPLOYEE_COL_WIDTH;
        const scrollToX = employeeColumnWidth + (todayIndex * cellWidth) - (scrollAreaRef.current.clientWidth / 2) + (cellWidth / 2);
        
        setTimeout(() => {
          scrollAreaRef.current?.scrollTo({
            left: Math.max(0, scrollToX),
            behavior: 'smooth'
          });
        }, 100);
      }
    }
  }, [currentMonth, loading]);

  // Also scroll when month changes
  useEffect(() => {
    if (scrollAreaRef.current && !loading) {
      const dates = getMonthDates();
      const today = new Date();
      const todayIndex = dates.findIndex(date => 
        format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
      );
      
      if (todayIndex !== -1) {
const cellWidth = DAY_COL_WIDTH;
        const employeeColumnWidth = EMPLOYEE_COL_WIDTH;
        const scrollToX = employeeColumnWidth + (todayIndex * cellWidth) - (scrollAreaRef.current.clientWidth / 2) + (cellWidth / 2);
        
        setTimeout(() => {
          scrollAreaRef.current?.scrollTo({
            left: Math.max(0, scrollToX),
            behavior: 'smooth'
          });
        }, 100);
      }
    }
  }, [currentMonth]);

  // DnD event handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleEmployeeSort = (event: DragEndEvent) => {
    const { active, over } = event;
    
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

    return appointments.filter(existingApp => 
      existingApp.mitarbeiter_id === employeeId &&
      existingApp.id !== appointmentId &&
      // Check for time overlap
      new Date(existingApp.start_at) < appointmentEnd &&
      new Date(existingApp.end_at) > appointmentStart
    );
  };

  const assignAppointment = async (appointmentId: string, employeeId: string) => {
    try {
      console.log('Assigning appointment:', appointmentId, 'to employee:', employeeId);

      // Update local state immediately for instant UI feedback
      setAppointments(prev => prev.map(app => 
        app.id === appointmentId 
          ? { ...app, mitarbeiter_id: employeeId, status: 'scheduled' }
          : app
      ));

      const appointment = appointments.find(app => app.id === appointmentId);
      const employee = employees.find(emp => emp.id === employeeId);

      // Only update mitarbeiter_id and status - keep original time unchanged
      const { error } = await supabase
        .from('termine')
        .update({ 
          mitarbeiter_id: employeeId,
          status: 'scheduled'
        })
        .eq('id', appointmentId);

      if (error) throw error;
      
      toast({
        title: 'Erfolg',
        description: `${appointment?.customer?.name} → ${employee?.name}`,
      });
      
    } catch (error: any) {
      console.error('Error assigning appointment:', error);
      // Revert local state on error
      setAppointments(prev => prev.map(app => 
        app.id === appointmentId 
          ? { ...app, mitarbeiter_id: null, status: 'unassigned' }
          : app
      ));
      
      toast({
        title: 'Zuordnung fehlgeschlagen',
        description: 'Technisches Problem aufgetreten.',
        variant: 'destructive',
      });
    }
  };

  const handleConflictConfirm = () => {
    assignAppointment(conflictWarning.appointmentId, conflictWarning.employeeId);
    setConflictWarning({ show: false, appointmentId: '', employeeId: '', conflicts: [] });
  };

  const handleCreateAppointment = async (appointmentData: any) => {
    try {
      const { error } = await supabase
        .from('termine')
        .insert({
          ...appointmentData,
          status: appointmentData.mitarbeiter_id ? 'scheduled' : 'unassigned',
        });

      if (error) throw error;

      toast({
        title: 'Erfolg',
        description: 'Termin wurde erstellt.',
      });

      await loadData();
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      toast({
        title: 'Fehler',
        description: error.message || 'Termin konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateRecurringAppointment = async (templateData: any) => {
    try {
      const { error } = await supabase
        .from('termin_vorlagen')
        .insert({
          ...templateData,
          ist_aktiv: true,
        });

      if (error) throw error;

      toast({
        title: 'Erfolg',
        description: 'Regeltermin wurde erstellt.',
      });

      await loadData();
    } catch (error: any) {
      console.error('Error creating recurring appointment:', error);
      toast({
        title: 'Fehler',
        description: error.message || 'Regeltermin konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    }
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
      const availableEmployees = employees
        .filter(emp => emp.ist_aktiv)
        .map(emp => ({
          ...emp,
          currentLoad: appointments.filter(app => app.mitarbeiter_id === emp.id).length
        }))
        .filter(emp => emp.currentLoad < (emp.max_termine_pro_tag || 8))
        .sort((a, b) => a.currentLoad - b.currentLoad);

      if (availableEmployees.length > 0) {
        try {
          const { error } = await supabase
            .from('termine')
            .update({ 
              mitarbeiter_id: availableEmployees[0].id,
              status: 'scheduled'
            })
            .eq('id', appointment.id);

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
      description: `${assignedCount} von ${openAppointments.length} Terminen wurden zugewiesen.`,
    });

    setTimeout(() => {
      loadData();
    }, 100);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
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
            variant: 'destructive',
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
          variant: 'destructive',
        });
      }
    }
    
    // Case 2: Dropping on unassigned area (unassignment)
    else if (overIdStr === 'unassigned' || overIdStr.startsWith('unassigned-')) {
      console.log('📤 Unassigning appointment');
      try {
        // Update local state immediately for instant UI feedback
        setAppointments(prev => prev.map(app => 
          app.id === appointmentId 
            ? { ...app, mitarbeiter_id: null, status: 'unassigned' }
            : app
        ));

        const { error } = await supabase
          .from('termine')
          .update({ 
            mitarbeiter_id: null,
            status: 'unassigned'
          })
          .eq('id', appointmentId);

        if (error) {
          // Revert local state on error
          loadData();
          throw error;
        }

        toast({
          title: 'Erfolg',
          description: `Termin "${appointment.titel}" wurde zu offenen Terminen verschoben.`,
        });
      } catch (error) {
        console.error('Error unassigning appointment:', error);
        toast({
          title: 'Fehler',
          description: 'Termin konnte nicht verschoben werden.',
          variant: 'destructive',
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
    const date = getMonthDates()[dayIndex];
    return appointments.filter(app => 
      app.mitarbeiter_id === employeeId && 
      format(new Date(app.start_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    ).length;
  };

  const getAppointmentsForDate = (employeeId: string, dayIndex: number) => {
    const date = getMonthDates()[dayIndex];
    return appointments.filter(app => 
      app.mitarbeiter_id === employeeId && 
      format(new Date(app.start_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
  };

  const draggedAppointment = activeId ? appointments.find(app => app.id === activeId) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
      <div className="p-6 space-y-6 bg-gradient-to-br from-background to-muted/20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Dienstplan Builder
            </h1>
            <p className="text-muted-foreground mt-1">
              Termine per Drag & Drop zuweisen und verwalten
            </p>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Week Navigation */}
        <Card className="shadow-lg border-0 bg-gradient-to-r from-white to-gray-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={() => navigateMonth(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-xl font-semibold">
                  {format(currentMonth, 'MMMM yyyy', { locale: de })}
                </h2>
                <Button variant="outline" size="sm" onClick={() => navigateMonth(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" onClick={scrollToToday}>
                Heute
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                    {appointments.filter(app => 
                      format(new Date(app.start_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                    ).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-200 rounded-lg">
                  <Bell className="h-5 w-5 text-yellow-700" />
                </div>
                <div>
                  <p className="text-sm text-yellow-700 font-medium">Genehmigungen</p>
                  <p className="text-2xl font-bold text-yellow-800">{pendingChanges.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>


        <div className="grid grid-cols-1 gap-6">
          {/* Filter and Sort Button */}
          <div className="flex justify-start">
            <Button
              onClick={() => setShowEmployeeFilters(!showEmployeeFilters)}
              className="h-10 gap-2"
            >
              <Filter className="h-4 w-4" />
              Filtern und Sortieren
              <Badge variant="secondary" className="ml-1 px-2 py-0 h-5">
                {filteredEmployees.length}
              </Badge>
            </Button>
          </div>

          {/* Employee Filter Sheet */}
          <Sheet open={showEmployeeFilters} onOpenChange={setShowEmployeeFilters}>
            <SheetContent side="left" className="w-full sm:w-[540px] p-0 flex flex-col">
              <SheetHeader className="px-6 py-4 border-b bg-gradient-to-r from-primary/5 to-primary/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <SheetTitle className="text-xl">Mitarbeiter verwalten</SheetTitle>
                    <SheetDescription>
                      {filteredEmployees.length} von {employees.filter(e => e.ist_aktiv).length} Mitarbeitern sichtbar
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Search and Controls */}
                <div className="px-6 py-4 space-y-4 border-b bg-muted/30">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Mitarbeiter durchsuchen..."
                      value={searchEmployee}
                      onChange={(e) => setSearchEmployee(e.target.value)}
                      className="pl-9 h-10"
                    />
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
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setEmployeeOrder(employees.map(emp => emp.id));
                        setHiddenEmployeeIds(new Set());
                        setSearchEmployee('');
                      }}
                      className="h-10"
                    >
                      Reset
                    </Button>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="toggle-all"
                        checked={hiddenEmployeeIds.size === 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setHiddenEmployeeIds(new Set());
                          } else {
                            setHiddenEmployeeIds(new Set(employees.filter(e => e.ist_aktiv).map(e => e.id)));
                          }
                        }}
                      />
                      <label
                        htmlFor="toggle-all"
                        className="text-sm font-medium cursor-pointer"
                      >
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
                <ScrollArea className="flex-1">
                  <div className="px-6 py-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <GripVertical className="h-4 w-4" />
                      <span>Zum Sortieren ziehen</span>
                    </div>

                    <SortableContext 
                      items={employees.filter(e => e.ist_aktiv).map(emp => `employee-sort-${emp.id}`)} 
                      strategy={verticalListSortingStrategy}
                    >
                      {employees.filter(e => e.ist_aktiv).map((employee) => {
                        const isVisible = !hiddenEmployeeIds.has(employee.id);
                        const appointmentCount = appointments.filter(app => app.mitarbeiter_id === employee.id).length;
                        const workloadPercentage = (appointmentCount / (employee.max_termine_pro_tag || 8)) * 100;
                        
                        return (
                          <div key={`employee-sort-${employee.id}`} className={cn(
                            "transition-opacity duration-200",
                            !isVisible && "opacity-40"
                          )}>
                            <Card className={cn(
                              "border-2 transition-all duration-200",
                              isVisible ? "border-primary/20 bg-card" : "border-muted bg-muted/50"
                            )}>
                              <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                  {/* Drag Handle */}
                                  <div className="cursor-grab active:cursor-grabbing flex-shrink-0">
                                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                                  </div>

                                  {/* Checkbox */}
                                  <Checkbox
                                    checked={isVisible}
                                    onCheckedChange={(checked) => {
                                      const newHidden = new Set(hiddenEmployeeIds);
                                      if (checked) {
                                        newHidden.delete(employee.id);
                                      } else {
                                        newHidden.add(employee.id);
                                      }
                                      setHiddenEmployeeIds(newHidden);
                                    }}
                                    className="flex-shrink-0"
                                  />

                                  {/* Color Indicator */}
                                  <div 
                                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm flex-shrink-0" 
                                    style={{ backgroundColor: employee.farbe_kalender }}
                                  />

                                  {/* Employee Info */}
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-sm truncate">{employee.name}</h4>
                                    {employee.telefon && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                        <Phone className="h-3 w-3" />
                                        {employee.telefon}
                                      </p>
                                    )}
                                  </div>

                                  {/* Stats */}
                                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <Badge 
                                      variant="outline"
                                      className={cn(
                                        "text-xs px-2 py-0 h-5",
                                        workloadPercentage >= 100 && "bg-red-50 text-red-700 border-red-200",
                                        workloadPercentage >= 80 && workloadPercentage < 100 && "bg-orange-50 text-orange-700 border-orange-200",
                                        workloadPercentage < 80 && "bg-green-50 text-green-700 border-green-200"
                                      )}
                                    >
                                      {appointmentCount} Termine
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {Math.round(workloadPercentage)}% Auslastung
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        );
                      })}
                    </SortableContext>
                  </div>
                </ScrollArea>
              </div>
            </SheetContent>
          </Sheet>

          {/* Main Schedule Grid */}
          <div>
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4" />
                  Masterkalender
                  <div className="ml-auto flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={goToPreviousMonth}
                      className="h-8 px-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[120px] text-center">
                      {format(currentMonth, 'MMMM yyyy', { locale: de })}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={goToNextMonth}
                      className="h-8 px-2"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={scrollToToday}
                      className="h-8 px-3 ml-2"
                    >
                      Heute
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="relative">
                  {/* Week Navigation Buttons */}
                  <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={scrollToPreviousWeek}
                      className="ml-2 h-8 w-8 p-0 rounded-full bg-background/90 backdrop-blur-sm shadow-lg hover:bg-background border-border/50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={scrollToNextWeek}
                      className="mr-2 h-8 w-8 p-0 rounded-full bg-background/90 backdrop-blur-sm shadow-lg hover:bg-background border-border/50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <ScrollArea className="w-full" ref={scrollAreaRef}>
                  <div className="space-y-3">
                    {/* Quick Actions Bar */}
                    <div className="flex items-center justify-between gap-2 px-2">
                      <div className="flex items-center gap-2">
                        <Button 
                          onClick={scrollToPreviousWeek} 
                          variant="outline" 
                          size="sm"
                          className="text-xs h-8"
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <Button 
                          onClick={scrollToNextWeek} 
                          variant="outline" 
                          size="sm"
                          className="text-xs h-8"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                        <Button 
                          onClick={scrollToToday} 
                          variant="outline" 
                          size="sm"
                          className="text-xs h-8"
                        >
                          Heute
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Termine suchen..."
                          value={searchAppointment}
                          onChange={(e) => setSearchAppointment(e.target.value)}
                          className="w-48 text-xs h-8"
                        />
                      </div>
                    </div>
                    {/* Unassigned Appointments Bar */}
                    <UnassignedAppointmentsBar
                      appointments={appointments}
                      weekDates={getMonthDates()}
                      activeId={activeId}
                      onEditAppointment={setEditingAppointment}
                    />
                    
                    {/* Calendar Grid */}
                    <CalendarGrid
                      employees={filteredEmployees}
                      appointments={appointments}
                      weekDates={getMonthDates()}
                      activeId={activeId}
                      onEditAppointment={setEditingAppointment}
                    />
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        <AppointmentDetailDialog
          isOpen={!!editingAppointment}
          onClose={() => setEditingAppointment(null)}
          appointment={editingAppointment}
          employees={employees}
          customers={customers}
          onUpdate={async (appointment) => {
            try {
              const { error } = await supabase
                .from('termine')
                .update({
                  titel: appointment.titel,
                  status: appointment.status,
                  mitarbeiter_id: appointment.mitarbeiter_id,
                  kunden_id: appointment.kunden_id,
                  start_at: appointment.start_at,
                  end_at: appointment.end_at
                })
                .eq('id', appointment.id);

              if (error) throw error;
              
              toast({
                title: 'Erfolg',
                description: 'Termin wurde erfolgreich aktualisiert.',
              });
              
              await loadData();
              setEditingAppointment(null);
            } catch (error: any) {
              const msg = String(error?.message ?? error);
              const isOverlap = /termine_no_overlap|overlap|conflicting key value/i.test(msg);
              
              toast({
                title: 'Fehler',
                description: isOverlap 
                  ? 'Konflikt: Der Termin überschneidet sich mit einem bestehenden Termin.'
                  : 'Fehler beim Aktualisieren des Termins.',
                variant: 'destructive',
              });
              
              throw error;
            }
          }}
        />

        <AppointmentApprovalDialog
          isOpen={showApprovalDialog}
          onClose={() => setShowApprovalDialog(false)}
          changes={pendingChanges}
          onApprovalAction={() => {
            loadData();
            setShowApprovalDialog(false);
          }}
        />

        <ConflictWarningDialog
          isOpen={conflictWarning.show}
          onClose={() => setConflictWarning({ show: false, appointmentId: '', employeeId: '', conflicts: [] })}
          onConfirm={handleConflictConfirm}
          employeeName={employees.find(emp => emp.id === conflictWarning.employeeId)?.name || ''}
          appointmentTitle={appointments.find(app => app.id === conflictWarning.appointmentId)?.titel || ''}
          conflictingAppointments={conflictWarning.conflicts}
          newAppointmentTime={{
            start: appointments.find(app => app.id === conflictWarning.appointmentId)?.start_at || new Date().toISOString(),
            end: appointments.find(app => app.id === conflictWarning.appointmentId)?.end_at || new Date().toISOString()
          }}
        />

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
      </div>

      <DragOverlay>
        {draggedAppointment ? (
          <DraggableAppointment
            appointment={draggedAppointment}
            isDragging={true}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default ScheduleBuilder;