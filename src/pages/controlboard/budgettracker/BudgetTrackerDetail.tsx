import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getYear, getMonth, format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { ArrowLeft, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useCustomers } from '@/hooks/useCustomers';
import { useBudgetTransactionsByClientYear, useUpdateTransactionAllocation } from '@/hooks/useBudgetTransactions';
import { useTariffs } from '@/hooks/useTariffs';
import { useCareLevels } from '@/hooks/useCareLevels';
import {
  formatCurrency,
  isPrivateInsured,
  aggregateConsumed,
  buildAvailability,
  calculateTransactionAmount,
  hasExpiryWarning,
} from '@/lib/pflegebudget/budgetCalculations';
import type { BudgetTransaction, ServiceType } from '@/types/domain';

// ─── Konstanten ──────────────────────────────────────────────

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  ENTLASTUNG: 'Entlastung',
  KOMBI: 'Kombi',
  VERHINDERUNG: 'VP',
  PRIVAT: 'Privat',
};

const SERVICE_TYPE_COLORS: Record<ServiceType, string> = {
  ENTLASTUNG: 'bg-blue-100 text-blue-800',
  KOMBI: 'bg-purple-100 text-purple-800',
  VERHINDERUNG: 'bg-green-100 text-green-800',
  PRIVAT: 'bg-gray-100 text-gray-800',
};

// ─── Hilfskomponenten ────────────────────────────────────────

