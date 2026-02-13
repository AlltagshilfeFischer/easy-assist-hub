import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  FileText, Plus, Eye, Printer, Calendar, Clock, 
  CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, getDaysInMonth } from 'date-fns';
import { de } from 'date-fns/locale';

interface LeistungsnachweisRow {
  id: string;
  kunden_id: string;
  monat: number;
  jahr: number;
  geplante_stunden: number;
  geleistete_stunden: number;
  status: string;
  abweichende_rechnungsadresse: boolean;
  rechnungsadresse_name: string | null;
  rechnungsadresse_strasse: string | null;
  rechnungsadresse_plz: string | null;
  rechnungsadresse_stadt: string | null;
  ist_privat: boolean;
  kostentraeger_id: string | null;
  privat_empfaenger_name: string | null;
  unterschrift_kunde_bild: string | null;
  unterschrift_kunde_zeitstempel: string | null;
  unterschrift_kunde_durch: string | null;
  unterschrift_gf_template: string | null;
  unterschrift_gf_name: string | null;
  created_at: string;
  updated_at: string;
}

interface Termin {
  id: string;
  titel: string;
  start_at: string;
  end_at: string;
  status: string;
  iststunden: number | null;
  mitarbeiter: { vorname: string | null; nachname: string | null } | null;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  entwurf: { label: 'Entwurf', variant: 'secondary', icon: <FileText className="h-3 w-3" /> },
  offen: { label: 'Offen', variant: 'outline', icon: <Clock className="h-3 w-3" /> },
  unterschrieben: { label: 'Unterschrieben', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  abgeschlossen: { label: 'Abgeschlossen', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
};

const terminStatusLabel: Record<string, { label: string; color: string }> = {
  completed: { label: 'Erfolgt', color: 'text-emerald-700 bg-emerald-50' },
  scheduled: { label: 'Geplant', color: 'text-blue-700 bg-blue-50' },
  in_progress: { label: 'Offen', color: 'text-amber-700 bg-amber-50' },
  nicht_angetroffen: { label: 'Nicht rechtzeitig abgesagt', color: 'text-amber-700 bg-amber-50' },
  abgesagt_rechtzeitig: { label: 'Rechtzeitig abgesagt', color: 'text-slate-600 bg-slate-50' },
  cancelled: { label: 'Abgesagt', color: 'text-red-700 bg-red-50' },
  unassigned: { label: 'Nicht zugewiesen', color: 'text-gray-600 bg-gray-50' },
};

const monthNames = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

export default function Leistungsnachweise() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedLN, setSelectedLN] = useState<LeistungsnachweisRow | null>(null);
  const [printMode, setPrintMode] = useState(false);

  // Fetch all Leistungsnachweise for selected month/year
  const { data: nachweise, isLoading } = useQuery({
    queryKey: ['leistungsnachweise', selectedMonth, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leistungsnachweise')
        .select('*')
        .eq('monat', selectedMonth)
        .eq('jahr', selectedYear)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as LeistungsnachweisRow[];
    }
  });

  // Fetch all active customers
  const { data: kunden } = useQuery({
    queryKey: ['kunden-aktiv'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kunden')
        .select('id, vorname, nachname, name, pflegegrad, stunden_kontingent_monat')
        .eq('aktiv', true)
        .order('nachname');
      if (error) throw error;
      return data;
    }
  });

