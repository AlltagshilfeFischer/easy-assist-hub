import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getYear, getMonth } from 'date-fns';
import { Search, AlertTriangle, ChevronRight, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadCsv } from '@/lib/csvExport';
import * as Progress from '@radix-ui/react-progress';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useCustomers } from '@/hooks/useCustomers';
import { useBudgetTransactionsByYear } from '@/hooks/useBudgetTransactions';
import { useTariffs } from '@/hooks/useTariffs';
import { useCareLevels } from '@/hooks/useCareLevels';
import {
  formatCurrency,
  isPrivateInsured,
  aggregateConsumed,
  buildAvailability,
  hasExpiryWarning,
  getBillingStatus,
  buildBillingSuggestion,
  assignTransactionTypes,
} from '@/lib/pflegebudget/budgetCalculations';
import type { AllocationStatus } from '@/types/domain';

// ─── Hilfskomponenten ────────────────────────────────────────

function BudgetProgressBar({ percentage, exceeded }: { percentage: number; exceeded?: boolean }) {
  const clamped = Math.min(Math.max(percentage, 0), 100);
  return (
    <Progress.Root
      className="relative overflow-hidden bg-secondary rounded-full w-full h-1.5"
      value={clamped}
    >
      <Progress.Indicator
        className={`h-full transition-transform duration-300 ${exceeded ? 'bg-destructive' : 'bg-primary'}`}
        style={{ transform: `translateX(-${100 - clamped}%)` }}
      />
    </Progress.Root>
  );
}

function BudgetCell({
  consumed,
  total,
  available,
  label,
}: {
  consumed: number;
  total: number;
  available: number;
  label?: string;
}) {
  const percentage = total > 0 ? (consumed / total) * 100 : 0;
  const exceeded = percentage > 100;
  return (
    <div className="space-y-1 min-w-[120px]">
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      <span className="text-sm font-medium">{formatCurrency(available)}</span>
      <BudgetProgressBar percentage={percentage} exceeded={exceeded} />
      <p className="text-xs text-muted-foreground">
        {formatCurrency(consumed)} / {formatCurrency(total)}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: AllocationStatus }) {
  if (status === 'OK') return <Badge className="bg-green-100 text-green-800 border-green-200">OK</Badge>;
  if (status === 'OPTIMIZE') return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Optimieren</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-200">Überschritten</Badge>;
}

// ─── Hauptkomponente ─────────────────────────────────────────

