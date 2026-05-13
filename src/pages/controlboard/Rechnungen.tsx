import { useState, useMemo } from 'react';
import { format, subMonths, startOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  FileText,
  Search,
  X,
  Loader2,
  MoreHorizontal,
  Eye,
  FileDown,
  CheckCircle2,
  Send,
  Ban,
  BadgeCheck,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUserRole } from '@/hooks/useUserRole';
import { useRechnungen, type Rechnung } from '@/hooks/useRechnungen';
import { exportRechnungPdf } from '@/components/rechnungen/RechnungPdfExport';
import { useRechnungspositionen } from '@/hooks/useRechnungen';
import RechnungDetailSheet from '@/components/rechnungen/RechnungDetailSheet';
import type { Database } from '@/integrations/supabase/types';

type RechnungStatus = Database['public']['Enums']['rechnung_status'];

const STATUS_LABELS: Record<RechnungStatus, string> = {
  entwurf: 'Entwurf',
  freigegeben: 'Freigegeben',
  versendet: 'Versendet',
  bezahlt: 'Bezahlt',
  storniert: 'Storniert',
};

const STATUS_CLASSES: Record<RechnungStatus, string> = {
  entwurf: 'bg-gray-100 text-gray-700 border-gray-200',
  freigegeben: 'bg-blue-100 text-blue-700 border-blue-200',
  versendet: 'bg-amber-100 text-amber-700 border-amber-200',
  bezahlt: 'bg-green-100 text-green-700 border-green-200',
  storniert: 'bg-red-100 text-red-700 border-red-200',
};

