import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addWeeks, subWeeks } from 'date-fns';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { MyChangeRequests } from '@/components/mitarbeiter/MyChangeRequests';
import { TerminBestaetigung } from '@/components/mitarbeiter/TerminBestaetigung';
import { LeistungsnachweisSignature } from '@/components/mitarbeiter/LeistungsnachweisSignature';
import { AbwesenheitAnfrage } from '@/components/mitarbeiter/AbwesenheitAnfrage';
import { AbwesenheitGenehmigung } from '@/components/mitarbeiter/AbwesenheitGenehmigung';
import { MeineDokumente } from '@/components/mitarbeiter/MeineDokumente';
import { EmployeeWeekCalendar } from '@/components/schedule/calendar/EmployeeWeekCalendar';
import { EmployeeChangeRequestDialog } from '@/components/schedule/dialogs/EmployeeChangeRequestDialog';
import { getWeekDates, getWeekNumber, formatDE } from '@/utils/date';
import type { Appointment, EmployeeSummary } from '@/types/domain';

export default function MitarbeiterDashboard() {
  const { mitarbeiterId, isGeschaeftsfuehrer } = useUserRole();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showChangeRequestDialog, setShowChangeRequestDialog] = useState(false);

  const loadData = async () => {
    if (!mitarbeiterId) return;

    try {
      const { data: empData, error: empError } = await supabase
        .from('mitarbeiter')
        .select('id, vorname, nachname, farbe_kalender')
        .eq('id', mitarbeiterId)
        .single();

      if (empError) throw empError;
      setEmployee({ ...empData, name: [empData.vorname, empData.nachname].filter(Boolean).join(' ') || 'Unbenannt' });

      const { data, error } = await supabase
        .from('termine')
        .select(`
          id, titel, start_at, end_at, status, mitarbeiter_id, kunden_id,
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

  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);

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
    console.log('Slot clicked:', date);
  };

  const isGF = isGeschaeftsfuehrer;

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <div className="mb-2 sm:mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Mein Bereich
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Ihre persönlichen Termine, Abwesenheiten und Aufgaben
        </p>
      </div>

      {/* GF: Offene Abwesenheitsanträge zur Genehmigung */}
      {isGF && <AbwesenheitGenehmigung />}

      {/* Offene Terminbestätigungen */}
      <TerminBestaetigung appointments={appointments} onUpdate={loadData} />

      {/* Leistungsnachweise zur Unterschrift */}
      <LeistungsnachweisSignature />

      {/* Week Navigation */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
              className="shrink-0"
            >
              <ChevronLeft className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Vorherige Woche</span>
            </Button>
            <div className="text-center min-w-0">
              <h2 className="text-base sm:text-lg font-semibold">
                KW {getWeekNumber(weekDates[0])}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {formatDE(weekDates[0], 'dd.MM.')} - {formatDE(weekDates[6], 'dd.MM.yyyy')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
              className="shrink-0"
            >
              <span className="hidden sm:inline">Nächste Woche</span>
              <ChevronRight className="h-4 w-4 sm:ml-1" />
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

      {/* Abwesenheiten: GF = direkt, MA = beantragen */}
      <AbwesenheitAnfrage directEntry={isGF} />

      {/* Meine Dokumente - NUR für Mitarbeiter, nicht für GF */}
      {!isGF && <MeineDokumente />}

      {/* Change Requests - nur für Mitarbeiter, nicht für GF (GF genehmigt diese) */}
      {!isGF && <MyChangeRequests />}

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
