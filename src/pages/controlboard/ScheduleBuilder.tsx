import { useState, useMemo, useEffect } from 'react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { CalendarDays, ChevronLeft, ChevronRight, User, Clock, AlertTriangle, Users, Calendar, TrendingUp, Filter, Search, Eye, Bell, GripVertical, MapPin, Phone } from 'lucide-react';
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
import { SmartAssignmentPanel } from '@/components/schedule/SmartAssignmentPanel';
import { UnassignedAppointmentsBar } from '@/components/schedule/UnassignedAppointmentsBar';
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
  vorname: string;
  nachname: string;
  name: string;
  email: string;
  telefon: string;
  ist_aktiv: boolean;
  max_termine_pro_tag: number;
  farbe_kalender: string;
  workload: number;
}

interface Customer {
  id: string;
  vorname: string;
  nachname: string;
  email: string;
  telefon: string;
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
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [searchEmployee, setSearchEmployee] = useState('');
  const [searchAppointment, setSearchAppointment] = useState('');
  const [sortEmployees, setSortEmployees] = useState('name');
  const [filterPriority, setFilterPriority] = useState('all');
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  
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
      // Load employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('mitarbeiter')
        .select('*')
        .order('vorname');
      
      if (employeesError) throw employeesError;

      // Load customers with availability
      const { data: customersData, error: customersError } = await supabase
        .from('kunden')
        .select(`
          *,
          availability:kunden_zeitfenster(*)
        `)
        .eq('aktiv', true)
        .order('vorname');
      
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

      // Transform employees data to match our interface
      const transformedEmployees = employeesData?.map(emp => ({
        ...emp,
        name: `${emp.vorname} ${emp.nachname}`,
        workload: Math.floor(Math.random() * 40) + 60,
      })) || [];

      // Transform appointments data to match our interface
      const transformedAppointments = appointmentsData?.map(app => ({
        ...app,
        customer: app.customer as Customer,
        employee: app.employee ? {
          ...app.employee,
          name: `${app.employee.vorname} ${app.employee.nachname}`,
          workload: Math.floor(Math.random() * 40) + 60,
        } : undefined,
      })) || [];

      setEmployees(transformedEmployees);
      setCustomers(customersData || []);
      setAppointments(transformedAppointments);
      
      // Process customer availability
      const availabilityMap: Record<string, any[]> = {};
      customersData?.forEach(customer => {
        if (customer.availability) {
          availabilityMap[customer.id] = customer.availability;
        }
      });
      setCustomerAvailability(availabilityMap);
      
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
  }, [employees, searchEmployee, sortEmployees, employeeOrder]);

  const openAppointments = useMemo(() => {
    return appointments.filter(app => !app.mitarbeiter_id);
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    return openAppointments.filter(app => {
      const matchesSearch = app.titel.toLowerCase().includes(searchAppointment.toLowerCase());
      return matchesSearch;
    });
  }, [openAppointments, searchAppointment]);

  const getWeekDates = () => {
    const start = startOfWeek(currentWeek, { weekStartsOn: 1 });
    if (viewMode === 'month') {
      // Show 4 weeks for month view
      return Array.from({ length: 28 }, (_, i) => addDays(start, i));
    }
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

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
        description: `${appointment?.customer?.vorname} ${appointment?.customer?.nachname} → ${employee?.name}`,
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

  const navigateWeek = (direction: number) => {
    if (viewMode === 'week') {
      setCurrentWeek(direction > 0 ? addWeeks(currentWeek, 1) : subWeeks(currentWeek, 1));
    } else {
      // For month view, navigate by 4 weeks
      setCurrentWeek(direction > 0 ? addWeeks(currentWeek, 4) : subWeeks(currentWeek, 4));
    }
  };

  const getAppointmentCount = (employeeId: string, dayIndex: number) => {
    const date = getWeekDates()[dayIndex];
    return appointments.filter(app => 
      app.mitarbeiter_id === employeeId && 
      format(new Date(app.start_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    ).length;
  };

  const getAppointmentsForDate = (employeeId: string, dayIndex: number) => {
    const date = getWeekDates()[dayIndex];
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
                <Button variant="outline" size="sm" onClick={() => navigateWeek(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-xl font-semibold">
                  {viewMode === 'week' 
                    ? `${format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'dd. MMMM', { locale: de })} - ${format(addDays(startOfWeek(currentWeek, { weekStartsOn: 1 }), 6), 'dd. MMMM yyyy', { locale: de })}`
                    : `${format(currentWeek, 'MMMM yyyy', { locale: de })}`
                  }
                </h2>
                <Button variant="outline" size="sm" onClick={() => navigateWeek(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant={viewMode === 'week' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('week')}
                  >
                    Woche
                  </Button>
                  <Button
                    variant={viewMode === 'month' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('month')}
                  >
                    Monat
                  </Button>
                </div>
              </div>
              <Button variant="outline" onClick={() => setCurrentWeek(new Date())}>
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


        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Sidebar */}
          <div className="xl:col-span-1 space-y-4">
            {/* Smart Assignment Panel */}
            <SmartAssignmentPanel
              employees={employees}
              appointments={appointments}
              openAppointments={openAppointments}
              onAssignAppointment={assignAppointment}
              onAutoAssign={autoAssignAppointments}
            />

            {/* Employee List */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  Mitarbeiter
                  <Badge variant="outline" className="text-xs ml-auto">
                    Drag & Drop
                  </Badge>
                </CardTitle>
                <div className="space-y-2">
                  <Input
                    placeholder="Suchen..."
                    value={searchEmployee}
                    onChange={(e) => setSearchEmployee(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Select value={sortEmployees} onValueChange={setSortEmployees}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="workload">Auslastung</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <SortableContext items={filteredEmployees.map(emp => `employee-sort-${emp.id}`)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredEmployees.map((employee) => (
                      <div key={`employee-sort-${employee.id}`}>
                        <SortableEmployeeCard
                          employee={employee}
                          currentAppointments={appointments.filter(app => app.mitarbeiter_id === employee.id).length}
                        />
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </CardContent>
            </Card>
          </div>

          {/* Schedule Grid */}
          <div className="xl:col-span-4">
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4" />
                  Masterkalender
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ScrollArea className="w-full">
                  <div className="space-y-4">
                    {/* Unassigned Appointments Bar */}
                    <UnassignedAppointmentsBar
                      appointments={appointments}
                      weekDates={getWeekDates()}
                      activeId={activeId}
                      onEditAppointment={setEditingAppointment}
                    />
                    
                    {/* Calendar Grid */}
                    <CalendarGrid
                      employees={filteredEmployees}
                      appointments={appointments}
                      weekDates={getWeekDates()}
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
                  mitarbeiter_id: appointment.mitarbeiter_id
                })
                .eq('id', appointment.id);

              if (error) throw error;
              await loadData();
            } catch (error) {
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