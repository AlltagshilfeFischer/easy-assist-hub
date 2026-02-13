import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { MyChangeRequests } from '@/components/mitarbeiter/MyChangeRequests';
import { TerminBestaetigung } from '@/components/mitarbeiter/TerminBestaetigung';
import { EmployeeWeekCalendar } from '@/components/schedule/EmployeeWeekCalendar';
import { EmployeeChangeRequestDialog } from '@/components/schedule/EmployeeChangeRequestDialog';

interface Appointment {
  id: string;
  titel: string;
  start_at: string;
  end_at: string;
  status: string;
  mitarbeiter_id: string | null;
  kunden_id: string;
  customer?: {
    id: string;
    name: string;
    farbe_kalender?: string;
  };
}

interface Employee {
  id: string;
  vorname: string;
  nachname: string;
  farbe_kalender: string;
}

export default function MitarbeiterDashboard() {
  const { mitarbeiterId } = useUserRole();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showChangeRequestDialog, setShowChangeRequestDialog] = useState(false);

  const loadData = async () => {
    if (!mitarbeiterId) return;

    try {
      // Load employee data
      const { data: empData, error: empError } = await supabase
        .from('mitarbeiter')
        .select('id, vorname, nachname, farbe_kalender')
        .eq('id', mitarbeiterId)
        .single();

      if (empError) throw empError;
      setEmployee(empData);

      // Load appointments
      const { data, error } = await supabase
        .from('termine')
        .select(`
          id,
          titel,
          start_at,
          end_at,
          status,
          mitarbeiter_id,
          kunden_id,
          customer:kunden(id, name, farbe_kalender)
        `)
        .eq('mitarbeiter_id', mitarbeiterId)
        .order('start_at', { ascending: true });

      if (error) throw error;
      
      setAppointments((data as any) || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [mitarbeiterId]);

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

  const weekDates = useMemo(() => getWeekDates(), [currentWeek]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const handleEditAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowChangeRequestDialog(true);
  };

  const handleSlotClick = (date: Date) => {
    // Optional: Handle slot click for creating new appointments
    console.log('Slot clicked:', date);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Mein Kalender</h1>
        <p className="text-muted-foreground mt-1">
          Ihre Termine im Überblick
        </p>
      </div>

      {/* Offene Terminbestätigungen */}
      <TerminBestaetigung appointments={appointments} onUpdate={loadData} />

      {/* Week Navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Vorherige Woche
            </Button>
            
            <div className="text-center">
              <h2 className="text-lg font-semibold">
                KW {format(weekDates[0], 'w', { locale: de })}
              </h2>
              <p className="text-sm text-muted-foreground">
                {format(weekDates[0], 'dd.MM.', { locale: de })} - {format(weekDates[6], 'dd.MM.yyyy', { locale: de })}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            >
              Nächste Woche
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardContent className="p-0">
          {employee && (
            <EmployeeWeekCalendar
              appointments={appointments}
              weekDates={weekDates}
              onEditAppointment={handleEditAppointment}
              onSlotClick={handleSlotClick}
              employeeName={`${employee.vorname} ${employee.nachname}`}
              employeeColor={employee.farbe_kalender}
            />
          )}
        </CardContent>
      </Card>

      {/* Change Requests */}
      <MyChangeRequests />

      {/* Change Request Dialog */}
      {mitarbeiterId && (
        <EmployeeChangeRequestDialog
          isOpen={showChangeRequestDialog}
          onClose={() => {
            setShowChangeRequestDialog(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          mitarbeiterId={mitarbeiterId}
        />
      )}
    </div>
  );
}
