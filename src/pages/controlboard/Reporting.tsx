import { useState, useMemo, useCallback } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import Papa from 'papaparse';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

import {
  CalendarIcon, Download, Clock, Users, TrendingDown, TrendingUp,
  CalendarDays, Loader2, X, Filter, ChevronDown,
  UserCheck, UserX, Heart,
} from 'lucide-react';

import {
  useReportingData,
  useMitarbeiterList,
  useKundenList,
  useKundenStatistik,
  useMitarbeiterAuslastung,
  type ReportingTermin,
} from '@/hooks/useReportingData';
import type { TerminStatus } from '@/types/domain';

// ─── Constants ──────────────────────────────────────────────

const STATUS_LABELS: Record<TerminStatus, string> = {
  unassigned: 'Nicht zugewiesen',
  scheduled: 'Geplant',
  in_progress: 'In Bearbeitung',
  completed: 'Durchgeführt',
  cancelled: 'Storniert',
  abgerechnet: 'Abgerechnet',
  bezahlt: 'Bezahlt',
  nicht_angetroffen: 'Nicht angetroffen',
  abgesagt_rechtzeitig: 'Rechtzeitig abgesagt',
};

const STATUS_VARIANTS: Record<TerminStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  unassigned: 'outline',
  scheduled: 'secondary',
  in_progress: 'default',
  completed: 'default',
  cancelled: 'destructive',
  abgerechnet: 'secondary',
  bezahlt: 'default',
  nicht_angetroffen: 'destructive',
  abgesagt_rechtzeitig: 'outline',
};

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

// ─── Shared Components ──────────────────────────────────────

interface MultiFilterProps {
  label: string;
  options: { id: string; name: string }[];
  selected: string[];
  onSelectionChange: (ids: string[]) => void;
  isLoading?: boolean;
}

