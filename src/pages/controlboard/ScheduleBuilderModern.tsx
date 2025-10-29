import { useState, useMemo, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ModernWeekCalendar } from '@/components/schedule/ModernWeekCalendar';
import { WeekNavigationBar } from '@/components/schedule/WeekNavigationBar';
import { CalendarLegend } from '@/components/schedule/CalendarLegend';
import { EmployeeFilterSidebar } from '@/components/schedule/EmployeeFilterSidebar';
import { CalendarStats } from '@/components/schedule/CalendarStats';
import { UnassignedAppointmentsBar } from '@/components/schedule/UnassignedAppointmentsBar';
import { AppointmentDetailDialog } from '@/components/schedule/AppointmentDetailDialog';
import { CreateAppointmentDialog } from '@/components/schedule/CreateAppointmentDialog';
import { CreateRecurringAppointmentDialog } from '@/components/schedule/CreateRecurringAppointmentDialog';
import { CreateAppointmentFromSlotDialog } from '@/components/schedule/CreateAppointmentFromSlotDialog';
import { ConflictWarningDialog } from '@/components/schedule/ConflictWarningDialog';
import { DraggableAppointment } from '@/components/schedule/DraggableAppointment';
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

const ScheduleBuilderModern = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiddenEmployeeIds, setHiddenEmployeeIds] = useState<Set<string>>(new Set());
  const [searchEmployee, setSearchEmployee] = useState('');
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [showCreateAppointment, setShowCreateAppointment] = useState(false);
  const [showCreateRecurring, setShowCreateRecurring] = useState(false);
  const [showSlotDialog, setShowSlotDialog] = useState(false);
  const [slotDialogData, setSlotDialogData] = useState<{ employeeId: string; date: Date } | null>(null);
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
  
  const { toast } = useToast();

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
        } as Customer : undefined
      })) || [];

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
    return employees.filter(emp => 
      emp.ist_aktiv && 
      !hiddenEmployeeIds.has(emp.id) && 
      emp.name.toLowerCase().includes(searchEmployee.toLowerCase())
    );
  }, [employees, searchEmployee, hiddenEmployeeIds]);

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

  const assignAppointment = async (appointmentId: string, employeeId: string) => {
    try {
      setAppointments(prev => prev.map(app =>
        app.id === appointmentId ? { ...app, mitarbeiter_id: employeeId } : app
      ));

      const { error } = await supabase
        .from('termine')
        .update({ mitarbeiter_id: employeeId, status: 'scheduled' })
        .eq('id', appointmentId);

      if (error) throw error;

      const appointment = appointments.find(app => app.id === appointmentId);
      const employee = employees.find(emp => emp.id === employeeId);

      toast({
        title: 'Erfolg',
        description: `${appointment?.customer?.name} → ${employee?.name}`
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

    if (overId === 'unassigned-drop-zone') {
      // Unassign appointment
      try {
        const { error } = await supabase
          .from('termine')
          .update({ mitarbeiter_id: null, status: 'unassigned' })
          .eq('id', appointmentId);

        if (error) throw error;

        toast({
          title: 'Erfolg',
          description: 'Termin wurde nicht zugewiesen.'
        });

        await loadData();
      } catch (error) {
        toast({
          title: 'Fehler',
          description: 'Fehler beim Nicht-Zuweisen des Termins.',
          variant: 'destructive'
        });
      }
      return;
    }

    // Extract employee ID and date from drop zone ID (format: "employeeId-date")
    const [employeeId] = overId.split('-');

    if (!employeeId) return;

    const conflicts = checkForConflicts(appointmentId, employeeId);

    if (conflicts.length > 0) {
      setConflictWarning({
        show: true,
        appointmentId,
        employeeId,
        conflicts
      });
    } else {
      await assignAppointment(appointmentId, employeeId);
    }
  };

  const handleConflictConfirm = async () => {
    await assignAppointment(conflictWarning.appointmentId, conflictWarning.employeeId);
    setConflictWarning({
      show: false,
      appointmentId: '',
      employeeId: '',
      conflicts: []
    });
  };

  const handleSlotClick = (employeeId: string, date: Date) => {
    setSlotDialogData({ employeeId, date });
    setShowSlotDialog(true);
  };

  const handleCreateAppointment = async (data: any) => {
    try {
      const { error } = await supabase
        .from('termine')
        .insert([{
          titel: data.titel,
          kunden_id: data.kunden_id,
          mitarbeiter_id: data.mitarbeiter_id,
          start_at: data.start_at,
          end_at: data.end_at,
          status: data.mitarbeiter_id ? 'scheduled' : 'unassigned'
        }]);

      if (error) throw error;

      toast({
        title: 'Erfolg',
        description: 'Termin wurde erstellt.'
      });

      await loadData();
      setShowCreateAppointment(false);
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Fehler beim Erstellen des Termins.',
        variant: 'destructive'
      });
    }
  };

  const handleCreateRecurringAppointment = async (data: any) => {
    // Implementation for recurring appointments
    await handleCreateAppointment(data);
    setShowCreateRecurring(false);
  };

  const handleSlotSingleAppointment = async (data: any) => {
    await handleCreateAppointment(data);
    setShowSlotDialog(false);
  };

  const handleSlotRecurringAppointment = async (data: any) => {
    await handleCreateRecurringAppointment(data);
    setShowSlotDialog(false);
  };

  const draggedAppointment = appointments.find(app => app.id === activeId);

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
      <div className="h-full flex flex-col gap-4 p-6 bg-gradient-to-br from-background to-muted/20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dienstplan & Terminverwaltung</h1>
            <p className="text-muted-foreground">
              Professionelle Wochenansicht mit Drag & Drop
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowCreateAppointment(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Neuer Termin
            </Button>
            <Button variant="outline" onClick={() => setShowCreateRecurring(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Serientermin
            </Button>
          </div>
        </div>

        {/* Stats */}
        <CalendarStats {...stats} />

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <WeekNavigationBar
            currentWeek={currentWeek}
            onPreviousWeek={() => setCurrentWeek(prev => subWeeks(prev, 1))}
            onNextWeek={() => setCurrentWeek(prev => addWeeks(prev, 1))}
            onToday={() => setCurrentWeek(new Date())}
          />
          <CalendarLegend />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Sidebar */}
          <div className="w-80 flex-shrink-0">
            <EmployeeFilterSidebar
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
              searchQuery={searchEmployee}
              onSearchChange={setSearchEmployee}
            />
          </div>

          {/* Calendar */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* Unassigned Bar */}
            <UnassignedAppointmentsBar
              appointments={appointments}
              weekDates={getWeekDates()}
              activeId={activeId}
              onEditAppointment={setEditingAppointment}
            />

            {/* Calendar Grid */}
            <Card className="flex-1 shadow-lg overflow-hidden">
              <CardContent className="p-0 h-full">
                <ModernWeekCalendar
                  employees={filteredEmployees}
                  appointments={appointments}
                  weekDates={getWeekDates()}
                  activeAppointmentId={activeId}
                  onEditAppointment={setEditingAppointment}
                  onSlotClick={handleSlotClick}
                  conflictingAppointments={conflictingAppointments}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Dialogs */}
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
                description: 'Termin wurde aktualisiert.'
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
        />

        <ConflictWarningDialog
          isOpen={conflictWarning.show}
          onClose={() => setConflictWarning({
            show: false,
            appointmentId: '',
            employeeId: '',
            conflicts: []
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
