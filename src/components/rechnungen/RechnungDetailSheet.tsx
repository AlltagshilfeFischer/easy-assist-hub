import { useMemo } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  FileDown,
  AlertTriangle,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUserRole } from '@/hooks/useUserRole';
import { useRechnungspositionen, type Rechnung } from '@/hooks/useRechnungen';
import { exportRechnungPdf } from '@/components/rechnungen/RechnungPdfExport';
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

function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'dd.MM.yyyy', { locale: de });
}

const LEISTUNGSART_LABELS: Record<string, string> = {
  kombileistung: 'Kombileistung',
  entlastungsbetrag: 'Entlastungsbetrag',
  verhinderungspflege: 'Verhinderungspflege',
  privat: 'Privat',
  pflegesachleistung: 'Pflegesachleistung',
  kurzzeitpflege: 'Kurzzeitpflege',
  sonstige: 'Sonstige',
};

interface Props {
  rechnung: Rechnung | null;
  open: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, status: RechnungStatus) => void;
  onStorno: (id: string) => void;
  isUpdating: boolean;
}

export default function RechnungDetailSheet({
  rechnung,
  open,
  onClose,
  onUpdateStatus,
  onStorno,
  isUpdating,
}: Props) {
  const { isGeschaeftsfuehrer, isBuchhaltung } = useUserRole();
  const { data: positionen, isLoading: isLoadingPositionen } = useRechnungspositionen(
    open ? rechnung?.id ?? null : null
  );

  const validierungsWarnungen = useMemo(() => {
    if (!rechnung?.validierung_warnungen) return [];
    const val = rechnung.validierung_warnungen;
    if (Array.isArray(val)) return val as string[];
    return [];
  }, [rechnung?.validierung_warnungen]);

  const handlePdfExport = async () => {
    if (!rechnung || !positionen) return;
    await exportRechnungPdf(rechnung, positionen);
  };

  if (!rechnung) return null;

  const canFreigeben = isGeschaeftsfuehrer && rechnung.status === 'entwurf';
  const canVersendet = isGeschaeftsfuehrer && rechnung.status === 'freigegeben';
  const canBezahlt = (isGeschaeftsfuehrer || isBuchhaltung) && rechnung.status === 'versendet';
  const canStorno =
    isGeschaeftsfuehrer &&
    rechnung.status !== 'storniert' &&
    rechnung.status !== 'bezahlt';

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-[650px] flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-lg font-bold truncate">
                {rechnung.rechnungsnummer}
              </SheetTitle>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {rechnung.empfaenger_name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(rechnung.abrechnungszeitraum_von)} –{' '}
                {formatDate(rechnung.abrechnungszeitraum_bis)}
              </p>
            </div>
            <Badge className={`shrink-0 border ${STATUS_CLASSES[rechnung.status]}`}>
              {STATUS_LABELS[rechnung.status]}
            </Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-5">
            {/* Betragsübersicht */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Netto</p>
                <p className="font-semibold text-sm">{formatCurrency(rechnung.netto_betrag)}</p>
              </div>
              {rechnung.mwst_betrag > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    MwSt ({Math.round(rechnung.mwst_satz * 100)}%)
                  </p>
                  <p className="font-semibold text-sm">{formatCurrency(rechnung.mwst_betrag)}</p>
                </div>
              )}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Brutto</p>
                <p className="font-bold text-sm text-primary">
                  {formatCurrency(rechnung.brutto_betrag)}
                </p>
              </div>
            </div>

            {/* Validierungswarnungen */}
            {validierungsWarnungen.length > 0 && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription>
                  <p className="font-medium text-amber-800 mb-1">Validierungshinweise</p>
                  <ul className="space-y-0.5">
                    {validierungsWarnungen.map((w, i) => (
                      <li key={i} className="text-xs text-amber-700">
                        {String(w)}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            {/* Positionen */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Leistungspositionen</h3>
              {isLoadingPositionen ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !positionen?.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Keine Positionen vorhanden
                </p>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent bg-muted/30">
                        <TableHead className="text-xs">Datum</TableHead>
                        <TableHead className="text-xs">Leistungsart</TableHead>
                        <TableHead className="text-xs text-right">Std.</TableHead>
                        <TableHead className="text-xs text-right">€/h</TableHead>
                        <TableHead className="text-xs text-right">Betrag</TableHead>
                        <TableHead className="text-xs text-center">OK</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {positionen.map((pos) => (
                        <TableRow key={pos.id} className="hover:bg-muted/20">
                          <TableCell className="text-xs">
                            {formatDate(pos.leistungsdatum)}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-xs font-normal">
                              {LEISTUNGSART_LABELS[pos.leistungsart] ?? pos.leistungsart}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {pos.stunden.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {pos.stundensatz.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums font-medium">
                            {formatCurrency(pos.einzelbetrag)}
                          </TableCell>
                          <TableCell className="text-center">
                            {pos.ist_gueltig ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 inline" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-destructive inline" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <Separator />

            {/* Metadaten */}
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>
                Erstellt am: {formatDate(rechnung.created_at)}
              </p>
              {rechnung.freigegeben_am && (
                <p>Freigegeben am: {formatDate(rechnung.freigegeben_am)}</p>
              )}
              {rechnung.versendet_am && (
                <p>Versendet am: {formatDate(rechnung.versendet_am)}</p>
              )}
              {rechnung.bezahlt_am && (
                <p>Bezahlt am: {formatDate(rechnung.bezahlt_am)}</p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={handlePdfExport}
              disabled={!positionen}
            >
              <FileDown className="h-4 w-4" />
              PDF exportieren
            </Button>
            <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
              Schließen
            </Button>
          </div>

          {(canFreigeben || canVersendet || canBezahlt || canStorno) && (
            <div className="flex gap-2 flex-wrap">
              {canFreigeben && (
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={isUpdating}
                  onClick={() => onUpdateStatus(rechnung.id, 'freigegeben')}
                >
                  {isUpdating && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  Freigeben
                </Button>
              )}
              {canVersendet && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={isUpdating}
                  onClick={() => onUpdateStatus(rechnung.id, 'versendet')}
                >
                  {isUpdating && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  Als versendet markieren
                </Button>
              )}
              {canBezahlt && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={isUpdating}
                  onClick={() => onUpdateStatus(rechnung.id, 'bezahlt')}
                >
                  {isUpdating && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  Als bezahlt markieren
                </Button>
              )}
              {canStorno && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  disabled={isUpdating}
                  onClick={() => onStorno(rechnung.id)}
                >
                  Stornieren
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
