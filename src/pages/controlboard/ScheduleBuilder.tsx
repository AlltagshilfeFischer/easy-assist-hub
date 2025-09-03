import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Users, Building2, ChevronLeft, ChevronRight, Plus, Search, Filter, ArrowUpDown, Download, Printer, Settings, Eye, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, startOfWeek, addDays, getWeek, isToday, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// Enhanced dummy data with more professional structure
const dummyEmployees = [
  { id: '1', vorname: 'Max', nachname: 'Mustermann', ist_aktiv: true, max_termine_pro_tag: 8, position: 0, qualifikation: 'Senior', farbe: '#3B82F6' },
  { id: '2', vorname: 'Anna', nachname: 'Schmidt', ist_aktiv: true, max_termine_pro_tag: 6, position: 1, qualifikation: 'Junior', farbe: '#10B981' },
  { id: '3', vorname: 'Tom', nachname: 'Weber', ist_aktiv: true, max_termine_pro_tag: 7, position: 2, qualifikation: 'Senior', farbe: '#F59E0B' },
  { id: '4', vorname: 'Lisa', nachname: 'Müller', ist_aktiv: false, max_termine_pro_tag: 5, position: 3, qualifikation: 'Junior', farbe: '#EF4444' },
];

// Enhanced appointments with status and priority
const dummyOpenAppointments = [
  { id: 'a1', titel: 'Hausbesuch Familie Müller', startzeit: '08:00', endzeit: '10:00', datum: '2025-09-03', kunde: 'Familie Müller', prioritaet: 'hoch', status: 'offen', dauer: 120 },
  { id: 'a2', titel: 'Beratung Herr Schmidt', startzeit: '14:00', endzeit: '15:30', datum: '2025-09-03', kunde: 'Herr Schmidt', prioritaet: 'mittel', status: 'offen', dauer: 90 },
  { id: 'a3', titel: 'Nachkontrolle Frau Weber', startzeit: '09:00', endzeit: '11:00', datum: '2025-09-04', kunde: 'Frau Weber', prioritaet: 'niedrig', status: 'offen', dauer: 120 },
  { id: 'a4', titel: 'Erstberatung Familie Klein', startzeit: '16:00', endzeit: '17:00', datum: '2025-09-04', kunde: 'Familie Klein', prioritaet: 'hoch', status: 'offen', dauer: 60 },
  { id: 'a5', titel: 'Therapie Herr Fischer', startzeit: '10:00', endzeit: '12:00', datum: '2025-09-05', kunde: 'Herr Fischer', prioritaet: 'mittel', status: 'offen', dauer: 120 },
  { id: 'a6', titel: 'Notfall Frau Wagner', startzeit: '13:00', endzeit: '14:00', datum: '2025-09-03', kunde: 'Frau Wagner', prioritaet: 'urgent', status: 'offen', dauer: 60 },
];

