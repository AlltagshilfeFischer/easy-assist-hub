import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast as sonnerToast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Calculator, FileText, AlertCircle, CheckCircle2, 
  Euro, Send, Download, AlertTriangle, Loader2, Eye, Play, Building
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';

type RechnungStatus = 'entwurf' | 'freigegeben' | 'versendet' | 'bezahlt' | 'storniert';

interface Kunde {
  id: string;
  name: string;
  vorname: string | null;
  nachname: string | null;
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

interface Rechnung {
  id: string;
  rechnungsnummer: string;
  empfaenger_name: string;
  abrechnungszeitraum_von: string;
  abrechnungszeitraum_bis: string;
  netto_betrag: number;
  brutto_betrag: number;
  status: RechnungStatus;
  created_at: string;
  kostentraeger_id: string | null;
  privat_kunde_id: string | null;
  validierung_warnungen: string[] | null;
}

interface BillingResult {
  success: boolean;
  dry_run: boolean;
  validierung: {
    is_valid: boolean;
    errors: string[];
    warnings: string[];
  };
  zusammenfassung: {
    termine_gesamt: number;
    gruppen: number;
    rechnungen_erstellt: number;
  };
  rechnungen: Rechnung[];
  gruppen_preview?: {
    kostentraeger: string;
    termine_anzahl: number;
    kunden: string[];
  }[];
}

const statusConfig: Record<RechnungStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  entwurf: { label: 'Entwurf', variant: 'secondary' },
  freigegeben: { label: 'Freigegeben', variant: 'default' },
  versendet: { label: 'Versendet', variant: 'outline' },
  bezahlt: { label: 'Bezahlt', variant: 'default' },
  storniert: { label: 'Storniert', variant: 'destructive' },
};