function MultiFilter({ label, options, selected, onSelectionChange, isLoading }: MultiFilterProps) {
  const [open, setOpen] = useState(false);
  const toggleItem = useCallback((id: string) => {
    onSelectionChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }, [selected, onSelectionChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between min-w-[180px] h-10">
          <span className="truncate">{selected.length === 0 ? label : `${label} (${selected.length})`}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`${label} suchen...`} />
          <CommandList>
            <CommandEmpty>Keine Ergebnisse.</CommandEmpty>
            <CommandGroup>
              {isLoading ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : (
                <ScrollArea className="max-h-[200px]">
                  {options.map((opt) => (
                    <CommandItem key={opt.id} value={opt.name} onSelect={() => toggleItem(opt.id)}>
                      <Checkbox checked={selected.includes(opt.id)} className="mr-2" />
                      <span className="truncate">{opt.name}</span>
                    </CommandItem>
                  ))}
                </ScrollArea>
              )}
            </CommandGroup>
          </CommandList>
          {selected.length > 0 && (
            <>
              <Separator />
              <div className="p-2">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => onSelectionChange([])}>
                  <X className="mr-2 h-3 w-3" />Auswahl aufheben
                </Button>
              </div>
            </>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function DatePicker({ label, date, onDateChange }: { label: string; date: Date; onDateChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start text-left font-normal h-10 min-w-[160px]">
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span>{format(date, 'dd.MM.yyyy', { locale: de })}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-2 text-sm font-medium text-muted-foreground">{label}</div>
        <Calendar mode="single" selected={date} onSelect={(day) => { if (day) { onDateChange(day); setOpen(false); } }} locale={de} initialFocus />
      </PopoverContent>
    </Popover>
  );
}

function SummaryCard({ title, value, subtitle, icon: Icon }: { title: string; value: string | number; subtitle: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

// ─── Chart Tooltips ─────────────────────────────────────────

function EmployeeChartTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="font-medium">{data.fullName || data.mitarbeiterName || data.name}</p>
      <p className="text-sm text-muted-foreground">{data.gesamtStunden?.toFixed(1) ?? data.istStunden?.toFixed(1)} Stunden</p>
      {data.anzahlTermine != null && <p className="text-sm text-muted-foreground">{data.anzahlTermine} Termine</p>}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

export default function Reporting() {
  const now = new Date();
  const [activeTab, setActiveTab] = useState('termine');
  const [dateFrom, setDateFrom] = useState<Date>(() => startOfMonth(now));
  const [dateTo, setDateTo] = useState<Date>(() => endOfMonth(now));
  const [selectedMitarbeiter, setSelectedMitarbeiter] = useState<string[]>([]);
  const [selectedKunden, setSelectedKunden] = useState<string[]>([]);

  const { data: mitarbeiterOptions, isLoading: mitarbeiterLoading } = useMitarbeiterList();
  const { data: kundenOptions, isLoading: kundenLoading } = useKundenList();

  const filters = { dateFrom, dateTo, mitarbeiterIds: selectedMitarbeiter, kundenIds: selectedKunden };
  const { data: reportData, isLoading: reportLoading, isError } = useReportingData(filters);
  const { data: auslastungData, isLoading: auslastungLoading } = useMitarbeiterAuslastung(filters);
  const { data: kundenStatistik, isLoading: kundenLoading2 } = useKundenStatistik();

  // Chart data
  const chartData = useMemo(() => {
    if (!reportData) return [];
    return reportData.mitarbeiterStunden.map((ms) => ({
      mitarbeiterName: ms.mitarbeiterName.length > 15 ? ms.mitarbeiterName.substring(0, 15) + '...' : ms.mitarbeiterName,
      fullName: ms.mitarbeiterName,
      gesamtStunden: Math.round(ms.gesamtStunden * 10) / 10,
      anzahlTermine: ms.anzahlTermine,
      fill: ms.farbe,
    }));
  }, [reportData]);

  // CSV Export
  const handleCsvExport = useCallback(() => {
    if (!reportData?.termine.length) return;
    const csvRows = reportData.termine.map((t: ReportingTermin) => ({
      Datum: format(new Date(t.startAt), 'dd.MM.yyyy', { locale: de }),
      Von: format(new Date(t.startAt), 'HH:mm', { locale: de }),
      Bis: format(new Date(t.endAt), 'HH:mm', { locale: de }),
      Kunde: t.kundenName,
      Mitarbeiter: t.mitarbeiterName,
      'Dauer (h)': t.dauerStunden.toFixed(2),
      Status: STATUS_LABELS[t.status] ?? t.status,
    }));
    const csv = Papa.unparse(csvRows, { delimiter: ';' });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bericht_${format(dateFrom, 'yyyy-MM-dd')}_${format(dateTo, 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [reportData, dateFrom, dateTo]);

  const summary = reportData?.summary;
  const hasActiveFilters = selectedMitarbeiter.length > 0 || selectedKunden.length > 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Berichte</h1>
        <p className="text-muted-foreground">
          Zeitraum: {format(dateFrom, 'dd.MM.yyyy', { locale: de })} &ndash; {format(dateTo, 'dd.MM.yyyy', { locale: de })}
        </p>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <DatePicker label="Von" date={dateFrom} onDateChange={setDateFrom} />
            <span className="text-muted-foreground">&ndash;</span>
            <DatePicker label="Bis" date={dateTo} onDateChange={setDateTo} />
            <Separator orientation="vertical" className="h-8 hidden md:block" />
            <MultiFilter label="Mitarbeiter" options={mitarbeiterOptions ?? []} selected={selectedMitarbeiter} onSelectionChange={setSelectedMitarbeiter} isLoading={mitarbeiterLoading} />
            <MultiFilter label="Kunden" options={kundenOptions ?? []} selected={selectedKunden} onSelectionChange={setSelectedKunden} isLoading={kundenLoading} />
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={() => { setSelectedMitarbeiter([]); setSelectedKunden([]); }}>
                <X className="mr-1 h-3 w-3" />Filter zurücksetzen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="termine">Termine & Stunden</TabsTrigger>
          <TabsTrigger value="auslastung">Auslastung</TabsTrigger>
          <TabsTrigger value="kunden">Kunden-Statistik</TabsTrigger>
          <TabsTrigger value="regional">Regional</TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Termine & Stunden ──────────────────────────── */}
        <TabsContent value="termine" className="space-y-6 mt-4">
          {reportLoading && <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
          {isError && <Card><CardContent className="pt-6"><p className="text-destructive">Fehler beim Laden der Daten.</p></CardContent></Card>}
          {reportData && !reportLoading && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard title="Gesamt-Termine" value={summary?.gesamtTermine ?? 0} subtitle="im gewählten Zeitraum" icon={CalendarDays} />
                <SummaryCard title="Gesamt-Stunden" value={summary?.gesamtStunden ?? 0} subtitle="ohne stornierte Termine" icon={Clock} />
                <SummaryCard title="Durchschnitt / MA" value={`${summary?.durchschnittProMitarbeiter ?? 0} h`} subtitle="Stunden pro Mitarbeiter" icon={Users} />
                <SummaryCard title="Stornoquote" value={`${summary?.stornoquote ?? 0}%`} subtitle="storniert / abgesagt" icon={TrendingDown} />
              </div>

              {chartData.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Stunden pro Mitarbeiter</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="mitarbeiterName" tick={{ fontSize: 12 }} angle={-35} textAnchor="end" interval={0} className="fill-muted-foreground" />
                          <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" label={{ value: 'Stunden', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }} />
                          <Tooltip content={<EmployeeChartTooltip />} />
                          <Bar dataKey="gesamtStunden" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Detailliste</CardTitle>
                  <Button variant="outline" size="sm" onClick={handleCsvExport} disabled={!reportData.termine.length}>
                    <Download className="mr-2 h-4 w-4" />CSV Export
                  </Button>
                </CardHeader>
                <CardContent>
                  {reportData.termine.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Keine Termine im gewählten Zeitraum gefunden.</p>
                  ) : (
                    <ScrollArea className="max-h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Datum</TableHead>
                            <TableHead>Zeit</TableHead>
                            <TableHead>Kunde</TableHead>
                            <TableHead>Mitarbeiter</TableHead>
                            <TableHead className="text-right">Dauer (h)</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.termine.map((t) => (
                            <TableRow key={t.id}>
                              <TableCell className="whitespace-nowrap">{format(new Date(t.startAt), 'dd.MM.yyyy', { locale: de })}</TableCell>
                              <TableCell className="whitespace-nowrap">{format(new Date(t.startAt), 'HH:mm')} &ndash; {format(new Date(t.endAt), 'HH:mm')}</TableCell>
                              <TableCell>{t.kundenName}</TableCell>
                              <TableCell>{t.mitarbeiterName}</TableCell>
                              <TableCell className="text-right font-mono">{t.dauerStunden.toFixed(2)}</TableCell>
                              <TableCell><Badge variant={STATUS_VARIANTS[t.status] ?? 'outline'}>{STATUS_LABELS[t.status] ?? t.status}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ─── Tab 2: Auslastung ─────────────────────────────────── */}
        <TabsContent value="auslastung" className="space-y-6 mt-4">
          {auslastungLoading && <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
          {auslastungData && !auslastungLoading && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <SummaryCard title="Mitarbeiter aktiv" value={auslastungData.length} subtitle="mit Terminen im Zeitraum" icon={Users} />
                <SummaryCard
                  title="Ø Auslastung"
                  value={`${auslastungData.length > 0 ? Math.round(auslastungData.reduce((s, a) => s + a.auslastungProzent, 0) / auslastungData.filter(a => a.sollStunden > 0).length || 0) : 0}%`}
                  subtitle="Ist-Stunden / Soll-Stunden"
                  icon={Clock}
                />
                <SummaryCard
                  title="Gesamt Ist-Stunden"
                  value={`${auslastungData.reduce((s, a) => s + a.istStunden, 0).toFixed(1)} h`}
                  subtitle="alle Mitarbeiter"
                  icon={CalendarDays}
                />
              </div>

              <Card>
                <CardHeader><CardTitle>Soll vs. Ist-Stunden pro Mitarbeiter</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={auslastungData} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-35} textAnchor="end" interval={0} className="fill-muted-foreground" />
                        <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" label={{ value: 'Stunden', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }} />
                        <Tooltip content={({ active, payload }: { active?: boolean; payload?: any[] }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="rounded-lg border bg-background p-3 shadow-md">
                              <p className="font-medium">{d.name}</p>
                              <p className="text-sm text-muted-foreground">Soll: {d.sollStunden} h</p>
                              <p className="text-sm text-muted-foreground">Ist: {d.istStunden} h</p>
                              <p className="text-sm font-medium">{d.auslastungProzent}% Auslastung</p>
                            </div>
                          );
                        }} />
                        <Legend />
                        <Bar dataKey="sollStunden" name="Soll-Stunden" fill="hsl(var(--muted-foreground))" opacity={0.3} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="istStunden" name="Ist-Stunden" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Auslastung Detail</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mitarbeiter</TableHead>
                        <TableHead className="text-right">Soll (h)</TableHead>
                        <TableHead className="text-right">Ist (h)</TableHead>
                        <TableHead className="text-right">Auslastung</TableHead>
                        <TableHead className="text-right">Termine</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auslastungData.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.name}</TableCell>
                          <TableCell className="text-right font-mono">{a.sollStunden}</TableCell>
                          <TableCell className="text-right font-mono">{a.istStunden}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={a.auslastungProzent > 100 ? 'destructive' : a.auslastungProzent >= 80 ? 'default' : 'secondary'}>
                              {a.auslastungProzent}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{a.anzahlTermine}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ─── Tab 3: Kunden-Statistik ───────────────────────────── */}
        <TabsContent value="kunden" className="space-y-6 mt-4">
          {kundenLoading2 && <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
          {kundenStatistik && !kundenLoading2 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard title="Gesamt-Kunden" value={kundenStatistik.gesamt} subtitle="alle Kategorien" icon={Users} />
                <SummaryCard title="Aktive Kunden" value={kundenStatistik.aktiv} subtitle="aktiv betreut" icon={UserCheck} />
                <SummaryCard title="Inaktive Kunden" value={kundenStatistik.inaktiv} subtitle="nicht mehr aktiv" icon={UserX} />
                <SummaryCard title="Interessenten" value={kundenStatistik.interessenten} subtitle="potenzielle Neukunden" icon={Heart} />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {kundenStatistik.pflegegradVerteilung.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>Pflegegrad-Verteilung</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={kundenStatistik.pflegegradVerteilung}
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              dataKey="anzahl"
                              nameKey="pflegegrad"
                              label={({ pflegegrad, anzahl }) => `${pflegegrad}: ${anzahl}`}
                            >
                              {kundenStatistik.pflegegradVerteilung.map((_, i) => (
                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {kundenStatistik.kassePrivatVerteilung.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>Kasse / Privat Verteilung</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={kundenStatistik.kassePrivatVerteilung} margin={{ top: 5, right: 20, left: 10, bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="typ" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                            <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="anzahl" name="Anzahl" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Card>
                <CardHeader><CardTitle>Pflegegrad-Details</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pflegegrad</TableHead>
                        <TableHead className="text-right">Anzahl Kunden</TableHead>
                        <TableHead className="text-right">Anteil</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kundenStatistik.pflegegradVerteilung.map((pg) => (
                        <TableRow key={pg.pflegegrad}>
                          <TableCell className="font-medium">{pg.pflegegrad}</TableCell>
                          <TableCell className="text-right font-mono">{pg.anzahl}</TableCell>
                          <TableCell className="text-right font-mono">
                            {kundenStatistik.gesamt > 0 ? Math.round((pg.anzahl / kundenStatistik.gesamt) * 100) : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ─── Tab 5: Regional (Stadtteil) ──────────────────────── */}
        <TabsContent value="regional" className="space-y-6 mt-4">
          {reportData && (() => {
            const activeTermine = reportData.termine.filter(t => !['cancelled', 'abgesagt_rechtzeitig'].includes(t.status));
            const stadtteilMap = new Map<string, { termine: number; stunden: number }>();
            for (const t of activeTermine) {
              const key = t.kundenStadtteil || 'Unbekannt';
              const existing = stadtteilMap.get(key) ?? { termine: 0, stunden: 0 };
              stadtteilMap.set(key, { termine: existing.termine + 1, stunden: existing.stunden + t.dauerStunden });
            }
            const stadtteilData = Array.from(stadtteilMap.entries())
              .map(([name, data]) => ({ name, ...data }))
              .sort((a, b) => b.stunden - a.stunden);

            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <SummaryCard title="Stadtteile" value={stadtteilData.length} subtitle="mit Einsaetzen" icon={TrendingUp} />
                  <SummaryCard title="Gesamt Stunden" value={`${Math.round(activeTermine.reduce((s, t) => s + t.dauerStunden, 0))}h`} subtitle="alle Stadtteile" icon={Clock} />
                  <SummaryCard title="Top-Stadtteil" value={stadtteilData[0]?.name ?? '–'} subtitle={stadtteilData[0] ? `${Math.round(stadtteilData[0].stunden)}h` : ''} icon={Users} />
                </div>

                {stadtteilData.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>Stunden nach Stadtteil</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stadtteilData} layout="vertical" margin={{ left: 100 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={(v) => `${v}h`} />
                            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(val: number) => `${val.toFixed(1)}h`} />
                            <Bar dataKey="stunden" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader><CardTitle>Detail nach Stadtteil</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Stadtteil</TableHead>
                          <TableHead className="text-right">Termine</TableHead>
                          <TableHead className="text-right">Stunden</TableHead>
                          <TableHead className="text-right">Anteil</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stadtteilData.map((s) => {
                          const totalH = activeTermine.reduce((sum, t) => sum + t.dauerStunden, 0);
                          const pct = totalH > 0 ? ((s.stunden / totalH) * 100).toFixed(1) : '0';
                          return (
                            <TableRow key={s.name}>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              <TableCell className="text-right">{s.termine}</TableCell>
                              <TableCell className="text-right">{s.stunden.toFixed(1)}h</TableCell>
                              <TableCell className="text-right">{pct}%</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
