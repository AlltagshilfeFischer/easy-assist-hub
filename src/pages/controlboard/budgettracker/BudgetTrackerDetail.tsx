import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getYear, getMonth, format, parseISO as parseDateISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { ArrowLeft, ChevronDown, ChevronRight, AlertTriangle, Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useCustomers } from '@/hooks/useCustomers';
import { useTermineForBudget } from '@/hooks/useTermineForBudget';
import { useTariffs } from '@/hooks/useTariffs';
import { useCareLevels } from '@/hooks/useCareLevels';
import { useUpdateKundenBudget } from '@/hooks/useUpdateKundenBudget';
import { useHaushaltshilfeVerordnungen } from '@/hooks/useHaushaltshilfeVerordnungen';
import {
  useBudgetManuelleEintraege,
  useCreateBudgetManuellerEintrag,
  useUpdateBudgetManuellerEintrag,
  useDeleteBudgetManuellerEintrag,
} from '@/hooks/useBudgetManuelleEintraege';
import {
  formatCurrency,
  isPrivateInsured,
  buildAvailability,
  hasExpiryWarning,
  getTotalManuelleGuthaben,
  computeYearBudgetAllocations,
} from '@/lib/pflegebudget/budgetCalculations';
import type { TerminBudgetAllocation } from '@/lib/pflegebudget/budgetCalculations';
import type { ServiceType, BudgetManuellerEintrag as DomainManuellerEintrag } from '@/types/domain';

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
  HAUSHALTSHILFE: 'HH §38',
};

const SERVICE_TYPE_COLORS: Record<ServiceType, string> = {
  ENTLASTUNG: 'bg-blue-100 text-blue-800',
  KOMBI: 'bg-purple-100 text-purple-800',
  VERHINDERUNG: 'bg-green-100 text-green-800',
  PRIVAT: 'bg-gray-100 text-gray-800',
  HAUSHALTSHILFE: 'bg-amber-100 text-amber-800',
};

const BILLED_STATUSES = new Set(['abgerechnet', 'bezahlt']);

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