  // Fetch termine for detail view
  const { data: termine } = useQuery({
    queryKey: ['termine-ln', selectedLN?.kunden_id, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!selectedLN) return [];
      const von = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
      const bis = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).toISOString();
      const { data, error } = await supabase
        .from('termine')
        .select('id, titel, start_at, end_at, status, iststunden, mitarbeiter:mitarbeiter_id(vorname, nachname)')
        .eq('kunden_id', selectedLN.kunden_id)
        .gte('start_at', von)
        .lte('start_at', bis)
        .order('start_at', { ascending: true });
      if (error) throw error;
      return data as any as Termin[];
    },
    enabled: !!selectedLN
  });

  // Generate Leistungsnachweise for month
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!kunden) throw new Error('Keine Kunden');
      const von = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
      const bis = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).toISOString();

      // Fetch all termine for this month
      const { data: allTermine, error: tErr } = await supabase
        .from('termine')
        .select('kunden_id, iststunden, start_at, end_at, status')
        .gte('start_at', von)
        .lte('start_at', bis);
      if (tErr) throw tErr;

      const terminsByKunde = new Map<string, typeof allTermine>();
      for (const t of allTermine || []) {
        const arr = terminsByKunde.get(t.kunden_id) || [];
        arr.push(t);
        terminsByKunde.set(t.kunden_id, arr);
      }

      let created = 0;
      for (const kunde of kunden) {
        const kundeTermine = terminsByKunde.get(kunde.id) || [];
        if (kundeTermine.length === 0) continue;

        const geleistet = kundeTermine
          .filter(t => ['completed', 'nicht_angetroffen'].includes(t.status))
          .reduce((sum, t) => {
            if (t.iststunden) return sum + Number(t.iststunden);
            const start = new Date(t.start_at);
            const end = new Date(t.end_at);
            return sum + (end.getTime() - start.getTime()) / 3600000;
          }, 0);

        const geplant = kundeTermine.reduce((sum, t) => {
          const start = new Date(t.start_at);
          const end = new Date(t.end_at);
          return sum + (end.getTime() - start.getTime()) / 3600000;
        }, 0);

        const { error } = await supabase
          .from('leistungsnachweise')
          .upsert({
            kunden_id: kunde.id,
            monat: selectedMonth,
            jahr: selectedYear,
            geplante_stunden: Math.round(geplant * 100) / 100,
            geleistete_stunden: Math.round(geleistet * 100) / 100,
            status: 'entwurf'
          }, { onConflict: 'kunden_id,monat,jahr', ignoreDuplicates: false });

        if (!error) created++;
      }
      return created;
    },
    onSuccess: (count) => {
      toast.success(`${count} Leistungsnachweis(e) generiert/aktualisiert`);
      queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });
    },
    onError: (err) => {
      toast.error('Fehler beim Generieren', { description: err instanceof Error ? err.message : 'Unbekannt' });
    }
  });

  // Update LN details
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<LeistungsnachweisRow>) => {
      if (!selectedLN) throw new Error('Kein LN ausgewählt');
      const { error } = await supabase
        .from('leistungsnachweise')
        .update(updates)
        .eq('id', selectedLN.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Gespeichert');
      queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });
    }
  });

  // Helper
  const getKundeName = (kundenId: string) => {
    const k = kunden?.find(c => c.id === kundenId);
    if (!k) return 'Unbekannt';
    if (k.vorname && k.nachname) return `${k.vorname} ${k.nachname}`;
    return k.name || 'Unbekannt';
  };

  const kundenMap = useMemo(() => {
    const map = new Map<string, typeof kunden extends (infer T)[] | undefined ? T : never>();
    kunden?.forEach(k => map.set(k.id, k));
    return map;
  }, [kunden]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leistungsnachweise</h1>
          <p className="text-muted-foreground">Monatliche Leistungsnachweise pro Kunde</p>
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Nachweise generieren
        </Button>
      </div>

      {/* Month/Year Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <Label>Monat</Label>
              <select
                className="border rounded px-3 py-2 text-sm bg-background"
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
              >
                {monthNames.map((name, i) => (
                  <option key={i} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Jahr</Label>
              <Input
                type="number"
                className="w-24"
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
              />
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              {nachweise?.length || 0} Nachweise für {monthNames[selectedMonth - 1]} {selectedYear}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Übersicht */}
      <Card>
        <CardHeader>
          <CardTitle>Übersicht</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !nachweise?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Keine Leistungsnachweise für diesen Monat</p>
              <p className="text-sm mt-1">Klicken Sie "Nachweise generieren" um automatisch Nachweise aus den Terminen zu erstellen.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Pflegegrad</TableHead>
                  <TableHead className="text-right">Geplant (h)</TableHead>
                  <TableHead className="text-right">Geleistet (h)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Unterschrift</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nachweise.map(ln => {
                  const kunde = kundenMap.get(ln.kunden_id);
                  const cfg = statusConfig[ln.status] || statusConfig.entwurf;
                  return (
                    <TableRow key={ln.id}>
                      <TableCell className="font-medium">{getKundeName(ln.kunden_id)}</TableCell>
                      <TableCell>{kunde?.pflegegrad ? `PG ${kunde.pflegegrad}` : '–'}</TableCell>
                      <TableCell className="text-right">{ln.geplante_stunden}</TableCell>
                      <TableCell className="text-right font-medium">{ln.geleistete_stunden}</TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant} className="gap-1">
                          {cfg.icon} {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ln.unterschrift_kunde_zeitstempel ? (
                          <span className="text-emerald-600 text-sm flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {format(new Date(ln.unterschrift_kunde_zeitstempel), 'dd.MM.yy', { locale: de })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Ausstehend</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedLN(ln); setDetailOpen(true); setPrintMode(false); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedLN(ln); setDetailOpen(true); setPrintMode(true); }}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Leistungsnachweis – {selectedLN && getKundeName(selectedLN.kunden_id)}
            </DialogTitle>
          </DialogHeader>

          {selectedLN && (
            <ScrollArea className="max-h-[70vh]">
              <div className={`space-y-6 p-1 ${printMode ? 'print-mode' : ''}`} id="ln-print-area">
                {/* Header for print */}
                {printMode && (
                  <div className="text-center border-b pb-4">
                    <h2 className="text-xl font-bold">Leistungsnachweis</h2>
                    <p className="text-sm text-muted-foreground">
                      {monthNames[selectedLN.monat - 1]} {selectedLN.jahr}
                    </p>
                    <p className="font-medium mt-1">{getKundeName(selectedLN.kunden_id)}</p>
                  </div>
                )}

                {/* Stunden-Zusammenfassung */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">Geplante Stunden</p>
                      <p className="text-2xl font-bold">{selectedLN.geplante_stunden}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">Geleistete Stunden</p>
                      <p className="text-2xl font-bold">{selectedLN.geleistete_stunden}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Termin-Liste */}
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Termine
                  </h3>
                  {!termine?.length ? (
                    <p className="text-sm text-muted-foreground">Keine Termine in diesem Zeitraum</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Datum</TableHead>
                          <TableHead>Zeit</TableHead>
                          <TableHead>Mitarbeiter</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Std.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {termine.map(t => {
                          const start = new Date(t.start_at);
                          const end = new Date(t.end_at);
                          const hours = t.iststunden ?? ((end.getTime() - start.getTime()) / 3600000);
                          const sts = terminStatusLabel[t.status] || { label: t.status, color: 'text-gray-600 bg-gray-50' };
                          return (
                            <TableRow key={t.id}>
                              <TableCell>{format(start, 'dd.MM.yyyy', { locale: de })}</TableCell>
                              <TableCell>{format(start, 'HH:mm')} – {format(end, 'HH:mm')}</TableCell>
                              <TableCell>
                                {t.mitarbeiter ? `${t.mitarbeiter.vorname || ''} ${t.mitarbeiter.nachname || ''}`.trim() : '–'}
                              </TableCell>
                              <TableCell>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${sts.color}`}>
                                  {sts.label}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">{Math.round(hours * 100) / 100}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <Separator />

                {/* Optionen – nur im Edit-Mode */}
                {!printMode && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="abw-addr"
                        checked={selectedLN.abweichende_rechnungsadresse}
                        onCheckedChange={(checked) => {
                          const updated = { ...selectedLN, abweichende_rechnungsadresse: !!checked };
                          setSelectedLN(updated);
                        }}
                      />
                      <Label htmlFor="abw-addr">Abweichende Rechnungsadresse</Label>
                    </div>

                    {selectedLN.abweichende_rechnungsadresse && (
                      <div className="grid grid-cols-2 gap-3 pl-6">
                        <div className="space-y-1">
                          <Label>Name</Label>
                          <Input
                            value={selectedLN.rechnungsadresse_name || ''}
                            onChange={e => setSelectedLN({ ...selectedLN, rechnungsadresse_name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Straße</Label>
                          <Input
                            value={selectedLN.rechnungsadresse_strasse || ''}
                            onChange={e => setSelectedLN({ ...selectedLN, rechnungsadresse_strasse: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>PLZ</Label>
                          <Input
                            value={selectedLN.rechnungsadresse_plz || ''}
                            onChange={e => setSelectedLN({ ...selectedLN, rechnungsadresse_plz: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Stadt</Label>
                          <Input
                            value={selectedLN.rechnungsadresse_stadt || ''}
                            onChange={e => setSelectedLN({ ...selectedLN, rechnungsadresse_stadt: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="privat"
                        checked={selectedLN.ist_privat}
                        onCheckedChange={(checked) => {
                          setSelectedLN({ ...selectedLN, ist_privat: !!checked });
                        }}
                      />
                      <Label htmlFor="privat">Privat (Empfänger ist Privatperson statt Kasse)</Label>
                    </div>

                    {selectedLN.ist_privat && (
                      <div className="pl-6 space-y-1">
                        <Label>Privat-Empfänger Name</Label>
                        <Input
                          value={selectedLN.privat_empfaenger_name || ''}
                          onChange={e => setSelectedLN({ ...selectedLN, privat_empfaenger_name: e.target.value })}
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label>GF-Unterschrift (Vorausgefüllt)</Label>
                      <Input
                        value={selectedLN.unterschrift_gf_name || ''}
                        onChange={e => setSelectedLN({ ...selectedLN, unterschrift_gf_name: e.target.value })}
                        placeholder="Name der Geschäftsführung"
                      />
                    </div>
                  </div>
                )}

                {/* Unterschriften-Bereich (Print) */}
                {printMode && (
                  <div className="grid grid-cols-2 gap-8 pt-8">
                    <div className="border-t-2 pt-2 text-center">
                      <p className="text-sm text-muted-foreground">Unterschrift Kunde</p>
                      {selectedLN.unterschrift_kunde_bild ? (
                        <img src={selectedLN.unterschrift_kunde_bild} alt="Unterschrift" className="h-16 mx-auto mt-2" />
                      ) : (
                        <div className="h-16" />
                      )}
                      <p className="text-xs mt-1">{selectedLN.unterschrift_kunde_durch || ''}</p>
                      {selectedLN.unterschrift_kunde_zeitstempel && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(selectedLN.unterschrift_kunde_zeitstempel), 'dd.MM.yyyy HH:mm', { locale: de })}
                        </p>
                      )}
                    </div>
                    <div className="border-t-2 pt-2 text-center">
                      <p className="text-sm text-muted-foreground">Geschäftsführung</p>
                      {selectedLN.unterschrift_gf_template ? (
                        <img src={selectedLN.unterschrift_gf_template} alt="GF-Unterschrift" className="h-16 mx-auto mt-2" />
                      ) : (
                        <div className="h-16" />
                      )}
                      <p className="text-xs mt-1">{selectedLN.unterschrift_gf_name || ''}</p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            {printMode ? (
              <Button onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" /> Drucken
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (!selectedLN) return;
                  updateMutation.mutate({
                    abweichende_rechnungsadresse: selectedLN.abweichende_rechnungsadresse,
                    rechnungsadresse_name: selectedLN.rechnungsadresse_name,
                    rechnungsadresse_strasse: selectedLN.rechnungsadresse_strasse,
                    rechnungsadresse_plz: selectedLN.rechnungsadresse_plz,
                    rechnungsadresse_stadt: selectedLN.rechnungsadresse_stadt,
                    ist_privat: selectedLN.ist_privat,
                    privat_empfaenger_name: selectedLN.privat_empfaenger_name,
                    unterschrift_gf_name: selectedLN.unterschrift_gf_name,
                  });
                }}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Speichern
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