export default function ScheduleBuilder() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const [dragType, setDragType] = useState<'employee' | 'appointment' | null>(null);
  const [employees, setEmployees] = useState(dummyEmployees);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [employeeSort, setEmployeeSort] = useState<'name' | 'workload' | 'qualification'>('name');
  const [appointmentFilter, setAppointmentFilter] = useState<'all' | 'urgent' | 'high' | 'medium' | 'low'>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('detailed');
  const queryClient = useQueryClient();

  // Use dummy data for now - in production this would come from the database
  const openAppointments = dummyOpenAppointments;

  // Enhanced data processing with filters and sorting
  const filteredEmployees = useMemo(() => {
    let filtered = employees.filter(emp => 
      (showInactive || emp.ist_aktiv) &&
      (emp.vorname.toLowerCase().includes(searchTerm.toLowerCase()) ||
       emp.nachname.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    switch (employeeSort) {
      case 'workload':
        return filtered.sort((a, b) => getAppointmentCount(b.id) - getAppointmentCount(a.id));
      case 'qualification':
        return filtered.sort((a, b) => a.qualifikation.localeCompare(b.qualifikation));
      default:
        return filtered.sort((a, b) => a.position - b.position);
    }
  }, [employees, showInactive, searchTerm, employeeSort, assignments]);

  const filteredAppointments = useMemo(() => {
    return openAppointments.filter(apt => {
      if (appointmentFilter === 'all') return true;
      if (appointmentFilter === 'urgent') return apt.prioritaet === 'urgent';
      if (appointmentFilter === 'high') return apt.prioritaet === 'hoch';
      if (appointmentFilter === 'medium') return apt.prioritaet === 'mittel';
      if (appointmentFilter === 'low') return apt.prioritaet === 'niedrig';
      return true;
    });
  }, [appointmentFilter]);

  // Generate week dates starting from Monday
  const getWeekDates = () => {
    const start = startOfWeek(currentWeek, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const weekDates = getWeekDates();
  const currentWeekNumber = getWeek(currentWeek, { weekStartsOn: 1 });

  const handleDragStart = (item: any, type: 'employee' | 'appointment') => {
    setDraggedItem(item);
    setDragType(type);
  };

  const handleDrop = (employeeId: string, date: string) => {
    if (draggedItem && dragType === 'appointment') {
      // Assign open appointment to employee
      const newAssignment = {
        id: `assignment-${Date.now()}`,
        employeeId,
        appointmentId: draggedItem.id,
        date,
        appointment: draggedItem
      };
      
      setAssignments(prev => [...prev, newAssignment]);
      
      const employeeName = employees.find(e => e.id === employeeId)?.vorname;
      toast.success(`Termin "${draggedItem.titel}" wurde ${employeeName} zugewiesen`);
      
      setDraggedItem(null);
      setDragType(null);
    }
  };

  const handleEmployeeDrop = (draggedEmployeeId: string, targetEmployeeId: string) => {
    if (draggedEmployeeId === targetEmployeeId) return;
    
    const draggedEmployee = employees.find(e => e.id === draggedEmployeeId);
    const targetEmployee = employees.find(e => e.id === targetEmployeeId);
    
    if (draggedEmployee && targetEmployee) {
      const newEmployees = employees.map(emp => {
        if (emp.id === draggedEmployeeId) {
          return { ...emp, position: targetEmployee.position };
        }
        if (emp.id === targetEmployeeId) {
          return { ...emp, position: draggedEmployee.position };
        }
        return emp;
      });
      
      setEmployees(newEmployees.sort((a, b) => a.position - b.position));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(direction === 'prev' ? addDays(currentWeek, -7) : addDays(currentWeek, 7));
  };

  const getAppointmentCount = (employeeId: string) => {
    return assignments.filter(a => a.employeeId === employeeId).length;
  };

  const getAppointmentsForDate = (date: string) => {
    const assignedAppointmentIds = assignments.map(a => a.appointmentId);
    return filteredAppointments.filter(appointment => 
      appointment.datum === date && !assignedAppointmentIds.includes(appointment.id)
    );
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'hoch': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'mittel': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'niedrig': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertCircle className="h-3 w-3" />;
      case 'hoch': return <XCircle className="h-3 w-3" />;
      case 'mittel': return <Clock className="h-3 w-3" />;
      case 'niedrig': return <CheckCircle className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  const getWorkloadStatus = (employeeId: string) => {
    const count = getAppointmentCount(employeeId);
    const employee = employees.find(e => e.id === employeeId);
    const maxDaily = employee?.max_termine_pro_tag || 8;
    
    if (count >= maxDaily) return 'overbooked';
    if (count >= maxDaily * 0.8) return 'busy';
    return 'available';
  };

  const getWorkloadColor = (status: string) => {
    switch (status) {
      case 'overbooked': return 'bg-red-500';
      case 'busy': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const getAssignmentsForEmployeeAndDate = (employeeId: string, date: string) => {
    return assignments.filter(a => a.employeeId === employeeId && a.date === date);
  };

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-background to-muted/20 min-h-screen">
      {/* Enhanced Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card rounded-lg p-4 shadow-sm border">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Dienstplanmanagement
            </h1>
            <Badge variant="outline" className="text-sm">
              KW {currentWeekNumber} • {format(currentWeek, 'MMMM yyyy', { locale: de })}
            </Badge>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Week Navigation */}
          <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
            <Button variant="ghost" size="sm" onClick={() => navigateWeek('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentWeek(new Date())}>
              Heute
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigateWeek('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Drucken
            </Button>
          </div>
        </div>
      </div>

      {/* Enhanced Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Offene Termine</p>
                <p className="text-2xl font-bold text-blue-600">
                  {filteredAppointments.filter(a => !assignments.some(assign => assign.appointmentId === a.id)).length}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Zugewiesene Termine</p>
                <p className="text-2xl font-bold text-green-600">{assignments.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aktive Mitarbeiter</p>
                <p className="text-2xl font-bold text-orange-600">
                  {filteredEmployees.filter(e => e.ist_aktiv).length}
                </p>
              </div>
              <Users className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Notfall-Termine</p>
                <p className="text-2xl font-bold text-purple-600">
                  {filteredAppointments.filter(a => a.prioritaet === 'urgent').length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Schedule Layout */}
      <div className="grid grid-cols-[280px_1fr] gap-6">
        {/* Enhanced Left Sidebar */}
        <div className="space-y-4">
          {/* Summary Card */}
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                ÜBERSICHT
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Offene Termine:</span>
                  <Badge variant="secondary" className="font-semibold">
                    {filteredAppointments.filter(a => !assignments.some(assign => assign.appointmentId === a.id)).length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Zugewiesene:</span>
                  <Badge variant="default" className="font-semibold">
                    {assignments.length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Notfall:</span>
                  <Badge variant="destructive" className="font-semibold">
                    {filteredAppointments.filter(a => a.prioritaet === 'urgent').length}
                  </Badge>
                </div>
              </div>
              <div className="pt-2 border-t">
                <Button variant="outline" size="sm" className="w-full">
                  <Plus className="h-3 w-3 mr-2" />
                  Neuer Termin
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Employees Section */}
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  MITARBEITER
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInactive(!showInactive)}
                  className="text-xs"
                >
                  {showInactive ? 'Nur Aktive' : 'Alle zeigen'}
                </Button>
              </div>
              
              {/* Sorting and Filter Controls */}
              <div className="space-y-3 pt-3 border-t">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input 
                    placeholder="Mitarbeiter suchen..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 text-sm"
                  />
                </div>
                
                {/* Sort Employee */}
                <Select value={employeeSort} onValueChange={(value: any) => setEmployeeSort(value)}>
                  <SelectTrigger className="w-full">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Nach Name</SelectItem>
                    <SelectItem value="workload">Nach Auslastung</SelectItem>
                    <SelectItem value="qualification">Nach Qualifikation</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Filter Appointments */}
                <Select value={appointmentFilter} onValueChange={(value: any) => setAppointmentFilter(value)}>
                  <SelectTrigger className="w-full">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Termine</SelectItem>
                    <SelectItem value="urgent">Notfall</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                    <SelectItem value="medium">Mittel</SelectItem>
                    <SelectItem value="low">Niedrig</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* View Mode */}
                <Button
                  variant={viewMode === 'detailed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode(viewMode === 'detailed' ? 'compact' : 'detailed')}
                  className="w-full"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {viewMode === 'detailed' ? 'Detailliert' : 'Kompakt'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {filteredEmployees.map((employee) => {
                const appointmentCount = getAppointmentCount(employee.id);
                const workloadStatus = getWorkloadStatus(employee.id);
                return (
                  <div 
                    key={employee.id} 
                    className={`p-3 rounded-lg border cursor-move transition-all duration-200 ${
                      employee.ist_aktiv 
                        ? 'hover:shadow-md hover:scale-105 bg-card' 
                        : 'opacity-60 bg-muted/50'
                    }`}
                    draggable={employee.ist_aktiv}
                    onDragStart={() => handleDragStart(employee, 'employee')}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedItem && dragType === 'employee' && draggedItem.id !== employee.id) {
                        handleEmployeeDrop(draggedItem.id, employee.id);
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: employee.farbe }}
                        />
                        <div>
                          <div className="font-medium text-sm">
                            {employee.vorname} {employee.nachname}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {employee.qualifikation}
                          </div>
                        </div>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${getWorkloadColor(workloadStatus)}`} />
                    </div>
                    
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{appointmentCount}/{employee.max_termine_pro_tag} Termine</span>
                      {!employee.ist_aktiv && <Badge variant="outline" className="text-xs">Inaktiv</Badge>}
                    </div>
                    
                    {viewMode === 'detailed' && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-300 ${getWorkloadColor(workloadStatus)}`}
                            style={{ 
                              width: `${Math.min((appointmentCount / employee.max_termine_pro_tag) * 100, 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Calendar Grid */}
        <Card className="shadow-lg">
          <CardContent className="p-0">
            {/* Enhanced Week Header with Open Appointments */}
            <div className="grid grid-cols-8 border-b bg-muted/30">
              <div className="p-4 text-sm font-medium text-muted-foreground border-r flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                KW {currentWeekNumber}
              </div>
              {weekDates.map((date, index) => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const dayAppointments = getAppointmentsForDate(dateStr);
                const isCurrentDay = isToday(date);
                return (
                  <div key={index} className={`p-3 border-r last:border-r-0 ${isCurrentDay ? 'bg-primary/10' : ''}`}>
                    <div className="text-center mb-3">
                      <div className="text-xs text-muted-foreground font-medium">
                        {WEEKDAYS[index]}
                      </div>
                      <div className={`text-lg font-bold ${isCurrentDay ? 'text-primary' : ''}`}>
                        {format(date, 'd')}
                      </div>
                      {isCurrentDay && <div className="w-2 h-2 bg-primary rounded-full mx-auto mt-1" />}
                    </div>
                    
                    {/* Enhanced Open appointments for this day */}
                    <div className="space-y-2 min-h-[100px]">
                      {dayAppointments.map((appointment) => (
                        <div
                          key={appointment.id}
                          draggable
                          onDragStart={() => handleDragStart(appointment, 'appointment')}
                          className={`p-2 rounded-lg text-xs cursor-move transition-all duration-200 hover:shadow-md hover:scale-105 border ${
                            getPriorityColor(appointment.prioritaet)
                          }`}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            {getPriorityIcon(appointment.prioritaet)}
                            <div className="font-semibold text-xs truncate">{appointment.titel}</div>
                          </div>
                          <div className="text-xs opacity-75 flex items-center gap-1 mb-1">
                            <Clock className="h-3 w-3" />
                            {appointment.startzeit}-{appointment.endzeit}
                            <span className="text-xs">({appointment.dauer}min)</span>
                          </div>
                          <div className="text-xs font-medium truncate">{appointment.kunde}</div>
                          {viewMode === 'detailed' && (
                            <Badge 
                              variant="outline" 
                              className="text-xs mt-1"
                            >
                              {appointment.prioritaet}
                            </Badge>
                          )}
                        </div>
                      ))}
                      {dayAppointments.length === 0 && (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground border-2 border-dashed border-muted rounded-lg p-4">
                          Keine offenen Termine
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Enhanced Employee Rows */}
            {filteredEmployees.map((employee) => (
              <div key={employee.id} className="grid grid-cols-8 border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                <div 
                  className={`p-4 border-r transition-all duration-200 ${
                    employee.ist_aktiv 
                      ? 'bg-card cursor-move hover:bg-muted/50' 
                      : 'bg-muted/30 opacity-60'
                  }`}
                  draggable={employee.ist_aktiv}
                  onDragStart={() => handleDragStart(employee, 'employee')}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedItem && dragType === 'employee' && draggedItem.id !== employee.id) {
                      handleEmployeeDrop(draggedItem.id, employee.id);
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: employee.farbe }}
                    />
                    <div>
                      <div className="font-semibold text-sm">
                        {employee.vorname}
                      </div>
                      <div className="font-semibold text-sm">
                        {employee.nachname}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground flex items-center justify-between">
                      <span>{getAppointmentCount(employee.id)} Termine</span>
                      <div className={`w-2 h-2 rounded-full ${getWorkloadColor(getWorkloadStatus(employee.id))}`} />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {employee.qualifikation}
                    </Badge>
                    {!employee.ist_aktiv && (
                      <Badge variant="secondary" className="text-xs">
                        Inaktiv
                      </Badge>
                    )}
                  </div>
                </div>
                
                {weekDates.map((date, dayIndex) => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const isCurrentDay = isToday(date);
                  const employeeAssignments = getAssignmentsForEmployeeAndDate(employee.id, dateStr);
                  
                  return (
                    <div
                      key={dayIndex}
                      className={`min-h-[120px] p-3 border-r last:border-r-0 transition-all duration-200 ${
                        isCurrentDay ? 'bg-primary/5' : 'hover:bg-muted/10'
                      } ${
                        employee.ist_aktiv ? 'cursor-pointer' : 'opacity-60'
                      }`}
                      onDrop={() => employee.ist_aktiv && handleDrop(employee.id, dateStr)}
                      onDragOver={handleDragOver}
                    >
                      {/* Display assigned appointments */}
                      {employeeAssignments.map((assignment) => (
                        <div 
                          key={assignment.id} 
                          className="mb-2 p-2 bg-green-50 border border-green-200 text-green-800 rounded-lg text-xs shadow-sm"
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <CheckCircle className="h-3 w-3" />
                            <div className="font-semibold truncate">{assignment.appointment.titel}</div>
                          </div>
                          <div className="text-xs opacity-75 flex items-center gap-1 mb-1">
                            <Clock className="h-3 w-3" />
                            {assignment.appointment.startzeit} - {assignment.appointment.endzeit}
                          </div>
                          <div className="text-xs font-medium truncate">{assignment.appointment.kunde}</div>
                          {viewMode === 'detailed' && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {assignment.appointment.prioritaet}
                            </Badge>
                          )}
                        </div>
                      ))}
                      
                      {employeeAssignments.length === 0 && employee.ist_aktiv && (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground border-2 border-dashed border-muted rounded-lg">
                          <div className="text-center">
                            <Plus className="h-4 w-4 mx-auto mb-1 opacity-50" />
                            <div>Termin zuweisen</div>
                          </div>
                        </div>
                      )}
                      
                      {!employee.ist_aktiv && (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                          Nicht verfügbar
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Instructions */}
      <Alert className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Professionelle Dienstplan-Funktionen:</strong>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-sm">
            <ul className="list-disc list-inside space-y-1">
              <li>Drag & Drop: Termine aus Tagesübersicht auf Mitarbeiter ziehen</li>
              <li>Sortierung: Mitarbeiter nach Name, Auslastung oder Qualifikation</li>
              <li>Filter: Termine nach Priorität (Notfall, Hoch, Mittel, Niedrig)</li>
              <li>Suche: Mitarbeiter schnell finden</li>
            </ul>
            <ul className="list-disc list-inside space-y-1">
              <li>Auslastungsanzeige: Farbcodierte Workload-Indikatoren</li>
              <li>Prioritäten: Visuelle Kennzeichnung nach Dringlichkeit</li>
              <li>Ansichtsmodi: Kompakt oder detailliert umschaltbar</li>
              <li>Export/Druck: Dienstpläne für die Weitergabe</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}