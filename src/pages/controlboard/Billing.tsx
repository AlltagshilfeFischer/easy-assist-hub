import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Kunde {
  id: string;
  name: string;
  pflegegrad: number | null;
  stunden_kontingent_monat: number;
}

interface Appointment {
  id: string;
  titel: string;
  start_at: string;
  end_at: string;
  iststunden: number;
  kunden_id: string;
}

export default function Billing() {
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKunde, setSelectedKunde] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: kundenData, error: kundenError } = await supabase
        .from('kunden')
        .select('id, name, pflegegrad, stunden_kontingent_monat')
        .eq('aktiv', true)
        .order('name');

      if (kundenError) throw kundenError;

      const { data: termineData, error: termineError } = await supabase
        .from('termine')
        .select('id, titel, start_at, end_at, iststunden, kunden_id')
        .in('status', ['completed', 'scheduled']);

      if (termineError) throw termineError;

      setKunden(kundenData || []);
      setAppointments(termineData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Fehler',
        description: 'Daten konnten nicht geladen werden',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function updateIststunden(terminId: string, newValue: number) {
    try {
      const { error } = await supabase
        .from('termine')
        .update({ iststunden: newValue })
        .eq('id', terminId);

      if (error) throw error;

      setAppointments(prev =>
        prev.map(apt => apt.id === terminId ? { ...apt, iststunden: newValue } : apt)
      );

      toast({
        title: 'Erfolg',
        description: 'Stunden wurden aktualisiert',
      });
    } catch (error) {
      console.error('Error updating hours:', error);
      toast({
        title: 'Fehler',
        description: 'Stunden konnten nicht aktualisiert werden',
        variant: 'destructive',
      });
    }
  }

  function getKundenAppointments(kundenId: string) {
    return appointments.filter(apt => apt.kunden_id === kundenId);
  }

  function calculateTotalHours(kundenId: string) {
    return getKundenAppointments(kundenId).reduce((sum, apt) => sum + (apt.iststunden || 0), 0);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Leistungen & Abrechnungen</h1>
        <p className="text-muted-foreground">
          Verwalten Sie Stunden und ordnen Sie diese den Leistungstöpfen zu
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="details">Detailansicht</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Kunden Übersicht</CardTitle>
              <CardDescription>
                Stunden und tatsächlich geleistete Stunden pro Kunde
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Pflegegrad</TableHead>
                    <TableHead className="text-right">Kontingent/Monat</TableHead>
                    <TableHead className="text-right">Geleistete Stunden</TableHead>
                    <TableHead className="text-right">Differenz</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kunden.map((kunde) => {
                    const totalHours = calculateTotalHours(kunde.id);
                    const diff = kunde.stunden_kontingent_monat - totalHours;
                    return (
                      <TableRow key={kunde.id}>
                        <TableCell className="font-medium">{kunde.name}</TableCell>
                        <TableCell>{kunde.pflegegrad || '-'}</TableCell>
                        <TableCell className="text-right">
                          {kunde.stunden_kontingent_monat}h
                        </TableCell>
                        <TableCell className="text-right">{totalHours.toFixed(2)}h</TableCell>
                        <TableCell className={`text-right ${diff < 0 ? 'text-destructive' : 'text-success'}`}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(2)}h
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedKunde(kunde.id)}
                          >
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detaillierte Stundenerfassung</CardTitle>
              <CardDescription>
                Bearbeiten Sie die tatsächlichen Stunden für jeden Termin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {kunden.map((kunde) => {
                  const kundenAppointments = getKundenAppointments(kunde.id);
                  if (kundenAppointments.length === 0) return null;

                  return (
                    <div key={kunde.id} className="space-y-3">
                      <h3 className="text-lg font-semibold border-b pb-2">
                        {kunde.name} - {calculateTotalHours(kunde.id).toFixed(2)}h von {kunde.stunden_kontingent_monat}h
                      </h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Termin</TableHead>
                            <TableHead>Datum</TableHead>
                            <TableHead>Geplante Zeit</TableHead>
                            <TableHead className="text-right">Ist-Stunden</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {kundenAppointments.map((apt) => {
                            const startDate = new Date(apt.start_at);
                            const endDate = new Date(apt.end_at);
                            const plannedHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

                            return (
                              <TableRow key={apt.id}>
                                <TableCell>{apt.titel}</TableCell>
                                <TableCell>
                                  {startDate.toLocaleDateString('de-DE')}
                                </TableCell>
                                <TableCell>
                                  {startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - {endDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                  {' '}({plannedHours.toFixed(2)}h)
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center gap-2 justify-end">
                                    <Input
                                      type="number"
                                      step="0.25"
                                      min="0"
                                      className="w-24"
                                      value={apt.iststunden || 0}
                                      onChange={(e) => {
                                        const value = parseFloat(e.target.value) || 0;
                                        updateIststunden(apt.id, value);
                                      }}
                                    />
                                    <span className="text-muted-foreground">h</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