function ServiceTypeBadge({ type, split }: { type: ServiceType; split?: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SERVICE_TYPE_COLORS[type]}`}>
      {SERVICE_TYPE_LABELS[type]}
      {split && <span className="ml-1 opacity-60">~</span>}
    </span>
  );
}

// ─── Monatszeile ─────────────────────────────────────────────

interface MonthData {
  month: number;
  allocations: TerminBudgetAllocation[];
  totalHours: number;
  entlastungAmount: number;
  kombiAmount: number;
  vpAmount: number;
  privatAmount: number;
  hhHours: number;
  hasBilled: boolean;
  hasOpen: boolean;
}

function MonthRow({ data }: { data: MonthData }) {
  const [expanded, setExpanded] = useState(false);
  const hasData = data.allocations.length > 0;

  return (
    <>
      <TableRow
        className={hasData ? 'cursor-pointer hover:bg-muted/40' : 'opacity-50'}
        onClick={() => hasData && setExpanded((v) => !v)}
      >
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {hasData ? (
              expanded
                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <span className="w-4" />
            )}
            {MONTH_NAMES[data.month - 1]}
          </div>
        </TableCell>
        <TableCell className="text-right">{hasData ? `${data.totalHours.toFixed(1)} h` : '—'}</TableCell>
        <TableCell className="text-right">{hasData ? data.allocations.length : '—'}</TableCell>
        <TableCell className="text-right">
          {data.entlastungAmount > 0 ? formatCurrency(data.entlastungAmount) : <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-right">
          {data.kombiAmount > 0 ? formatCurrency(data.kombiAmount) : <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-right">
          {data.vpAmount > 0 ? formatCurrency(data.vpAmount) : <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-right">
          {data.privatAmount > 0 ? formatCurrency(data.privatAmount) : <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-right">
          {data.hhHours > 0
            ? <span className="text-amber-700 font-medium">{data.hhHours.toFixed(1)} h</span>
            : <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-center">
          {hasData && (
            <div className="flex items-center justify-center gap-1">
              {data.hasBilled && <span className="text-xs text-green-600">✓</span>}
              {data.hasOpen && <span className="text-xs text-yellow-600">○</span>}
            </div>
          )}
        </TableCell>
      </TableRow>

      {expanded && data.allocations.map((alloc) => (
        <TableRow key={alloc.terminId} className="bg-muted/20 text-sm">
          <TableCell className="pl-12 text-muted-foreground">
            {format(parseDateISO(alloc.serviceDate), 'dd.MM.', { locale: de })}
          </TableCell>
          <TableCell className="text-right">{alloc.hours.toFixed(1)} h</TableCell>
          <TableCell className="text-right">1</TableCell>
          <TableCell colSpan={3} />
          <TableCell className="text-right font-medium">
            {formatCurrency(alloc.totalAmount)}
          </TableCell>
          <TableCell>
            <div className="flex items-center justify-between gap-2">
              <ServiceTypeBadge type={alloc.serviceType} split={!!alloc.splitAllocations} />
              {BILLED_STATUSES.has(alloc.status) && (
                <span className="text-xs text-green-600 whitespace-nowrap">✓ abg.</span>
              )}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ─── Manuelle Guthaben Dialog ────────────────────────────────

interface ManuellerEintragFormState {
  bezeichnung: string;
  betrag: string;
  verfaellt_am: string;
  notizen: string;
}

const EMPTY_FORM: ManuellerEintragFormState = {
  bezeichnung: '',
  betrag: '',
  verfaellt_am: '',
  notizen: '',
};

function ManuelleGuthabenDialog({
  open,
  onOpenChange,
  eintrag,
  kundenId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eintrag: DomainManuellerEintrag | null;
  kundenId: string;
}) {
  const [form, setForm] = useState<ManuellerEintragFormState>(EMPTY_FORM);
  const create = useCreateBudgetManuellerEintrag(kundenId);
  const update = useUpdateBudgetManuellerEintrag(kundenId);

  React.useEffect(() => {
    if (open) {
      setForm(
        eintrag
          ? { bezeichnung: eintrag.bezeichnung, betrag: String(eintrag.betrag), verfaellt_am: eintrag.verfaellt_am, notizen: eintrag.notizen ?? '' }
          : EMPTY_FORM,
      );
    }
  }, [open, eintrag]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const betrag = parseFloat(form.betrag.replace(',', '.'));
    if (!form.bezeichnung || isNaN(betrag) || betrag <= 0 || !form.verfaellt_am) return;

    const payload = {
      bezeichnung: form.bezeichnung.trim(),
      betrag,
      verfaellt_am: form.verfaellt_am,
      notizen: form.notizen.trim() || null,
    };

    if (eintrag) {
      update.mutate({ id: eintrag.id, ...payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      create.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{eintrag ? 'Eintrag bearbeiten' : 'Manuelles Guthaben hinzufügen'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bezeichnung">Bezeichnung</Label>
            <Input
              id="bezeichnung"
              placeholder="z.B. Sonderzahlung Kasse"
              value={form.bezeichnung}
              onChange={(e) => setForm((f) => ({ ...f, bezeichnung: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="betrag">Betrag (€)</Label>
            <Input
              id="betrag"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0,00"
              value={form.betrag}
              onChange={(e) => setForm((f) => ({ ...f, betrag: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="verfaellt_am">Verfällt am</Label>
            <Input
              id="verfaellt_am"
              type="date"
              value={form.verfaellt_am}
              onChange={(e) => setForm((f) => ({ ...f, verfaellt_am: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notizen">Notizen (optional)</Label>
            <Textarea
              id="notizen"
              placeholder="Interne Notizen..."
              value={form.notizen}
              onChange={(e) => setForm((f) => ({ ...f, notizen: e.target.value }))}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Manuelle Guthaben Sektion ───────────────────────────────

function ManuelleGuthabenSektion({ kundenId }: { kundenId: string }) {
  const { data: eintraege = [], isLoading } = useBudgetManuelleEintraege(kundenId);
  const deleteEintrag = useDeleteBudgetManuellerEintrag(kundenId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEintrag, setSelectedEintrag] = useState<DomainManuellerEintrag | null>(null);

  const { aktiv } = getTotalManuelleGuthaben(eintraege);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Manuelle Guthaben</CardTitle>
            {eintraege.length > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Aktiv verfügbar: <span className="font-medium text-foreground">{formatCurrency(aktiv)}</span>
              </p>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => { setSelectedEintrag(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />
            Hinzufügen
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground px-6 pb-4">Lade...</p>
          ) : eintraege.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 pb-4">Keine manuellen Einträge vorhanden.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bezeichnung</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead>Verfällt am</TableHead>
                  <TableHead>Notizen</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {eintraege.map((e) => {
                  const abgelaufen = e.verfaellt_am < today;
                  return (
                    <TableRow key={e.id} className={abgelaufen ? 'opacity-50' : undefined}>
                      <TableCell className={abgelaufen ? 'line-through text-muted-foreground' : 'font-medium'}>
                        {e.bezeichnung}
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(e.betrag)}</TableCell>
                      <TableCell className="text-sm">
                        {format(parseDateISO(e.verfaellt_am), 'dd.MM.yyyy', { locale: de })}
                        {abgelaufen && <Badge variant="secondary" className="ml-2 text-xs">abgelaufen</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {e.notizen ?? '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => { setSelectedEintrag(e); setDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => { if (window.confirm('Eintrag wirklich löschen?')) deleteEintrag.mutate(e.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ManuelleGuthabenDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        eintrag={selectedEintrag}
        kundenId={kundenId}
      />
    </>
  );
}

// ─── Budget-Konfiguration ────────────────────────────────────

type KundeForKonfig = {
  id: string;
  pflegegrad?: number | null;
  entlastung_genehmigt?: boolean | null;
  initial_budget_entlastung?: number | null;
  pflegesachleistung_genehmigt?: boolean | null;
  pflegesachleistung_budget?: number | null;
  verhinderungspflege_genehmigt?: boolean | null;
};

type KonfigForm = {
  pflegegrad: number;
  entlastung: boolean;
  vorjahresrest: string;
  kombi: boolean;
  kombiBudget: string;
  vp: boolean;
};

function PotIndikator({ label, active, sub }: { label: string; active: boolean; sub?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        active
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-transparent bg-muted text-muted-foreground'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-muted-foreground/50'}`} />
      {label}
      {sub && <span className="opacity-60">{sub}</span>}
    </span>
  );
}

