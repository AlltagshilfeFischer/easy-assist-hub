import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Users, Building2, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, startOfWeek, addDays, getWeek } from 'date-fns';
import { de } from 'date-fns/locale';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// Dummy data for demonstration
const dummyEmployees = [
  { id: '1', vorname: 'Max', nachname: 'Mustermann', ist_aktiv: true, max_termine_pro_tag: 8 },
  { id: '2', vorname: 'Anna', nachname: 'Schmidt', ist_aktiv: true, max_termine_pro_tag: 6 },
  { id: '3', vorname: 'Tom', nachname: 'Weber', ist_aktiv: true, max_termine_pro_tag: 7 },
];

const dummyOpenShifts = [
  { id: 'o1', titel: 'Frühdienst', startzeit: '06:00', endzeit: '14:00', datum: '2025-09-03' },
  { id: 'o2', titel: 'Spätdienst', startzeit: '14:00', endzeit: '22:00', datum: '2025-09-03' },
  { id: 'o3', titel: 'Nachtdienst', startzeit: '22:00', endzeit: '06:00', datum: '2025-09-04' },
];

export default function ScheduleBuilder() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const [dragType, setDragType] = useState<'employee' | 'shift' | null>(null);
  const queryClient = useQueryClient();

  // Use dummy data for now - in production this would come from the database
  const employees = dummyEmployees;
  const openShifts = dummyOpenShifts;
  const assignments: any[] = []; // Employee shift assignments

  // Generate week dates starting from Monday
  const getWeekDates = () => {
    const start = startOfWeek(currentWeek, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const weekDates = getWeekDates();
  const currentWeekNumber = getWeek(currentWeek, { weekStartsOn: 1 });

  const handleDragStart = (item: any, type: 'employee' | 'shift') => {
    setDraggedItem(item);
    setDragType(type);
  };

  const handleDrop = (employeeId: string, date: string) => {
    if (draggedItem && dragType === 'shift') {
      // Assign open shift to employee
      toast.success(`Schicht "${draggedItem.titel}" wurde ${employees.find(e => e.id === employeeId)?.vorname} zugewiesen`);
      setDraggedItem(null);
      setDragType(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(direction === 'prev' ? addDays(currentWeek, -7) : addDays(currentWeek, 7));
  };

  const getShiftCount = (employeeId: string) => {
    return assignments.filter(a => a.employeeId === employeeId).length;
  };

  const getShiftsForDate = (date: string) => {
    return openShifts.filter(shift => shift.datum === date);
  };

  const getAssignmentsForEmployeeAndDate = (employeeId: string, date: string) => {
    return assignments.filter(a => a.employeeId === employeeId && a.date === date);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">2025</h1>
          <h2 className="text-xl text-muted-foreground">September</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Schedule Layout */}
      <div className="grid grid-cols-[200px_1fr] gap-4">
        {/* Left Sidebar with Employees */}
        <div className="space-y-4">
          {/* Open Shifts Section */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white bg-orange-500 px-2 py-1 rounded">
                OFFENE SCHICHTEN
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-2">
              {openShifts.map((shift) => (
                <div
                  key={shift.id}
                  draggable
                  onDragStart={() => handleDragStart(shift, 'shift')}
                  className="p-2 bg-blue-100 text-blue-800 rounded text-sm cursor-move hover:bg-blue-200 transition-colors"
                >
                  <div className="font-medium">{shift.titel}</div>
                  <div className="text-xs">{shift.startzeit} - {shift.endzeit}</div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="h-3 w-3 mr-1" />
                Neue Schicht
              </Button>
            </CardContent>
          </Card>

          {/* Employees Section */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white bg-orange-500 px-2 py-1 rounded">
                MITARBEITER
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-2">
              {employees.map((employee) => {
                const shiftCount = getShiftCount(employee.id);
                return (
                  <div key={employee.id} className="space-y-1">
                    <div className="font-medium text-sm">
                      {employee.vorname} {employee.nachname}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {shiftCount} Schichten
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Calendar Grid */}
        <Card>
          <CardContent className="p-0">
            {/* Week Header */}
            <div className="grid grid-cols-8 border-b">
              <div className="p-2 text-xs text-muted-foreground border-r">
                KW {currentWeekNumber}
              </div>
              {weekDates.map((date, index) => (
                <div key={index} className="p-2 text-center border-r last:border-r-0">
                  <div className="text-xs text-muted-foreground">
                    {WEEKDAYS[index]}
                  </div>
                  <div className="text-sm font-medium">
                    {format(date, 'd')}
                  </div>
                </div>
              ))}
            </div>

            {/* Employee Rows */}
            {employees.map((employee) => (
              <div key={employee.id} className="grid grid-cols-8 border-b last:border-b-0">
                <div className="p-3 border-r bg-muted/30">
                  <div className="font-medium text-sm">
                    {employee.vorname}
                  </div>
                  <div className="font-medium text-sm">
                    {employee.nachname}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getShiftCount(employee.id)} Schichten
                  </div>
                </div>
                {weekDates.map((date, dayIndex) => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  return (
                    <div
                      key={dayIndex}
                      className="min-h-[80px] p-2 border-r last:border-r-0 hover:bg-muted/20 transition-colors"
                      onDrop={() => handleDrop(employee.id, dateStr)}
                      onDragOver={handleDragOver}
                    >
                      {/* Shift assignments would be displayed here */}
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                        Drop hier
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Alert>
        <AlertDescription>
          <strong>Dienstplan-Funktionen:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>Ziehen Sie offene Schichten auf Mitarbeiter-Zeitslots</li>
            <li>Links werden offene Schichten und Mitarbeiter angezeigt</li>
            <li>Oben sind die Wochentage zu sehen</li>
            <li>Dummy-Daten werden für die Demonstration verwendet</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}