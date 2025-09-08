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
import { CalendarDays, ChevronLeft, ChevronRight, User, Clock, AlertTriangle, Users, Calendar, TrendingUp, Filter, Search, Eye, Bell, GripVertical, MapPin, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AppointmentApprovalDialog } from '@/components/schedule/AppointmentApprovalDialog';
import { DraggableAppointment } from '@/components/schedule/DraggableAppointment';
import { DropZone } from '@/components/schedule/DropZone';
import { EmployeeCard } from '@/components/schedule/EmployeeCard';
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
  status: 'unassigned' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
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
  const [viewMode, setViewMode] = useState('week');
  
  // Real data from Supabase
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingChanges, setPendingChanges] = useState<any[]>([]);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  
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

      // Load customers
      const { data: customersData, error: customersError } = await supabase
        .from('kunden')
        .select('*')
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
    return employees
      .filter(emp => 
        emp.ist_aktiv && 
        emp.name.toLowerCase().includes(searchEmployee.toLowerCase())
      )
      .sort((a, b) => {
        switch (sortEmployees) {
          case 'workload':
            return b.workload - a.workload;
          default:
            return a.name.localeCompare(b.name);
        }
      });
  }, [employees, searchEmployee, sortEmployees]);

  const openAppointments = useMemo(() => {
    return appointments.filter(app => app.status === 'unassigned');
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    return openAppointments.filter(app => {
      const matchesSearch = app.titel.toLowerCase().includes(searchAppointment.toLowerCase());
      return matchesSearch;
    });
  }, [openAppointments, searchAppointment]);

  const getWeekDates = () => {
    const start = startOfWeek(currentWeek, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  // DnD event handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const appointmentId = active.id as string;
    const appointment = appointments.find(app => app.id === appointmentId);
    
    if (!appointment) {
      setActiveId(null);
      return;
    }

    // Handle dropping on employee schedule
    if (over.id.toString().startsWith('employee-')) {
      const [, employeeId, dayIndex] = over.id.toString().split('-');
      
      try {
        // Update appointment assignment
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
          description: `Termin "${appointment.titel}" wurde zugewiesen.`,
        });
        
        loadData(); // Refresh data
      } catch (error) {
        console.error('Error updating appointment:', error);
        toast({
          title: 'Fehler',
          description: 'Termin konnte nicht zugewiesen werden.',
          variant: 'destructive',
        });
      }
    }
    
    // Handle dropping on unassigned area
    if (over.id === 'unassigned') {
      try {
        const { error } = await supabase
          .from('termine')
          .update({ 
            mitarbeiter_id: null,
            status: 'unassigned'
          })
          .eq('id', appointmentId);

        if (error) throw error;

        toast({
          title: 'Erfolg',
          description: 'Termin wurde zu offenen Schichten verschoben.',
        });
        
        loadData(); // Refresh data
      } catch (error) {
        console.error('Error updating appointment:', error);
        toast({
          title: 'Fehler',
          description: 'Termin konnte nicht verschoben werden.',
          variant: 'destructive',
        });
      }
    }

    setActiveId(null);
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(direction === 'prev' ? subWeeks(currentWeek, 1) : addWeeks(currentWeek, 1));
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
                <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-xl font-semibold">
                  {format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'dd. MMMM', { locale: de })} - {format(addDays(startOfWeek(currentWeek, { weekStartsOn: 1 }), 6), 'dd. MMMM yyyy', { locale: de })}
                </h2>
                <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
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
                    {appointments.filter(app => app.status === 'scheduled').length}
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
            {/* Employee List */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  Mitarbeiter
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
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredEmployees.map((employee) => (
                    <EmployeeCard
                      key={employee.id}
                      employee={employee}
                      currentAppointments={appointments.filter(app => app.mitarbeiter_id === employee.id).length}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Open Appointments */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Offene Termine
                </CardTitle>
                <Input
                  placeholder="Suchen..."
                  value={searchAppointment}
                  onChange={(e) => setSearchAppointment(e.target.value)}
                  className="h-8 text-sm"
                />
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <DropZone id="unassigned" className="max-h-96 overflow-y-auto">
                  <SortableContext items={filteredAppointments.map(app => app.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {filteredAppointments.map((appointment) => (
                        <DraggableAppointment
                          key={appointment.id}
                          appointment={appointment}
                          isAssigned={false}
                        />
                      ))}
                    </div>
                  </SortableContext>
                  {filteredAppointments.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      <Calendar className="mx-auto h-8 w-8 opacity-50 mb-2" />
                      <p className="text-sm">Keine offenen Termine</p>
                    </div>
                  )}
                </DropZone>
              </CardContent>
            </Card>
          </div>

          {/* Schedule Grid */}
          <div className="xl:col-span-4">
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4" />
                  Wochenansicht
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    {/* Header */}
                    <div className="grid grid-cols-8 border-b">
                      <div className="p-3 bg-muted/50 font-medium text-sm border-r">
                        Mitarbeiter
                      </div>
                      {getWeekDates().map((date, index) => (
                        <div key={index} className="p-3 bg-muted/50 text-center border-r last:border-r-0">
                          <div className="font-medium text-sm">
                            {format(date, 'EEE', { locale: de })}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {format(date, 'dd.MM')}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Employee Rows */}
                    <div className="divide-y">
                      {filteredEmployees.map((employee) => (
                        <div key={employee.id} className="grid grid-cols-8">
                          {/* Employee Info */}
                          <div className="p-3 bg-muted/25 border-r">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full border border-white shadow-sm flex-shrink-0" 
                                style={{ backgroundColor: employee.farbe_kalender }}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">{employee.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {appointments.filter(app => app.mitarbeiter_id === employee.id).length}/{employee.max_termine_pro_tag || 8} Termine
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Day Columns */}
                          {getWeekDates().map((date, dayIndex) => (
                            <div key={dayIndex} className="border-r last:border-r-0">
                              <DropZone
                                id={`employee-${employee.id}-${dayIndex}`}
                                className="min-h-[120px] p-2"
                                isEmpty={getAppointmentCount(employee.id, dayIndex) === 0}
                                employeeName={employee.name}
                                date={format(date, 'dd.MM')}
                              >
                                <div className="space-y-1">
                                  {getAppointmentsForDate(employee.id, dayIndex).map((appointment) => (
                                    <DraggableAppointment
                                      key={appointment.id}
                                      appointment={appointment}
                                      isAssigned={true}
                                    />
                                  ))}
                                </div>
                              </DropZone>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {editingAppointment && (
          <Dialog open={!!editingAppointment} onOpenChange={() => setEditingAppointment(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Termin bearbeiten</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Titel</label>
                  <div className="text-sm">{editingAppointment.titel}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Status auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Geplant</SelectItem>
                      <SelectItem value="completed">Abgeschlossen</SelectItem>
                      <SelectItem value="cancelled">Abgesagt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => setEditingAppointment(null)}>
                  Speichern
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        <AppointmentApprovalDialog
          isOpen={showApprovalDialog}
          onClose={() => setShowApprovalDialog(false)}
          changes={pendingChanges}
          onApprovalAction={() => {
            loadData();
            setShowApprovalDialog(false);
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