function formatCurrency(value: number): string {
  return `€ ${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateRange(von: string, bis: string): string {
  const fmt = (d: string) => format(new Date(d), 'dd.MM.yyyy', { locale: de });
  return `${fmt(von)} – ${fmt(bis)}`;
}

function buildMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(startOfMonth(now), i);
    options.push({
      value: format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy', { locale: de }),
    });
  }
  return options;
}

// Sub-component: handles PDF export with lazy positionen load
function PdfExportAction({ rechnung }: { rechnung: Rechnung }) {
  const [triggered, setTriggered] = useState(false);
  const { data: positionen } = useRechnungspositionen(triggered ? rechnung.id : null);

  const handleClick = () => {
    if (positionen) {
      exportRechnungPdf(rechnung, positionen);
    } else {
      setTriggered(true);
    }
  };

  useMemo(() => {
    if (triggered && positionen) {
      exportRechnungPdf(rechnung, positionen);
    }
  }, [triggered, positionen]);

  return (
    <DropdownMenuItem onClick={handleClick}>
      <FileDown className="h-4 w-4 mr-2" />
      PDF exportieren
    </DropdownMenuItem>
  );
}

export default function Rechnungen() {
  const { isGeschaeftsfuehrer, isBuchhaltung } = useUserRole();
  const { rechnungen, isLoading, updateStatus, isUpdating, storno } = useRechnungen();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RechnungStatus | 'alle'>('alle');
  const [monthFilter, setMonthFilter] = useState<string>('alle');
  const [selectedRechnung, setSelectedRechnung] = useState<Rechnung | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [stornoTarget, setStornoTarget] = useState<string | null>(null);

  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const canRead = isGeschaeftsfuehrer || isBuchhaltung;

  const filteredRechnungen = useMemo(() => {
    if (!rechnungen) return [];
    let result = [...rechnungen];

    if (statusFilter !== 'alle') {
      result = result.filter((r) => r.status === statusFilter);
    }

    if (monthFilter !== 'alle') {
      result = result.filter((r) => r.abrechnungszeitraum_von.startsWith(monthFilter));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.rechnungsnummer.toLowerCase().includes(q) ||
          r.empfaenger_name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [rechnungen, statusFilter, monthFilter, searchQuery]);

  const stats = useMemo(() => {
    if (!rechnungen) return { entwurf: 0, freigegeben: 0, versendet: 0, bezahlt: 0, entwurfBetrag: 0, freigegebenBetrag: 0, versendetBetrag: 0, bezahltBetrag: 0 };
    const sum = (status: RechnungStatus) => rechnungen.filter((r) => r.status === status).reduce((acc, r) => acc + r.brutto_betrag, 0);
    return {
      entwurf: rechnungen.filter((r) => r.status === 'entwurf').length,
      freigegeben: rechnungen.filter((r) => r.status === 'freigegeben').length,
      versendet: rechnungen.filter((r) => r.status === 'versendet').length,
      bezahlt: rechnungen.filter((r) => r.status === 'bezahlt').length,
      entwurfBetrag: sum('entwurf'),
      freigegebenBetrag: sum('freigegeben'),
      versendetBetrag: sum('versendet'),
      bezahltBetrag: sum('bezahlt'),
    };
  }, [rechnungen]);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('alle');
    setMonthFilter('alle');
  };

  const handleUpdateStatus = (id: string, status: RechnungStatus) => {
    updateStatus({ id, status });
    if (selectedRechnung?.id === id) {
      setSelectedRechnung((prev) => prev ? { ...prev, status } : null);
    }
  };

  const handleStorno = (id: string) => {
    setStornoTarget(id);
  };

  const confirmStorno = () => {
    if (stornoTarget) {
      storno(stornoTarget);
      if (selectedRechnung?.id === stornoTarget) {
        setSelectedRechnung((prev) => prev ? { ...prev, status: 'storniert' } : null);
      }
      setStornoTarget(null);
    }
  };

  if (!canRead) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Kein Zugriff</p>
          <p className="text-sm text-muted-foreground mt-1">
            Sie haben keine Berechtigung, Rechnungen einzusehen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Rechnungsverwaltung</h1>
        <p className="text-sm text-muted-foreground">Rechnungen aus Abrechnungsläufen verwalten und exportieren</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Entwurf', count: stats.entwurf, betrag: stats.entwurfBetrag, colorClass: 'text-gray-600', bgClass: 'bg-gray-100' },
          { label: 'Freigegeben', count: stats.freigegeben, betrag: stats.freigegebenBetrag, colorClass: 'text-blue-600', bgClass: 'bg-blue-100' },
          { label: 'Versendet', count: stats.versendet, betrag: stats.versendetBetrag, colorClass: 'text-amber-600', bgClass: 'bg-amber-100' },
          { label: 'Bezahlt', count: stats.bezahlt, betrag: stats.bezahltBetrag, colorClass: 'text-green-600', bgClass: 'bg-green-100' },
        ].map((s) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`rounded-lg p-2 ${s.bgClass}`}>
                <FileText className={`h-4 w-4 ${s.colorClass}`} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-xs font-medium ${s.colorClass}`}>{formatCurrency(s.betrag)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Table Card */}
      <div className="flex-1 min-h-0">
        <Card className="flex flex-col min-h-0 border-border/60">
          {/* Filter Bar */}
          <div className="p-3 border-b border-border flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechnungsnr. oder Empfänger suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Zeitraum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Zeiträume</SelectItem>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RechnungStatus | 'alle')}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Status</SelectItem>
                <SelectItem value="entwurf">Entwurf</SelectItem>
                <SelectItem value="freigegeben">Freigegeben</SelectItem>
                <SelectItem value="versendet">Versendet</SelectItem>
                <SelectItem value="bezahlt">Bezahlt</SelectItem>
                <SelectItem value="storniert">Storniert</SelectItem>
              </SelectContent>
            </Select>

            {(searchQuery || statusFilter !== 'alle' || monthFilter !== 'alle') && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-muted-foreground">
                <X className="h-3.5 w-3.5 mr-1" />
                Zurücksetzen
              </Button>
            )}

            <span className="text-xs text-muted-foreground whitespace-nowrap ml-auto">
              {filteredRechnungen.length} Ergebnisse
            </span>
          </div>

          {/* Table */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !filteredRechnungen.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground">Noch keine Rechnungen vorhanden</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {rechnungen?.length
                    ? 'Passe deine Filter an.'
                    : 'Starte einen Abrechnungslauf im Budgettracker, um Rechnungen zu erzeugen.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Rechnungsnr.</TableHead>
                    <TableHead>Empfänger</TableHead>
                    <TableHead>Zeitraum</TableHead>
                    <TableHead className="text-right">Netto</TableHead>
                    <TableHead className="text-right">MwSt</TableHead>
                    <TableHead className="text-right">Brutto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRechnungen.map((r) => {
                    const canFreigeben = isGeschaeftsfuehrer && r.status === 'entwurf';
                    const canVersendet = isGeschaeftsfuehrer && r.status === 'freigegeben';
                    const canBezahlt = (isGeschaeftsfuehrer || isBuchhaltung) && r.status === 'versendet';
                    const canStorno =
                      isGeschaeftsfuehrer &&
                      r.status !== 'storniert' &&
                      r.status !== 'bezahlt';

                    return (
                      <TableRow key={r.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-sm">{r.rechnungsnummer}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{r.empfaenger_name}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatDateRange(r.abrechnungszeitraum_von, r.abrechnungszeitraum_bis)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatCurrency(r.netto_betrag)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                          {r.mwst_betrag > 0 ? formatCurrency(r.mwst_betrag) : '–'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-semibold">
                          {formatCurrency(r.brutto_betrag)}
                        </TableCell>
                        <TableCell>
                          <Badge className={`border text-xs ${STATUS_CLASSES[r.status]}`}>
                            {STATUS_LABELS[r.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => { setSelectedRechnung(r); setSheetOpen(true); }}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Details anzeigen
                              </DropdownMenuItem>
                              <PdfExportAction rechnung={r} />

                              {(canFreigeben || canVersendet || canBezahlt || canStorno) && (
                                <DropdownMenuSeparator />
                              )}

                              {canFreigeben && (
                                <DropdownMenuItem
                                  onClick={() => handleUpdateStatus(r.id, 'freigegeben')}
                                  disabled={isUpdating}
                                >
                                  <BadgeCheck className="h-4 w-4 mr-2" />
                                  Freigeben
                                </DropdownMenuItem>
                              )}
                              {canVersendet && (
                                <DropdownMenuItem
                                  onClick={() => handleUpdateStatus(r.id, 'versendet')}
                                  disabled={isUpdating}
                                >
                                  <Send className="h-4 w-4 mr-2" />
                                  Als versendet markieren
                                </DropdownMenuItem>
                              )}
                              {canBezahlt && (
                                <DropdownMenuItem
                                  onClick={() => handleUpdateStatus(r.id, 'bezahlt')}
                                  disabled={isUpdating}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Als bezahlt markieren
                                </DropdownMenuItem>
                              )}

                              {canStorno && <DropdownMenuSeparator />}
                              {canStorno && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleStorno(r.id)}
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Stornieren
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </Card>
      </div>

      {/* Detail Sheet */}
      <RechnungDetailSheet
        rechnung={selectedRechnung}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onUpdateStatus={handleUpdateStatus}
        onStorno={handleStorno}
        isUpdating={isUpdating}
      />

      {/* Storno Confirm Dialog */}
      <AlertDialog open={!!stornoTarget} onOpenChange={(o) => { if (!o) setStornoTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechnung stornieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Die Rechnung wird als storniert markiert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmStorno}
            >
              Stornieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