function BudgetKonfiguration({ kunde }: { kunde: KundeForKonfig }) {
  const navigate = useNavigate();
  const update = useUpdateKundenBudget();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<KonfigForm>({
    pflegegrad: kunde.pflegegrad ?? 0,
    entlastung: kunde.entlastung_genehmigt ?? false,
    vorjahresrest: String(kunde.initial_budget_entlastung ?? ''),
    kombi: kunde.pflegesachleistung_genehmigt ?? false,
    kombiBudget: String(kunde.pflegesachleistung_budget ?? ''),
    vp: kunde.verhinderungspflege_genehmigt ?? false,
  });

  // Formular mit aktuellen Kundendaten synchronisieren (nach erfolgreichem Speichern)
  useEffect(() => {
    if (!editing) {
      setForm({
        pflegegrad: kunde.pflegegrad ?? 0,
        entlastung: kunde.entlastung_genehmigt ?? false,
        vorjahresrest: String(kunde.initial_budget_entlastung ?? ''),
        kombi: kunde.pflegesachleistung_genehmigt ?? false,
        kombiBudget: String(kunde.pflegesachleistung_budget ?? ''),
        vp: kunde.verhinderungspflege_genehmigt ?? false,
      });
    }
  }, [kunde, editing]);

  const handlePgChange = (pg: number) => {
    setForm((prev) => ({
      ...prev,
      pflegegrad: pg,
      entlastung: pg >= 1 ? prev.entlastung : false,
      kombi: pg >= 2 ? prev.kombi : false,
      kombiBudget: pg >= 2 ? prev.kombiBudget : '',
      vp: pg >= 2 ? prev.vp : false,
    }));
  };

  const handleSave = () => {
    const vorjahresrestNum = form.vorjahresrest ? parseFloat(form.vorjahresrest) : null;
    const kombiBudgetNum = form.kombiBudget ? parseFloat(form.kombiBudget) : null;
    update.mutate(
      {
        kundenId: kunde.id,
        pflegegrad: form.pflegegrad,
        entlastung_genehmigt: form.entlastung,
        initial_budget_entlastung: form.entlastung && vorjahresrestNum ? vorjahresrestNum : null,
        pflegesachleistung_genehmigt: form.kombi,
        pflegesachleistung_budget: form.kombi && kombiBudgetNum ? kombiBudgetNum : null,
        verhinderungspflege_genehmigt: form.vp,
      },
      { onSuccess: () => setEditing(false) },
    );
  };

  const pg = kunde.pflegegrad ?? 0;

  return (
    <Card>
      <CardContent className="p-4">
        {/* Kopfzeile: Indikatoren + Aktionen */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {!editing ? (
              <>
                <span className="text-sm font-medium text-muted-foreground shrink-0">Leistungstöpfe:</span>
                <PotIndikator label="§ 45b Entlastung" active={!!(kunde.entlastung_genehmigt && pg >= 1)} />
                <PotIndikator label="§ 45a Kombi" active={!!(kunde.pflegesachleistung_genehmigt && pg >= 2)} />
                <PotIndikator label="§ 39 VP" active={!!(kunde.verhinderungspflege_genehmigt && pg >= 2)} />
                <PotIndikator label="Privat" active />
                {!!kunde.initial_budget_entlastung && (
                  <span className="text-xs text-muted-foreground">
                    · Vorjahresrest: {formatCurrency(kunde.initial_budget_entlastung)}
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm font-medium">Budget-Konfiguration bearbeiten</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!editing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    navigate(`/dashboard/master-data?openKunde=${kunde.id}&tab=abrechnung`)
                  }
                >
                  Vollständige Stammdaten
                  <ExternalLink className="h-3 w-3" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Konfigurieren
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Abbrechen
                </Button>
                <Button size="sm" onClick={handleSave} disabled={update.isPending}>
                  {update.isPending ? 'Speichern…' : 'Speichern'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Bearbeitungsformular */}
        {editing && (
          <div className="mt-4 space-y-5 border-t pt-4">
            {/* Pflegegrad */}
            <div className="flex items-center gap-4">
              <Label className="w-44 shrink-0 text-sm font-medium">Pflegegrad</Label>
              <Select
                value={String(form.pflegegrad)}
                onValueChange={(v) => handlePgChange(parseInt(v))}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Kein PG (0)</SelectItem>
                  <SelectItem value="1">PG 1</SelectItem>
                  <SelectItem value="2">PG 2</SelectItem>
                  <SelectItem value="3">PG 3</SelectItem>
                  <SelectItem value="4">PG 4</SelectItem>
                  <SelectItem value="5">PG 5</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* § 45b Entlastungsbetrag */}
            <div className={`space-y-3 ${form.pflegegrad < 1 ? 'pointer-events-none opacity-40' : ''}`}>
              <div className="flex items-center gap-4">
                <Switch
                  id="entlastung"
                  checked={form.entlastung}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, entlastung: v }))}
                  disabled={form.pflegegrad < 1}
                />
                <Label htmlFor="entlastung" className="cursor-pointer leading-tight">
                  § 45b Entlastungsbetrag{' '}
                  <span className="font-normal text-muted-foreground">— 131€/Monat, ab PG 1</span>
                </Label>
              </div>
              {form.entlastung && form.pflegegrad >= 1 && (
                <div className="flex items-center gap-4 pl-10">
                  <Label htmlFor="vorjahresrest" className="w-36 shrink-0 text-sm text-muted-foreground">
                    Vorjahresrest (€)
                  </Label>
                  <Input
                    id="vorjahresrest"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.vorjahresrest}
                    onChange={(e) => setForm((p) => ({ ...p, vorjahresrest: e.target.value }))}
                    placeholder="0,00"
                    className="w-32"
                  />
                  <span className="text-xs text-muted-foreground">verfällt 01.07.</span>
                </div>
              )}
            </div>

            {/* § 45a Kombinationsleistung */}
            <div className={`space-y-3 ${form.pflegegrad < 2 ? 'pointer-events-none opacity-40' : ''}`}>
              <div className="flex items-center gap-4">
                <Switch
                  id="kombi"
                  checked={form.kombi}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, kombi: v }))}
                  disabled={form.pflegegrad < 2}
                />
                <Label htmlFor="kombi" className="cursor-pointer leading-tight">
                  § 45a Kombinationsleistung{' '}
                  <span className="font-normal text-muted-foreground">— monatlich, PG-abhängig, ab PG 2</span>
                </Label>
              </div>
              {form.kombi && form.pflegegrad >= 2 && (
                <div className="flex items-center gap-4 pl-10">
                  <Label htmlFor="kombiBudget" className="w-36 shrink-0 text-sm text-muted-foreground">
                    Betrag (€/Monat)
                  </Label>
                  <Input
                    id="kombiBudget"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.kombiBudget}
                    onChange={(e) => setForm((p) => ({ ...p, kombiBudget: e.target.value }))}
                    placeholder="Standard (PG-abhängig)"
                    className="w-40"
                  />
                  <span className="text-xs text-muted-foreground">
                    Standard: PG2 318,40 € · PG3 598,80 € · PG4 743,60 € · PG5 916,60 €
                  </span>
                </div>
              )}
            </div>

            {/* § 39 Verhinderungspflege */}
            <div className={`flex items-center gap-4 ${form.pflegegrad < 2 ? 'pointer-events-none opacity-40' : ''}`}>
              <Switch
                id="vp"
                checked={form.vp}
                onCheckedChange={(v) => setForm((p) => ({ ...p, vp: v }))}
                disabled={form.pflegegrad < 2}
              />
              <Label htmlFor="vp" className="cursor-pointer leading-tight">
                § 39 Verhinderungspflege{' '}
                <span className="font-normal text-muted-foreground">— 3.539€/Jahr, ab PG 2</span>
              </Label>
            </div>

            <div className="flex justify-end border-t pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() =>
                  navigate(`/dashboard/master-data?openKunde=${kunde.id}&tab=abrechnung`)
                }
              >
                Vollständige Stammdaten öffnen
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
  const { data: termine = [], isLoading: termineLoading } = useTermineForBudget(kundenId, currentYear);
  const { data: tariffs = [] } = useTariffs();
  const { data: careLevels = [] } = useCareLevels();
  const { data: haushaltshilfeVerordnungen = [] } = useHaushaltshilfeVerordnungen(kundenId ?? '');

  const kunde = customers.find((c) => c.id === kundenId);
  const kundeExtended = kunde as typeof kunde & {
    entlastung_genehmigt?: boolean | null;
    verhinderungspflege_genehmigt?: boolean | null;
    pflegesachleistung_genehmigt?: boolean | null;
    pflegesachleistung_budget?: number | null;
    initial_budget_entlastung?: number | null;
  };

  // ─── FIFO-Berechnung für das gesamte Jahr ────────────────

  const { allocations, availability, consumedYear, privatConsumed, expiryWarning } = useMemo(() => {
    const empty = {
      allocations: [] as TerminBudgetAllocation[],
      availability: null,
      consumedYear: { ENTLASTUNG: 0, KOMBI: 0, VERHINDERUNG: 0 },
      privatConsumed: 0,
      expiryWarning: false,
    };

    if (!kundeExtended || !tariffs.length || !careLevels.length) return empty;

    const { allocations: allocs, totalConsumedEntlastung, totalConsumedVP } =
      computeYearBudgetAllocations(termine, kundeExtended, tariffs, careLevels, currentYear, haushaltshilfeVerordnungen);

    // Kombi des aktuellen Monats aus den berechneten Allokationen
    const currentMonthKombiConsumed = allocs
      .filter((a) => new Date(a.serviceDate).getMonth() + 1 === currentMonth)
      .reduce((sum, a) => {
        if (a.splitAllocations) {
          return sum + a.splitAllocations.filter((s) => s.type === 'KOMBI').reduce((s2, s3) => s2 + s3.amount, 0);
        }
        return sum + (a.serviceType === 'KOMBI' ? a.totalAmount : 0);
      }, 0);

    const consumed = { ENTLASTUNG: totalConsumedEntlastung, KOMBI: 0, VERHINDERUNG: totalConsumedVP };

    const avail = buildAvailability(
      kundeExtended,
      consumed,
      currentMonthKombiConsumed,
      careLevels,
      currentMonth,
      currentYear,
    );

    const privat = allocs
      .filter((a) => a.serviceType === 'PRIVAT')
      .reduce((sum, a) => sum + a.totalAmount, 0);

    const expiry = hasExpiryWarning(
      kundeExtended.initial_budget_entlastung,
      totalConsumedEntlastung,
      currentMonth,
    );

    return {
      allocations: allocs,
      availability: avail,
      consumedYear: consumed,
      privatConsumed: privat,
      expiryWarning: expiry,
    };
  }, [kundeExtended, termine, tariffs, careLevels, currentMonth, currentYear]);

  // ─── Monatstabelle aufbauen ──────────────────────────────

  const monthData: MonthData[] = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthAllocs = allocations.filter(
        (a) => new Date(a.serviceDate).getMonth() + 1 === month,
      );

      const totalHours = monthAllocs.reduce((s, a) => s + a.hours, 0);

      const amountByType = (type: ServiceType) =>
        monthAllocs.reduce((sum, a) => {
          if (a.splitAllocations) {
            return sum + a.splitAllocations.filter((s) => s.type === type).reduce((s2, s3) => s2 + s3.amount, 0);
          }
          return sum + (a.serviceType === type ? a.totalAmount : 0);
        }, 0);

      return {
        month,
        allocations: monthAllocs,
        totalHours,
        entlastungAmount: amountByType('ENTLASTUNG'),
        kombiAmount: amountByType('KOMBI'),
        vpAmount: amountByType('VERHINDERUNG'),
        privatAmount: amountByType('PRIVAT'),
        hhHours: monthAllocs
          .filter((a) => a.serviceType === 'HAUSHALTSHILFE')
          .reduce((sum, a) => sum + a.hours, 0),
        hasBilled: monthAllocs.some((a) => BILLED_STATUSES.has(a.status)),
        hasOpen: monthAllocs.some((a) => !BILLED_STATUSES.has(a.status)),
      };
    });
  }, [allocations]);

  // ─── Loading / Not found ─────────────────────────────────

  if (!kunde) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={() => navigate('/dashboard/budgettracker')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <p className="text-muted-foreground">Kunde nicht gefunden.</p>
      </div>
    );
  }

  const isPrivate = isPrivateInsured(kunde.versichertennummer);
  const fullName = `${kunde.nachname ?? ''}, ${kunde.vorname ?? ''}`.trim().replace(/^,\s*/, '');

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/budgettracker')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Budgettracker
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold">{fullName}</span>
      </div>

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

      {/* Budget-Konfiguration (Töpfe aktivieren / bearbeiten) */}
      <BudgetKonfiguration kunde={kundeExtended ?? kunde} />

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

      {/* Haushaltshilfe §38 Verordnungen */}
      {haushaltshilfeVerordnungen.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Haushaltshilfe §38 Verordnungen</CardTitle>
            <p className="text-sm text-muted-foreground">
              Stundenkontingent auf Basis ärztlicher Verordnung — höchste Abrechnungspriorität.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {haushaltshilfeVerordnungen.map((v) => {
              const today = new Date().toISOString().slice(0, 10);
              const isAktiv = v.gueltig_von <= today && v.gueltig_bis >= today;
              const hhConsumedHours = allocations
                .filter(
                  (a) =>
                    a.serviceType === 'HAUSHALTSHILFE' &&
                    a.serviceDate >= v.gueltig_von &&
                    a.serviceDate <= v.gueltig_bis,
                )
                .reduce((sum, a) => sum + a.hours, 0);
              return (
                <div
                  key={v.id}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${isAktiv ? 'border-amber-200 bg-amber-50' : ''}`}
                >
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">
                      {format(parseDateISO(v.gueltig_von), 'dd.MM.yyyy', { locale: de })}
                      {' – '}
                      {format(parseDateISO(v.gueltig_bis), 'dd.MM.yyyy', { locale: de })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {v.termine_pro_woche}× pro Woche · max. {v.max_dauer_stunden} h / Termin
                    </div>
                  </div>
                  <div className="text-right space-y-0.5">
                    <div className="text-sm font-semibold text-amber-700">
                      {hhConsumedHours.toFixed(1)} h abgerechnet
                    </div>
                    <div className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${isAktiv ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground'}`}>
                      {isAktiv ? 'Aktiv' : 'Abgelaufen'}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Monatstabelle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monatsverlauf {currentYear}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Alle abgeschlossenen Termine mit automatischer FIFO-Budgetzuweisung. Klick auf Monat für Details.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {termineLoading ? (
            <p className="text-sm text-muted-foreground px-6 py-4">Lade Termine...</p>
          ) : (
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
                  <TableHead className="text-right text-amber-700">HH §38</TableHead>
                  <TableHead className="text-center w-20">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthData.map((data) => (
                  <MonthRow key={data.month} data={data} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        ✓ = abgerechnet &nbsp; ○ = offen &nbsp; ~ = aufgeteilt auf mehrere Töpfe &nbsp; Budgets aus abgeschlossenen Terminen (live)
      </p>

      {/* Manuelle Guthaben */}
      <ManuelleGuthabenSektion kundenId={kundenId!} />
    </div>
  );
}