export default function Billing() {
  const queryClient = useQueryClient();
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKunde, setSelectedKunde] = useState<string | null>(null);


  // Billing period selection
  const lastMonth = subMonths(new Date(), 1);
  const [zeitraumVon, setZeitraumVon] = useState(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
  const [zeitraumBis, setZeitraumBis] = useState(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));
  
  // Preview dialog
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewResult, setPreviewResult] = useState<BillingResult | null>(null);
  
  // Detail dialog
  const [selectedRechnung, setSelectedRechnung] = useState<Rechnung | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Fetch existing Rechnungen
  const { data: rechnungen, isLoading: rechnungenLoading } = useQuery({
    queryKey: ['rechnungen'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rechnungen')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Rechnung[];
    }
  });

  // Fetch Rechnungspositionen for selected Rechnung
  const { data: positionen } = useQuery({
    queryKey: ['rechnungspositionen', selectedRechnung?.id],
    queryFn: async () => {
      if (!selectedRechnung) return [];
      const { data, error } = await supabase
        .from('rechnungspositionen')
        .select(`
          *,
          kunden:kunden_id (vorname, nachname),
          mitarbeiter:mitarbeiter_id (vorname, nachname)
        `)
        .eq('rechnung_id', selectedRechnung.id)
        .order('leistungsdatum', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedRechnung
  });

  // Preview billing (dry run)
  const previewMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('batch-billing', {
        body: {
          zeitraum_von: zeitraumVon,
          zeitraum_bis: zeitraumBis,
          dry_run: true
        }
      });

      if (response.error) throw response.error;
      return response.data as BillingResult;
    },
    onSuccess: (data) => {
      setPreviewResult(data);
      setPreviewOpen(true);
    },
    onError: (error) => {
      sonnerToast.error('Vorschau fehlgeschlagen', {
        description: error instanceof Error ? error.message : 'Unbekannter Fehler'
      });
    }
  });

  // Execute billing
  const executeMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('batch-billing', {
        body: {
          zeitraum_von: zeitraumVon,
          zeitraum_bis: zeitraumBis,
          dry_run: false
        }
      });

      if (response.error) throw response.error;
      return response.data as BillingResult;
    },
    onSuccess: (data) => {
      if (data.success) {
        sonnerToast.success('Abrechnung erstellt', {
          description: `${data.rechnungen.length} Rechnung(en) erstellt`
        });
        setPreviewOpen(false);
        queryClient.invalidateQueries({ queryKey: ['rechnungen'] });
      } else {
        sonnerToast.error('Abrechnung fehlgeschlagen', {
          description: data.validierung.errors.join(', ')
        });
      }
    },
    onError: (error) => {
      sonnerToast.error('Abrechnung fehlgeschlagen', {
        description: error instanceof Error ? error.message : 'Unbekannter Fehler'
      });
    }
  });

  // Update Rechnung status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RechnungStatus }) => {
      const updates: Record<string, unknown> = { status };
      
      if (status === 'freigegeben') {
        const { data: { user } } = await supabase.auth.getUser();
        updates.freigegeben_von = user?.id;
        updates.freigegeben_am = new Date().toISOString();
      } else if (status === 'versendet') {
        updates.versendet_am = new Date().toISOString();
      } else if (status === 'bezahlt') {
        updates.bezahlt_am = new Date().toISOString();
      }

      const { error } = await supabase
        .from('rechnungen')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      sonnerToast.success('Status aktualisiert');
      queryClient.invalidateQueries({ queryKey: ['rechnungen'] });
      setSelectedRechnung(null);
    }
  });

  async function loadData() {
    try {
      const { data: kundenData, error: kundenError } = await supabase
        .from('kunden')
        .select('id, name, vorname, nachname, pflegegrad, stunden_kontingent_monat')
        .eq('aktiv', true)
        .order('nachname');

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
      sonnerToast.error('Fehler', { description: 'Daten konnten nicht geladen werden' });
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

      sonnerToast.success('Stunden wurden aktualisiert');
    } catch (error) {
      console.error('Error updating hours:', error);
      sonnerToast.error('Fehler', { description: 'Stunden konnten nicht aktualisiert werden' });
    }
  }

  function getKundenAppointments(kundenId: string) {
    return appointments.filter(apt => apt.kunden_id === kundenId);
  }

  function calculateTotalHours(kundenId: string) {
    return getKundenAppointments(kundenId).reduce((sum, apt) => sum + (apt.iststunden || 0), 0);
  }

  function getKundenName(kunde: Kunde) {
    if (kunde.vorname && kunde.nachname) {
      return `${kunde.vorname} ${kunde.nachname}`;
    }
    return kunde.name || 'Unbekannt';
  }

  // Stats
  const stats = {
    entwurf: rechnungen?.filter(r => r.status === 'entwurf').length || 0,
    freigegeben: rechnungen?.filter(r => r.status === 'freigegeben').length || 0,
    versendet: rechnungen?.filter(r => r.status === 'versendet').length || 0,
    offen: rechnungen?.filter(r => ['entwurf', 'freigegeben', 'versendet'].includes(r.status))
      .reduce((sum, r) => sum + r.brutto_betrag, 0) || 0
  };

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
          Regelbasierte Batch-Abrechnung mit Gültigkeitszeiträumen und Kostenträger-Logik
        </p>
      </div>


      <Tabs defaultValue="batch" className="space-y-4">
        <TabsList>
          <TabsTrigger value="batch">Batch-Abrechnung</TabsTrigger>
          <TabsTrigger value="rechnungen">Rechnungen</TabsTrigger>
          <TabsTrigger value="overview">Stundenübersicht</TabsTrigger>
          <TabsTrigger value="details">Stundenerfassung</TabsTrigger>
        </TabsList>

        <TabsContent value="batch" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Batch-Abrechnung erstellen
              </CardTitle>
              <CardDescription>
                Alle abgeschlossenen Termine im gewählten Zeitraum werden validiert und nach Kostenträger gruppiert
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="zeitraum_von">Zeitraum von</Label>
                  <Input
                    id="zeitraum_von"
                    type="date"
                    value={zeitraumVon}
                    onChange={(e) => setZeitraumVon(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zeitraum_bis">Zeitraum bis</Label>
                  <Input
                    id="zeitraum_bis"
                    type="date"
                    value={zeitraumBis}
                    onChange={(e) => setZeitraumBis(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => previewMutation.mutate()}
                  disabled={previewMutation.isPending}
                >
                  {previewMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4 mr-2" />
                  )}
                  Vorschau & Validierung
                </Button>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Abrechnungsregeln</AlertTitle>
                <AlertDescription className="mt-2 space-y-1">
                  <p>• <strong>Gültigkeitszeitraum:</strong> Termine müssen im Gültigkeitszeitraum der Leistung liegen</p>
                  <p>• <strong>Pflegegrad:</strong> Mindest-Pflegegrad wird je nach Leistungsart geprüft</p>
                  <p>• <strong>Kontingent:</strong> Warnung bei Überschreitung des Stundenkontingents</p>
                  <p>• <strong>Höchstbeträge:</strong> Monatliche/jährliche Limits werden validiert</p>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rechnungen" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rechnungsübersicht</CardTitle>
              <CardDescription>Alle erstellten Rechnungen</CardDescription>
            </CardHeader>
            <CardContent>
              {rechnungenLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !rechnungen?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Noch keine Rechnungen erstellt</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rechnungsnr.</TableHead>
                      <TableHead>Empfänger</TableHead>
                      <TableHead>Zeitraum</TableHead>
                      <TableHead className="text-right">Betrag</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rechnungen.map((rechnung) => (
                      <TableRow key={rechnung.id}>
                        <TableCell className="font-mono font-medium">
                          {rechnung.rechnungsnummer}
                        </TableCell>
                        <TableCell>{rechnung.empfaenger_name}</TableCell>
                        <TableCell>
                          {format(new Date(rechnung.abrechnungszeitraum_von), 'dd.MM.', { locale: de })} - 
                          {format(new Date(rechnung.abrechnungszeitraum_bis), 'dd.MM.yyyy', { locale: de })}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {rechnung.brutto_betrag.toFixed(2)} €
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig[rechnung.status].variant}>
                            {statusConfig[rechnung.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedRechnung(rechnung)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
                        <TableCell className="font-medium">{getKundenName(kunde)}</TableCell>
                        <TableCell>{kunde.pflegegrad || '-'}</TableCell>
                        <TableCell className="text-right">
                          {kunde.stunden_kontingent_monat}h
                        </TableCell>
                        <TableCell className="text-right">{totalHours.toFixed(2)}h</TableCell>
                        <TableCell className={`text-right ${diff < 0 ? 'text-destructive' : 'text-primary'}`}>
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
                        {getKundenName(kunde)} - {calculateTotalHours(kunde.id).toFixed(2)}h von {kunde.stunden_kontingent_monat}h
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

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Abrechnungs-Vorschau</DialogTitle>
            <DialogDescription>
              Zeitraum: {format(new Date(zeitraumVon), 'dd.MM.yyyy', { locale: de })} - {format(new Date(zeitraumBis), 'dd.MM.yyyy', { locale: de })}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh]">
            {previewResult && (
              <div className="space-y-4">
                {/* Validation Errors */}
                {previewResult.validierung.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Validierungsfehler</AlertTitle>
                    <AlertDescription>
                      <ul className="mt-2 list-disc list-inside space-y-1">
                        {previewResult.validierung.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Warnings */}
                {previewResult.validierung.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Warnungen</AlertTitle>
                    <AlertDescription>
                      <ul className="mt-2 list-disc list-inside space-y-1">
                        {previewResult.validierung.warnings.map((warn, i) => (
                          <li key={i}>{warn}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Summary */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{previewResult.zusammenfassung.termine_gesamt}</div>
                      <p className="text-xs text-muted-foreground">Termine gefunden</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{previewResult.zusammenfassung.gruppen}</div>
                      <p className="text-xs text-muted-foreground">Kostenträger-Gruppen</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">
                        {previewResult.validierung.is_valid ? '✓' : '✗'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {previewResult.validierung.is_valid ? 'Bereit zur Abrechnung' : 'Fehler beheben'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Groups Preview */}
                {previewResult.gruppen_preview && previewResult.gruppen_preview.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Zu erstellende Rechnungen:</h4>
                    {previewResult.gruppen_preview.map((gruppe, i) => (
                      <Card key={i}>
                        <CardContent className="py-3">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                {gruppe.kostentraeger}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {gruppe.termine_anzahl} Termine • {gruppe.kunden.length} Kunde(n)
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => executeMutation.mutate()}
              disabled={!previewResult?.validierung.is_valid || executeMutation.isPending}
            >
              {executeMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Abrechnung durchführen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rechnung Detail Dialog */}
      <Dialog open={!!selectedRechnung} onOpenChange={() => setSelectedRechnung(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Rechnung {selectedRechnung?.rechnungsnummer}
            </DialogTitle>
            <DialogDescription>
              {selectedRechnung && (
                <>
                  {selectedRechnung.empfaenger_name} • 
                  {format(new Date(selectedRechnung.abrechnungszeitraum_von), 'dd.MM.', { locale: de })} - 
                  {format(new Date(selectedRechnung.abrechnungszeitraum_bis), 'dd.MM.yyyy', { locale: de })}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh]">
            {positionen && positionen.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Mitarbeiter</TableHead>
                    <TableHead>Zeit</TableHead>
                    <TableHead className="text-right">Stunden</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positionen.map((pos: any) => (
                    <TableRow key={pos.id}>
                      <TableCell>
                        {format(new Date(pos.leistungsdatum), 'dd.MM.yyyy', { locale: de })}
                      </TableCell>
                      <TableCell>
                        {pos.kunden?.vorname} {pos.kunden?.nachname}
                      </TableCell>
                      <TableCell>
                        {pos.mitarbeiter?.vorname} {pos.mitarbeiter?.nachname}
                      </TableCell>
                      <TableCell>
                        {pos.leistungsbeginn} - {pos.leistungsende}
                      </TableCell>
                      <TableCell className="text-right">{pos.stunden.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {pos.einzelbetrag.toFixed(2)} €
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>

          <div className="flex justify-between items-center pt-4 border-t">
            <div>
              <Badge variant={selectedRechnung ? statusConfig[selectedRechnung.status].variant : 'secondary'}>
                {selectedRechnung && statusConfig[selectedRechnung.status].label}
              </Badge>
            </div>
            <div className="text-lg font-bold">
              Gesamt: {selectedRechnung?.brutto_betrag.toFixed(2)} €
            </div>
          </div>

          <DialogFooter className="gap-2">
            {selectedRechnung?.status === 'entwurf' && (
              <Button
                onClick={() => updateStatusMutation.mutate({ 
                  id: selectedRechnung.id, 
                  status: 'freigegeben' 
                })}
                disabled={updateStatusMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Freigeben
              </Button>
            )}
            {selectedRechnung?.status === 'freigegeben' && (
              <Button
                onClick={() => updateStatusMutation.mutate({ 
                  id: selectedRechnung.id, 
                  status: 'versendet' 
                })}
                disabled={updateStatusMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                Als versendet markieren
              </Button>
            )}
            {selectedRechnung?.status === 'versendet' && (
              <Button
                onClick={() => updateStatusMutation.mutate({ 
                  id: selectedRechnung.id, 
                  status: 'bezahlt' 
                })}
                disabled={updateStatusMutation.isPending}
              >
                <Euro className="h-4 w-4 mr-2" />
                Als bezahlt markieren
              </Button>
            )}
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              PDF Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