export default function BudgetTracker() {
  const navigate = useNavigate();
  const now = new Date();
  const currentYear = getYear(now);
  const currentMonth = getMonth(now) + 1;

  const [search, setSearch] = useState('');
  const [pflegegradFilter, setPflegegradFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: customers = [], isLoading: customersLoading } = useCustomers({ onlyActive: true });
  const { data: tariffs = [], isLoading: tariffsLoading } = useTariffs();
  const { data: careLevels = [], isLoading: careLevelsLoading } = useCareLevels();
  const { data: allYearData = [], isLoading: txLoading } = useBudgetTransactionsByYear(currentYear);

  const budgetDataReady = tariffs.length > 0 && careLevels.length > 0;
  const isLoading = customersLoading || tariffsLoading || careLevelsLoading || txLoading;

  const trackerRows = useMemo(() => {
    // Alle aktiven Kunden anzeigen – auch ohne Pflegegrad
    return customers.map((kunde) => {
      const clientTx = allYearData.filter((tx) => tx.client_id === kunde.id);

      const kundeExtended = kunde as typeof kunde & {
        entlastung_genehmigt?: boolean | null;
        verhinderungspflege_genehmigt?: boolean | null;
        pflegesachleistung_genehmigt?: boolean | null;
        initial_budget_entlastung?: number | null;
      };

      if (!budgetDataReady) {
        return {
          kundenId: kunde.id,
          name: `${kunde.nachname ?? ''}, ${kunde.vorname ?? ''}`.trim().replace(/^,\s*/, ''),
          pflegegrad: kunde.pflegegrad ?? 0,
          availability: null,
          expiryWarning: false,
          consumedYear: { ENTLASTUNG: 0, KOMBI: 0, VERHINDERUNG: 0 },
          privatConsumed: 0,
          status: 'OK' as AllocationStatus,
          isPrivate: isPrivateInsured(kunde.versichertennummer),
          hasEntlastung: false,
          hasKombi: false,
          hasVP: false,
        };
      }

      const billedTx = clientTx.filter((tx) => tx.billed);
      const consumedYear = aggregateConsumed(billedTx, tariffs, true);

      const privatConsumed = clientTx
        .filter((tx) => tx.service_type === 'PRIVAT')
        .reduce((sum, tx) => sum + tx.total_amount, 0);

      const currentMonthBilledTx = billedTx.filter((tx) => {
        const d = new Date(tx.service_date);
        return getMonth(d) + 1 === currentMonth;
      });
      const consumedKombiMonth = aggregateConsumed(
        currentMonthBilledTx.filter((tx) => tx.service_type === 'KOMBI'),
        tariffs,
        true,
      ).KOMBI;

      const availability = buildAvailability(
        kundeExtended,
        consumedYear,
        consumedKombiMonth,
        careLevels,
        currentMonth,
        currentYear,
      );

      const expiryWarning = hasExpiryWarning(
        kundeExtended.initial_budget_entlastung,
        consumedYear.ENTLASTUNG,
        currentMonth,
      );

      const isPrivate = isPrivateInsured(kunde.versichertennummer);

      const assigned = assignTransactionTypes(clientTx, kundeExtended, availability, tariffs);
      const suggestion = buildBillingSuggestion(assigned, tariffs);
      const status = getBillingStatus(
        kunde.pflegegrad ?? 0,
        suggestion,
        kundeExtended.initial_budget_entlastung,
        currentMonth,
        consumedYear.ENTLASTUNG,
      );

      return {
        kundenId: kunde.id,
        name: `${kunde.nachname ?? ''}, ${kunde.vorname ?? ''}`.trim().replace(/^,\s*/, ''),
        pflegegrad: kunde.pflegegrad ?? 0,
        availability,
        expiryWarning,
        consumedYear,
        privatConsumed,
        status,
        isPrivate,
        hasEntlastung: availability.entlastungYearlyTotal > 0,
        hasKombi: availability.kombiMonthlyMax > 0,
        hasVP: availability.vpYearlyTotal > 0,
      };
    });
  }, [customers, allYearData, tariffs, careLevels, currentMonth, currentYear, budgetDataReady]);

  const filteredRows = useMemo(() => {
    return trackerRows.filter((row) => {
      if (search) {
        const q = search.toLowerCase();
        if (!row.name.toLowerCase().includes(q)) return false;
      }
      if (pflegegradFilter !== 'all' && row.pflegegrad !== parseInt(pflegegradFilter)) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      return true;
    });
  }, [trackerRows, search, pflegegradFilter, statusFilter]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Budgettracker {currentYear}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Jahresübersicht aller Pflegebudgets — Klicken Sie auf einen Kunden für Details
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => {
              downloadCsv(
                ['Kunde', 'Pflegegrad', 'Entlastung', 'Kombi', 'Verhinderungspflege', 'Privat', 'Status'],
                filteredRows.map(r => [
                  r.name, r.pflegegrad,
                  r.consumedYear.ENTLASTUNG, r.consumedYear.KOMBI,
                  r.consumedYear.VERHINDERUNG, r.privatConsumed, r.status,
                ]),
                `budgettracker_${currentYear}.csv`
              );
            }}
            disabled={!filteredRows.length}
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 w-56"
            placeholder="Kunden suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={pflegegradFilter} onValueChange={setPflegegradFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Pflegegrad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Grade</SelectItem>
            {[0, 1, 2, 3, 4, 5].map((pg) => (
              <SelectItem key={pg} value={String(pg)}>
                {pg === 0 ? 'Kein PG' : `PG ${pg}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="OK">OK</SelectItem>
            <SelectItem value="OPTIMIZE">Optimieren</SelectItem>
            <SelectItem value="BUDGET_EXCEEDED">Überschritten</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabelle */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Daten werden geladen…</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kunde</TableHead>
                  <TableHead>PG</TableHead>
                  <TableHead>Entlastungsbetrag</TableHead>
                  <TableHead>Kombinationsleistung</TableHead>
                  <TableHead>Verhinderungspflege</TableHead>
                  <TableHead className="text-right">Privat</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {search || pflegegradFilter !== 'all' || statusFilter !== 'all'
                        ? 'Keine Kunden gefunden – Filter anpassen'
                        : 'Keine aktiven Kunden vorhanden'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow
                      key={row.kundenId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        navigate(`/dashboard/controlboard/budgettracker/${row.kundenId}`)
                      }
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {row.name || '(Kein Name)'}
                          {row.expiryWarning && (
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.pflegegrad > 0 ? (
                          <Badge variant="outline">PG {row.pflegegrad}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.availability && row.hasEntlastung ? (
                          <BudgetCell
                            consumed={row.consumedYear.ENTLASTUNG}
                            total={row.availability.entlastungYearlyTotal}
                            available={row.availability.entlastungAvailable}
                          />
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.availability && row.hasKombi ? (
                          <BudgetCell
                            consumed={row.availability.kombiConsumed}
                            total={row.availability.kombiMonthlyMax}
                            available={row.availability.kombiAvailable}
                            label="Monatslimit"
                          />
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.availability && row.hasVP ? (
                          <BudgetCell
                            consumed={row.consumedYear.VERHINDERUNG}
                            total={row.availability.vpYearlyTotal}
                            available={row.availability.vpRemainingYear}
                          />
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.privatConsumed > 0 ? (
                          <span className="text-sm font-medium">{formatCurrency(row.privatConsumed)}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">{filteredRows.length} Kunden angezeigt</p>
    </div>
  );
}
