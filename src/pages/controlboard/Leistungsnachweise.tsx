import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  FileText, Eye, Printer, Calendar, Clock,
  CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw,
  Search, ArrowUpDown, ChevronLeft, ChevronRight, X,
  User, TrendingUp, FileCheck, PenLine, Send
} from 'lucide-react';
import { format } from 'date-fns';
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

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; dotColor: string }> = {
  entwurf: { label: 'Entwurf', variant: 'secondary', icon: <PenLine className="h-3 w-3" />, dotColor: 'bg-muted-foreground' },
  veröffentlicht: { label: 'Veröffentlicht', variant: 'outline', icon: <Send className="h-3 w-3" />, dotColor: 'bg-primary' },
  offen: { label: 'Offen', variant: 'outline', icon: <Clock className="h-3 w-3" />, dotColor: 'bg-warning' },
  unterschrieben: { label: 'Unterschrieben', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" />, dotColor: 'bg-success' },
  abgeschlossen: { label: 'Abgeschlossen', variant: 'default', icon: <FileCheck className="h-3 w-3" />, dotColor: 'bg-success' },
};

const terminStatusLabel: Record<string, { label: string; color: string }> = {
  completed: { label: 'Erfolgt', color: 'text-success bg-success/10' },
  scheduled: { label: 'Geplant', color: 'text-primary bg-primary/10' },
  in_progress: { label: 'Offen', color: 'text-warning bg-warning/10' },
  nicht_angetroffen: { label: 'Nicht rechtzeitig abgesagt', color: 'text-warning bg-warning/10' },
  abgesagt_rechtzeitig: { label: 'Rechtzeitig abgesagt', color: 'text-muted-foreground bg-muted' },
  cancelled: { label: 'Abgesagt', color: 'text-destructive bg-destructive/10' },
  unassigned: { label: 'Nicht zugewiesen', color: 'text-muted-foreground bg-muted' },
};

const monthNames = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

type SortKey = 'name' | 'geplant' | 'geleistet' | 'status';

export default function Leistungsnachweise() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedLN, setSelectedLN] = useState<LeistungsnachweisRow | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('alle');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const isCurrentMonth = selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();

  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };
  const goToCurrentMonth = () => { setSelectedMonth(now.getMonth() + 1); setSelectedYear(now.getFullYear()); };

  // Fetch Leistungsnachweise
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

  // Fetch active customers
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

  // Fetch termine for selected LN
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

  // Auto-generate/update Leistungsnachweise when month data is loaded
  const autoGenerateNachweise = async () => {
    if (!kunden) return;
    const von = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
    const bis = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).toISOString();

    const { data: allTermine, error: tErr } = await supabase
      .from('termine')
      .select('kunden_id, iststunden, start_at, end_at, status')
      .gte('start_at', von)
      .lte('start_at', bis);
    if (tErr) return;

    const terminsByKunde = new Map<string, typeof allTermine>();
    for (const t of allTermine || []) {
      const arr = terminsByKunde.get(t.kunden_id) || [];
      arr.push(t);
      terminsByKunde.set(t.kunden_id, arr);
    }

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

      await supabase
        .from('leistungsnachweise')
        .upsert({
          kunden_id: kunde.id,
          monat: selectedMonth,
          jahr: selectedYear,
          geplante_stunden: Math.round(geplant * 100) / 100,
          geleistete_stunden: Math.round(geleistet * 100) / 100,
          status: 'entwurf'
        }, { onConflict: 'kunden_id,monat,jahr', ignoreDuplicates: false });
    }

    queryClient.invalidateQueries({ queryKey: ['leistungsnachweise', selectedMonth, selectedYear] });
  };

  // Trigger auto-generation when kunden and nachweise are loaded
  const [autoGenDone, setAutoGenDone] = useState<string | null>(null);
  useEffect(() => {
    const key = `${selectedMonth}-${selectedYear}`;
    if (kunden && nachweise !== undefined && autoGenDone !== key) {
      setAutoGenDone(key);
      autoGenerateNachweise();
    }
  }, [kunden, nachweise, selectedMonth, selectedYear]);

  // Update mutation
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

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leistungsnachweise')
        .update({ status: 'veröffentlicht' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Leistungsnachweis veröffentlicht – Mitarbeiter kann jetzt die Unterschrift einholen');
      queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });
    },
    onError: (err) => {
      toast.error('Fehler', { description: err instanceof Error ? err.message : 'Unbekannt' });
    }
  });


  const getKundeName = (kundenId: string) => {
    const k = kunden?.find(c => c.id === kundenId);
    if (!k) return 'Unbekannt';
    if (k.vorname && k.nachname) return `${k.vorname} ${k.nachname}`;
    return k.name || 'Unbekannt';
  };

  const kundenMap = useMemo(() => {
    const map = new Map<string, (typeof kunden extends (infer T)[] | undefined ? T : never)>();
    kunden?.forEach(k => map.set(k.id, k));
    return map;
  }, [kunden]);

  // Filter & Sort
  const filteredNachweise = useMemo(() => {
    if (!nachweise) return [];
    let result = [...nachweise];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(ln => getKundeName(ln.kunden_id).toLowerCase().includes(q));
    }
    if (statusFilter !== 'alle') {
      result = result.filter(ln => ln.status === statusFilter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = getKundeName(a.kunden_id).localeCompare(getKundeName(b.kunden_id)); break;
        case 'geplant': cmp = a.geplante_stunden - b.geplante_stunden; break;
        case 'geleistet': cmp = a.geleistete_stunden - b.geleistete_stunden; break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [nachweise, searchQuery, statusFilter, sortKey, sortAsc, kunden]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  // Stats
  const stats = useMemo(() => {
    if (!nachweise) return { total: 0, signed: 0, totalPlanned: 0, totalDone: 0 };
    return {
      total: nachweise.length,
      signed: nachweise.filter(n => n.unterschrift_kunde_zeitstempel).length,
      totalPlanned: nachweise.reduce((s, n) => s + n.geplante_stunden, 0),
      totalDone: nachweise.reduce((s, n) => s + n.geleistete_stunden, 0),
    };
  }, [nachweise]);

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header with month navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Leistungsnachweise</h1>
          <p className="text-sm text-muted-foreground">Monatliche Nachweise pro Kunde verwalten</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-card shadow-sm">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-r-none" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={goToCurrentMonth}
              className={`px-4 py-2 text-sm font-semibold transition-colors min-w-[160px] text-center ${isCurrentMonth ? 'text-primary' : 'text-foreground hover:text-primary'}`}
            >
              {monthNames[selectedMonth - 1]} {selectedYear}
              {isCurrentMonth && (
                <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Aktuell
                </span>
              )}
            </button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-l-none" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Nachweise', value: stats.total, icon: FileText, color: 'text-primary' },
          { label: 'Unterschrieben', value: stats.signed, icon: CheckCircle2, color: 'text-success' },
          { label: 'Geplant (h)', value: Math.round(stats.totalPlanned * 10) / 10, icon: Clock, color: 'text-muted-foreground' },
          { label: 'Geleistet (h)', value: Math.round(stats.totalDone * 10) / 10, icon: TrendingUp, color: 'text-primary' },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`rounded-lg bg-muted p-2 ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content: Split View */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 min-h-0">
        {/* Left: List */}
        <Card className="flex flex-col min-h-0 border-border/60">
          {/* Search & Filter Bar */}
          <div className="p-3 border-b border-border flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Kunde suchen..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Status</SelectItem>
                <SelectItem value="entwurf">Entwurf</SelectItem>
                <SelectItem value="veröffentlicht">Veröffentlicht</SelectItem>
                <SelectItem value="offen">Offen</SelectItem>
                <SelectItem value="unterschrieben">Unterschrieben</SelectItem>
                <SelectItem value="abgeschlossen">Abgeschlossen</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {filteredNachweise.length} Ergebnisse
            </span>
          </div>

          {/* Table */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !filteredNachweise.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground">Keine Nachweise gefunden</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {nachweise?.length ? 'Passe deine Filter an.' : 'Für diesen Monat gibt es noch keine Termine.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                      <span className="flex items-center gap-1">Kunde <ArrowUpDown className="h-3 w-3" /></span>
                    </TableHead>
                    <TableHead>PG</TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('geplant')}>
                      <span className="flex items-center justify-end gap-1">Geplant <ArrowUpDown className="h-3 w-3" /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('geleistet')}>
                      <span className="flex items-center justify-end gap-1">Geleistet <ArrowUpDown className="h-3 w-3" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>
                      <span className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></span>
                    </TableHead>
                    <TableHead>Signiert</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNachweise.map(ln => {
                    const kunde = kundenMap.get(ln.kunden_id);
                    const cfg = statusConfig[ln.status] || statusConfig.entwurf;
                    const isSelected = selectedLN?.id === ln.id;
                    return (
                      <TableRow
                        key={ln.id}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/50'}`}
                        onClick={() => setSelectedLN(ln)}
                      >
                        <TableCell className="font-medium">{getKundeName(ln.kunden_id)}</TableCell>
                        <TableCell>
                          {kunde?.pflegegrad ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-semibold text-foreground">
                              {kunde.pflegegrad}
                            </span>
                          ) : '–'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{ln.geplante_stunden}h</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{ln.geleistete_stunden}h</TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant} className="gap-1 text-xs">
                            {cfg.icon} {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {ln.unterschrift_kunde_zeitstempel ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {ln.status === 'entwurf' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                publishMutation.mutate(ln.id);
                              }}
                              disabled={publishMutation.isPending}
                            >
                              <Send className="h-3 w-3" /> Veröffentlichen
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </Card>

        {/* Right: Detail / Editor Panel */}
        <Card className="flex flex-col min-h-0 border-border/60">
          {!selectedLN ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Eye className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">Nachweis auswählen</p>
              <p className="text-sm text-muted-foreground mt-1">Wähle links einen Leistungsnachweis um ihn hier zu bearbeiten.</p>
            </div>
          ) : (
            <>
              {/* Panel Header */}
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-full bg-primary/10 p-2">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{getKundeName(selectedLN.kunden_id)}</p>
                    <p className="text-xs text-muted-foreground">{monthNames[selectedLN.monat - 1]} {selectedLN.jahr}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.print()} title="Drucken">
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedLN(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-5">
                  {/* Hours Summary */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border p-3 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Geplant</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{selectedLN.geplante_stunden}h</p>
                    </div>
                    <div className="rounded-lg border border-border p-3 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Geleistet</p>
                      <p className="text-2xl font-bold text-primary mt-1">{selectedLN.geleistete_stunden}h</p>
                    </div>
                  </div>

                  {/* Termine */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      Termine ({termine?.length || 0})
                    </h3>
                    {!termine?.length ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Keine Termine</p>
                    ) : (
                      <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                        {termine.map(t => {
                          const start = new Date(t.start_at);
                          const end = new Date(t.end_at);
                          const hours = t.iststunden ?? ((end.getTime() - start.getTime()) / 3600000);
                          const sts = terminStatusLabel[t.status] || { label: t.status, color: 'text-muted-foreground bg-muted' };
                          return (
                            <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm hover:bg-muted/30 transition-colors">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground truncate">
                                  {format(start, 'dd.MM.', { locale: de })} · {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {t.mitarbeiter ? `${t.mitarbeiter.vorname || ''} ${t.mitarbeiter.nachname || ''}`.trim() : 'Kein MA'}
                                </p>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${sts.color}`}>
                                {sts.label}
                              </span>
                              <span className="text-xs font-semibold tabular-nums text-foreground w-10 text-right">{Math.round(hours * 100) / 100}h</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Edit Options */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground">Einstellungen</h3>

                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="abw-addr"
                        checked={selectedLN.abweichende_rechnungsadresse}
                        onCheckedChange={(checked) => setSelectedLN({ ...selectedLN, abweichende_rechnungsadresse: !!checked })}
                      />
                      <Label htmlFor="abw-addr" className="text-sm">Abweichende Rechnungsadresse</Label>
                    </div>

                    {selectedLN.abweichende_rechnungsadresse && (
                      <div className="grid grid-cols-2 gap-2 pl-6">
                        <div className="space-y-1">
                          <Label className="text-xs">Name</Label>
                          <Input className="h-8 text-sm" value={selectedLN.rechnungsadresse_name || ''} onChange={e => setSelectedLN({ ...selectedLN, rechnungsadresse_name: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Straße</Label>
                          <Input className="h-8 text-sm" value={selectedLN.rechnungsadresse_strasse || ''} onChange={e => setSelectedLN({ ...selectedLN, rechnungsadresse_strasse: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">PLZ</Label>
                          <Input className="h-8 text-sm" value={selectedLN.rechnungsadresse_plz || ''} onChange={e => setSelectedLN({ ...selectedLN, rechnungsadresse_plz: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Stadt</Label>
                          <Input className="h-8 text-sm" value={selectedLN.rechnungsadresse_stadt || ''} onChange={e => setSelectedLN({ ...selectedLN, rechnungsadresse_stadt: e.target.value })} />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="privat"
                        checked={selectedLN.ist_privat}
                        onCheckedChange={(checked) => setSelectedLN({ ...selectedLN, ist_privat: !!checked })}
                      />
                      <Label htmlFor="privat" className="text-sm">Privatperson statt Kasse</Label>
                    </div>

                    {selectedLN.ist_privat && (
                      <div className="pl-6 space-y-1">
                        <Label className="text-xs">Privat-Empfänger</Label>
                        <Input className="h-8 text-sm" value={selectedLN.privat_empfaenger_name || ''} onChange={e => setSelectedLN({ ...selectedLN, privat_empfaenger_name: e.target.value })} />
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs">GF-Unterschrift Name</Label>
                      <Input className="h-8 text-sm" value={selectedLN.unterschrift_gf_name || ''} onChange={e => setSelectedLN({ ...selectedLN, unterschrift_gf_name: e.target.value })} placeholder="Name der Geschäftsführung" />
                    </div>

                    {/* Signature Info */}
                    {selectedLN.unterschrift_kunde_zeitstempel && (
                      <div className="rounded-lg bg-success/10 border border-success/20 p-3">
                        <div className="flex items-center gap-2 text-sm text-success">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="font-medium">Kunde hat unterschrieben</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedLN.unterschrift_kunde_durch && `Durch: ${selectedLN.unterschrift_kunde_durch} · `}
                          {format(new Date(selectedLN.unterschrift_kunde_zeitstempel), 'dd.MM.yyyy HH:mm', { locale: de })}
                        </p>
                        {selectedLN.unterschrift_kunde_bild && (
                          <img src={selectedLN.unterschrift_kunde_bild} alt="Unterschrift" className="h-12 mt-2 border rounded bg-card" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>

              {/* Save button */}
              <div className="p-3 border-t border-border">
                <Button
                  className="w-full"
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
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Änderungen speichern
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
