import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format, isToday, isFuture, isPast } from 'date-fns';
import { de } from 'date-fns/locale';

export default function DashboardHome() {
  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('termine')
        .select(`
          *,
          mitarbeiter:mitarbeiter_id(*),
          kunden:kunden_id(*)
        `)
        .order('start_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // Kategorisierung der Termine
  const todayAppointments = appointments?.filter((apt: any) => 
    isToday(new Date(apt.start_at))
  ) || [];
  
  const upcomingAppointments = appointments?.filter((apt: any) => 
    isFuture(new Date(apt.start_at)) && !isToday(new Date(apt.start_at))
  ) || [];
  
  const pastAppointments = appointments?.filter((apt: any) => 
    isPast(new Date(apt.start_at)) && !isToday(new Date(apt.start_at))
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Übersicht über alle Termine
        </p>
      </div>

      {/* Termine Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Termine
          </CardTitle>
          <CardDescription>
            Aktuelle und geplante Termine
          </CardDescription>
        </CardHeader>
        <CardContent>
          {appointmentsLoading ? (
            <div className="text-center py-4">Lade Termine...</div>
          ) : (
            <Accordion type="multiple" defaultValue={["today"]} className="w-full">
              {/* Heutige Termine */}
              <AccordionItem value="today">
                <AccordionTrigger className="text-left">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Heute ({todayAppointments.length})
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {todayAppointments.length > 0 ? (
                    <div className="space-y-3">
                      {todayAppointments.map((appointment: any) => (
                        <div key={appointment.id} className="p-3 bg-accent/30 rounded-lg border-l-4 border-primary">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{appointment.titel}</div>
                              <div className="text-sm text-muted-foreground">
                                 {appointment.kunden?.name}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                 Mitarbeiter: {appointment.mitarbeiter?.vorname} {appointment.mitarbeiter?.nachname}
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <div>{format(new Date(appointment.start_at), 'HH:mm', { locale: de })} - {format(new Date(appointment.end_at), 'HH:mm', { locale: de })}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(appointment.start_at), 'dd.MM.yyyy', { locale: de })}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      Keine Termine für heute
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Kommende Termine */}
              <AccordionItem value="upcoming">
                <AccordionTrigger className="text-left">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Kommende Termine ({upcomingAppointments.length})
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {upcomingAppointments.length > 0 ? (
                    <div className="space-y-3">
                      {upcomingAppointments.map((appointment: any) => (
                        <div key={appointment.id} className="p-3 bg-accent/10 rounded-lg border">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{appointment.titel}</div>
                              <div className="text-sm text-muted-foreground">
                                 {appointment.kunden?.name}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                 Mitarbeiter: {appointment.mitarbeiter?.vorname} {appointment.mitarbeiter?.nachname}
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <div>{format(new Date(appointment.start_at), 'HH:mm', { locale: de })} - {format(new Date(appointment.end_at), 'HH:mm', { locale: de })}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(appointment.start_at), 'dd.MM.yyyy', { locale: de })}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      Keine kommenden Termine
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Vergangene Termine */}
              <AccordionItem value="past">
                <AccordionTrigger className="text-left">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Vergangene Termine ({pastAppointments.length})
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {pastAppointments.length > 0 ? (
                    <div className="space-y-3">
                      {pastAppointments.map((appointment: any) => (
                        <div key={appointment.id} className="p-3 bg-muted/30 rounded-lg border opacity-75">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{appointment.titel}</div>
                              <div className="text-sm text-muted-foreground">
                                {appointment.kunden?.vorname} {appointment.kunden?.nachname}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Mitarbeiter: {appointment.mitarbeiter?.vorname} {appointment.mitarbeiter?.nachname}
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <div>{format(new Date(appointment.start_at), 'HH:mm', { locale: de })} - {format(new Date(appointment.end_at), 'HH:mm', { locale: de })}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(appointment.start_at), 'dd.MM.yyyy', { locale: de })}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      Keine vergangenen Termine
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}