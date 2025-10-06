import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Appointment {
  id: string;
  titel: string;
  start_at: string;
  end_at: string;
  status: string;
  customer?: {
    vorname: string;
    nachname: string;
  };
}

export default function MitarbeiterDashboard() {
  const { mitarbeiterId } = useUserRole();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAppointments() {
      if (!mitarbeiterId) return;

      try {
        const { data, error } = await supabase
          .from('termine')
          .select(`
            id,
            titel,
            start_at,
            end_at,
            status,
            customer:kunden(vorname, nachname)
          `)
          .eq('mitarbeiter_id', mitarbeiterId)
          .gte('start_at', new Date().toISOString())
          .order('start_at', { ascending: true })
          .limit(20);

        if (error) throw error;
        setAppointments(data || []);
      } catch (error) {
        console.error('Error loading appointments:', error);
      } finally {
        setLoading(false);
      }
    }

    loadAppointments();
  }, [mitarbeiterId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'scheduled':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'in_progress':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'completed':
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'Bestätigt';
      case 'scheduled':
        return 'Geplant';
      case 'in_progress':
        return 'In Bearbeitung';
      case 'completed':
        return 'Abgeschlossen';
      case 'cancelled':
        return 'Abgesagt';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const today = appointments.filter(
    (apt) => format(new Date(apt.start_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  );

  const upcoming = appointments.filter(
    (apt) => format(new Date(apt.start_at), 'yyyy-MM-dd') > format(new Date(), 'yyyy-MM-dd')
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meine Termine</h1>
        <p className="text-muted-foreground mt-2">
          Übersicht über Ihre anstehenden Termine
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Heute</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{today.length}</div>
            <p className="text-xs text-muted-foreground">
              Termine für heute
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anstehend</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcoming.length}</div>
            <p className="text-xs text-muted-foreground">
              Kommende Termine
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamt</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{appointments.length}</div>
            <p className="text-xs text-muted-foreground">
              Alle anstehenden Termine
            </p>
          </CardContent>
        </Card>
      </div>

      {today.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Termine heute
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {today.map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <h3 className="font-medium">{appointment.titel}</h3>
                  <p className="text-sm text-muted-foreground">
                    {(appointment.customer as any)?.vorname} {(appointment.customer as any)?.nachname}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(appointment.start_at), 'HH:mm', { locale: de })} -{' '}
                    {format(new Date(appointment.end_at), 'HH:mm', { locale: de })}
                  </div>
                </div>
                <Badge className={getStatusColor(appointment.status)}>
                  {getStatusLabel(appointment.status)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Kommende Termine
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <h3 className="font-medium">{appointment.titel}</h3>
                  <p className="text-sm text-muted-foreground">
                    {(appointment.customer as any)?.vorname} {(appointment.customer as any)?.nachname}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 mr-1" />
                    {format(new Date(appointment.start_at), 'dd.MM.yyyy', { locale: de })}
                    <Clock className="h-3 w-3 ml-2" />
                    {format(new Date(appointment.start_at), 'HH:mm', { locale: de })} -{' '}
                    {format(new Date(appointment.end_at), 'HH:mm', { locale: de })}
                  </div>
                </div>
                <Badge className={getStatusColor(appointment.status)}>
                  {getStatusLabel(appointment.status)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {appointments.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Keine Termine</h3>
            <p className="text-sm text-muted-foreground text-center">
              Sie haben derzeit keine anstehenden Termine.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