function BudgetSummaryCard({
  title,
  consumed,
  available,
  total,
  extra,
  warning,
}: {
  title: string;
  consumed: number;
  available: number;
  total: number;
  extra?: string;
  warning?: string;
}) {
  const percentage = total > 0 ? Math.round((consumed / total) * 100) : 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-bold">{formatCurrency(available)}</div>
        <p className="text-xs text-muted-foreground">verfügbar</p>
        <div className="relative overflow-hidden bg-secondary rounded-full w-full h-2">
          <div
            className={`h-full rounded-full transition-all ${percentage >= 100 ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(consumed)} verbraucht von {formatCurrency(total)}
        </p>
        {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
        {warning && (
          <div className="flex items-center gap-1 text-xs text-orange-600">
            <AlertTriangle className="h-3 w-3" />
            {warning}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ServiceTypeBadge({
  type,
  billed,
  onChangeType,
}: {
  type: ServiceType;
  billed: boolean;
  onChangeType?: (newType: ServiceType) => void;
}) {
  if (billed || !onChangeType) {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SERVICE_TYPE_COLORS[type]}`}>
        {SERVICE_TYPE_LABELS[type]}
      </span>
    );
  }

  return (
    <Select value={type} onValueChange={(v) => onChangeType(v as ServiceType)}>
      <SelectTrigger className={`h-6 px-2 text-xs border-0 ${SERVICE_TYPE_COLORS[type]} w-28`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(['ENTLASTUNG', 'KOMBI', 'VERHINDERUNG', 'PRIVAT'] as ServiceType[]).map((t) => (
          <SelectItem key={t} value={t} className="text-xs">
            {SERVICE_TYPE_LABELS[t]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Monatszeile mit expandierbaren Transaktionen ────────────

interface MonthData {
  month: number; // 1-12
  transactions: BudgetTransaction[];
  totalHours: number;
  totalVisits: number;
  entlastungAmount: number;
  kombiAmount: number;
  vpAmount: number;
  privatAmount: number;
  hasBilled: boolean;
  hasOpen: boolean;
}

function MonthRow({
  data,
  tariffs,
  onChangeType,
}: {
  data: MonthData;
  tariffs: ReturnType<typeof useTariffs>['data'];
  onChangeType: (txId: string, newType: ServiceType) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasTransactions = data.transactions.length > 0;

  return (
    <>
      <TableRow
        className={`${hasTransactions ? 'cursor-pointer hover:bg-muted/40' : 'opacity-50'}`}
        onClick={() => hasTransactions && setExpanded((v) => !v)}
      >
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {hasTransactions ? (
              expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <span className="w-4" />
            )}
            {MONTH_NAMES[data.month - 1]}
          </div>
        </TableCell>
        <TableCell className="text-right">{hasTransactions ? `${data.totalHours.toFixed(1)} h` : '—'}</TableCell>
        <TableCell className="text-right">{hasTransactions ? data.totalVisits : '—'}</TableCell>
        <TableCell className="text-right">{data.entlastungAmount > 0 ? formatCurrency(data.entlastungAmount) : <span className="text-muted-foreground">—</span>}</TableCell>
        <TableCell className="text-right">{data.kombiAmount > 0 ? formatCurrency(data.kombiAmount) : <span className="text-muted-foreground">—</span>}</TableCell>
        <TableCell className="text-right">{data.vpAmount > 0 ? formatCurrency(data.vpAmount) : <span className="text-muted-foreground">—</span>}</TableCell>
        <TableCell className="text-right">{data.privatAmount > 0 ? formatCurrency(data.privatAmount) : <span className="text-muted-foreground">—</span>}</TableCell>
        <TableCell className="text-center">
          {hasTransactions && (
            <div className="flex items-center justify-center gap-1">
              {data.hasBilled && <span className="text-xs text-green-600">✓</span>}
              {data.hasOpen && <span className="text-xs text-yellow-600">○</span>}
            </div>
          )}
        </TableCell>
      </TableRow>

      {expanded && data.transactions.map((tx) => (
        <TableRow key={tx.id} className="bg-muted/20 text-sm">
          <TableCell className="pl-12 text-muted-foreground">
            {format(parseISO(tx.service_date), 'dd.MM.', { locale: de })}
          </TableCell>
          <TableCell className="text-right">{tx.hours.toFixed(1)} h</TableCell>
          <TableCell className="text-right">{tx.visits}</TableCell>
          <TableCell colSpan={3} />
          <TableCell className="text-right font-medium">
            {formatCurrency(tx.total_amount)}
          </TableCell>
          <TableCell>
            <div className="flex items-center justify-between gap-2">
              <ServiceTypeBadge
                type={tx.service_type}
                billed={tx.billed}
                onChangeType={!tx.billed ? (newType) => onChangeType(tx.id, newType) : undefined}
              />
              {tx.billed && <span className="text-xs text-green-600 whitespace-nowrap">✓ abg.</span>}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ─── Hauptkomponente ─────────────────────────────────────────

export default function BudgetTrackerDetail() {
  const { kundenId } = useParams<{ kundenId: string }>();
  const navigate = useNavigate();
  const now = new Date();
  const currentYear = getYear(now);
  const currentMonth = getMonth(now) + 1;

  const { data: customers = [] } = useCustomers({ onlyActive: true });
  const { data: transactions = [] } = useBudgetTransactionsByClientYear(kundenId, currentYear);
  const { data: tariffs = [] } = useTariffs();
  const { data: careLevels = [] } = useCareLevels();
  const updateAllocation = useUpdateTransactionAllocation();

  const kunde = customers.find((c) => c.id === kundenId);
  const kundeExtended = kunde as typeof kunde & {
    entlastung_genehmigt?: boolean | null;
    verhinderungspflege_genehmigt?: boolean | null;
    pflegesachleistung_genehmigt?: boolean | null;
    initial_budget_entlastung?: number | null;
  };

  // ─── Berechnungen ────────────────────────────────────────

  const { availability, consumedYear, privatConsumed, expiryWarning } = useMemo(() => {
    if (!kunde || !tariffs.length || !careLevels.length) {
      return { availability: null, consumedYear: { ENTLASTUNG: 0, KOMBI: 0, VERHINDERUNG: 0 }, privatConsumed: 0, expiryWarning: false };
    }

    const billedTx = transactions.filter((tx) => tx.billed);
    const consumedYearData = aggregateConsumed(billedTx, tariffs, true);

    const currentMonthBilledTx = billedTx.filter((tx) => {
      const d = new Date(tx.service_date);
      return getMonth(d) + 1 === currentMonth;
    });
    const consumedKombiMonth = aggregateConsumed(
      currentMonthBilledTx.filter((tx) => tx.service_type === 'KOMBI'),
      tariffs,
      true,
    ).KOMBI;

    const avail = buildAvailability(
      kundeExtended!,
      consumedYearData,
      consumedKombiMonth,
      careLevels,
      currentMonth,
      currentYear,
    );

    const privat = transactions
      .filter((tx) => tx.service_type === 'PRIVAT')
      .reduce((sum, tx) => sum + tx.total_amount, 0);

    const expiry = hasExpiryWarning(
      kundeExtended?.initial_budget_entlastung,
      consumedYearData.ENTLASTUNG,
      currentMonth,
    );

    return { availability: avail, consumedYear: consumedYearData, privatConsumed: privat, expiryWarning: expiry };
  }, [kunde, transactions, tariffs, careLevels, currentMonth, currentYear]);

  // ─── Monatstabelle aufbauen ──────────────────────────────

  const monthData: MonthData[] = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthTx = transactions.filter((tx) => {
        const d = new Date(tx.service_date);
        return getMonth(d) + 1 === month;
      });

      const totalHours = monthTx.reduce((s, tx) => s + tx.hours, 0);
      const totalVisits = monthTx.reduce((s, tx) => s + tx.visits, 0);

      const byType = (type: ServiceType) =>
        monthTx
          .filter((tx) => tx.service_type === type)
          .reduce((s, tx) => s + tx.total_amount, 0);

      return {
        month,
        transactions: monthTx,
        totalHours,
        totalVisits,
        entlastungAmount: byType('ENTLASTUNG'),
        kombiAmount: byType('KOMBI'),
        vpAmount: byType('VERHINDERUNG'),
        privatAmount: byType('PRIVAT'),
        hasBilled: monthTx.some((tx) => tx.billed),
        hasOpen: monthTx.some((tx) => !tx.billed),
      };
    });
  }, [transactions]);

  // ─── Umbuchung ───────────────────────────────────────────

  const handleChangeType = (txId: string, newType: ServiceType) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx || !tariffs.length) return;

    const { hourlyRate, travelFlatTotal, totalAmount } = calculateTransactionAmount(
      tx.hours,
      tx.visits,
      newType,
      tariffs,
    );

    updateAllocation.mutate({ id: txId, serviceType: newType, hourlyRate, travelFlatTotal, totalAmount });
  };

  // ─── Loading / Not found ─────────────────────────────────

  if (!kunde) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={() => navigate('/dashboard/controlboard/budgettracker')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <p className="text-muted-foreground">Klient nicht gefunden.</p>
      </div>
    );
  }

  const isPrivate = isPrivateInsured(kunde.versichertennummer);
  const fullName = `${kunde.nachname ?? ''}, ${kunde.vorname ?? ''}`.trim().replace(/^,\s*/, '');

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb / Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/controlboard/budgettracker')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Budgettracker
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold">{fullName}</span>
      </div>

      <div className="flex items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">PG {kunde.pflegegrad ?? '—'}</Badge>
            {kunde.pflegekasse && <span className="text-sm text-muted-foreground">{kunde.pflegekasse}</span>}
            {isPrivate && <Badge variant="secondary">Privatversichert</Badge>}
            {expiryWarning && (
              <div className="flex items-center gap-1 text-sm text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                Vorjahresrest läuft bald ab
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Budget-Summary-Cards */}
      {availability && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <BudgetSummaryCard
            title="Entlastungsbetrag"
            consumed={consumedYear.ENTLASTUNG}
            available={availability.entlastungAvailable}
            total={availability.entlastungYearlyTotal}
            extra={availability.expiringCarryOver > 0 ? `Übertrag: ${formatCurrency(availability.expiringCarryOver)}` : undefined}
            warning={expiryWarning ? 'Übertrag läuft 01.07. ab' : undefined}
          />
          <BudgetSummaryCard
            title="Kombinationsleistung"
            consumed={availability.kombiConsumed}
            available={availability.kombiAvailable}
            total={availability.kombiMonthlyMax}
            extra="Monatslimit"
          />
          <BudgetSummaryCard
            title="Verhinderungspflege"
            consumed={consumedYear.VERHINDERUNG}
            available={availability.vpRemainingYear}
            total={availability.vpYearlyTotal}
          />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Privat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold">{formatCurrency(privatConsumed)}</div>
              <p className="text-xs text-muted-foreground">verbraucht {currentYear}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monatstabelle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monatsverlauf {currentYear}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Klicken Sie auf einen Monat, um einzelne Leistungen anzuzeigen. Nicht abgerechnete Einträge können umgebucht werden.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Monat</TableHead>
                <TableHead className="text-right">Stunden</TableHead>
                <TableHead className="text-right">Einsätze</TableHead>
                <TableHead className="text-right">Entlastung</TableHead>
                <TableHead className="text-right">Kombi</TableHead>
                <TableHead className="text-right">VP</TableHead>
                <TableHead className="text-right">Privat</TableHead>
                <TableHead className="text-center w-20">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthData.map((data) => (
                <MonthRow
                  key={data.month}
                  data={data}
                  tariffs={tariffs}
                  onChangeType={handleChangeType}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        ✓ = abgerechnet &nbsp; ○ = offen &nbsp; Budgets basieren auf abgerechneten Transaktionen (billed=true)
      </p>
    </div>
  );
}
