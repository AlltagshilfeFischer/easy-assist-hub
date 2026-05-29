import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Lock, Euro, ChevronUp, ChevronDown, Info } from 'lucide-react';
import {
  BUDGET_BUCKETS,
  type BudgetBucketKey,
  normalizeBudgetOrder,
} from '@/lib/budgetPriority';

// ─── Props ───────────────────────────────────────────────────────────────────

interface AbrechnungFormData {
  pflegegrad: string;
  kasse_privat?: string;
  entlastung_genehmigt?: boolean;
  privatrechnung_erlaubt?: boolean;
  initial_budget_entlastung?: number | null;
  verhinderungspflege_aktiv: boolean;
  verhinderungspflege_beantragt?: boolean;
  verhinderungspflege_genehmigt?: boolean;
  verhinderungspflege_budget: string | number;
  pflegesachleistung_aktiv: boolean;
  pflegesachleistung_beantragt?: boolean;
  pflegesachleistung_genehmigt?: boolean;
  pflegesachleistung_budget?: number | null;
}

interface StepAbrechnungProps {
  customerData: AbrechnungFormData;
  setCustomerData: (fn: (prev: AbrechnungFormData) => AbrechnungFormData) => void;
  budgetOrder: string[];
  setBudgetOrder: (fn: (prev: string[]) => string[]) => void;
  draggedBudget: string | null;
  setDraggedBudget: (v: string | null) => void;
}

// ─── Komponente ──────────────────────────────────────────────────────────────

export function StepAbrechnung({
  customerData,
  setCustomerData,
  budgetOrder,
  setBudgetOrder,
  draggedBudget,
  setDraggedBudget,
}: StepAbrechnungProps) {
  const isPflegegrad1 = customerData.pflegegrad === '1';

  const normalizedOrder = normalizeBudgetOrder(budgetOrder.length > 0 ? budgetOrder : null);

  const moveUp = (index: number) => {
    if (index === 0) return;
    setBudgetOrder((prev) => {
      const order = normalizeBudgetOrder(prev.length > 0 ? prev : null);
      const updated = [...order];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated;
    });
  };

  const moveDown = (index: number) => {
    if (index === normalizedOrder.length - 1) return;
    setBudgetOrder((prev) => {
      const order = normalizeBudgetOrder(prev.length > 0 ? prev : null);
      const updated = [...order];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      return updated;
    });
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Grundkonfiguration */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Grundkonfiguration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Abrechnungsart</Label>
            <Select value={customerData.kasse_privat} onValueChange={(v) => setCustomerData(p => ({ ...p, kasse_privat: v }))}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Kasse">Kasse</SelectItem>
                <SelectItem value="Privat">Privat</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pflegegrad</Label>
            <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted/50 text-sm">
              {customerData.pflegegrad
                ? (customerData.pflegegrad === 'nicht_vorhanden' ? 'Nicht vorhanden' : `Pflegegrad ${customerData.pflegegrad}`)
                : <span className="text-muted-foreground">Nicht gesetzt (Stammdaten-Tab)</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Pflegebudget-Konfiguration */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Pflegebudget-Konfiguration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="text-sm font-medium">Entlastungsbetrag genehmigt</Label>
              <p className="text-xs text-muted-foreground">§ 45b SGB XI (131 €/Monat)</p>
            </div>
            <Switch
              checked={customerData.entlastung_genehmigt !== false}
              onCheckedChange={(checked) =>
                setCustomerData(p => ({ ...p, entlastung_genehmigt: checked }))
              }
            />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="text-sm font-medium">Privatrechnung erlaubt</Label>
              <p className="text-xs text-muted-foreground">Über Kassenbudget hinaus privat abrechnen</p>
            </div>
            <Switch
              checked={!!customerData.privatrechnung_erlaubt}
              onCheckedChange={(checked) =>
                setCustomerData(p => ({ ...p, privatrechnung_erlaubt: checked }))
              }
            />
          </div>
          <div>
            <Label>Vorjahresrest Entlastungsbetrag (€)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="z.B. 524.00"
              value={customerData.initial_budget_entlastung ?? ''}
              onChange={(e) =>
                setCustomerData(p => ({
                  ...p,
                  initial_budget_entlastung: e.target.value ? parseFloat(e.target.value) : null,
                }))
              }
            />
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Info className="h-3 w-3" />
              Verfällt am 01.07. – bitte zum Jahreswechsel aktualisieren
            </p>
          </div>
        </div>
      </div>

      {/* Verhinderungspflege (§ 39) */}
      <Card className={isPflegegrad1 ? 'opacity-50' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {isPflegegrad1 && <Lock className="h-4 w-4 text-muted-foreground" />}
              Verhinderungspflege (§ 39 SGB XI)
            </CardTitle>
            <Switch
              checked={customerData.verhinderungspflege_aktiv}
              onCheckedChange={(checked) => {
                if (!isPflegegrad1) {
                  setCustomerData(p => ({
                    ...p,
                    verhinderungspflege_aktiv: checked,
                    ...(checked ? { verhinderungspflege_beantragt: true, verhinderungspflege_genehmigt: true } : {}),
                  }));
                }
              }}
              disabled={isPflegegrad1}
            />
          </div>
          {isPflegegrad1 && <p className="text-xs text-destructive">Nicht verfügbar bei Pflegegrad 1</p>}
        </CardHeader>
        {customerData.verhinderungspflege_aktiv && !isPflegegrad1 && (
          <CardContent className="space-y-4">
            <div>
              <Label>Budget (€)</Label>
              <Input
                type="number"
                value={customerData.verhinderungspflege_budget}
                onChange={(e) => setCustomerData(p => ({ ...p, verhinderungspflege_budget: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">Jährliche Neubeantragung zum 01.01. – System erinnert automatisch.</p>
          </CardContent>
        )}
      </Card>

      {/* Umwandlung Pflegesachleistung (§ 45a) */}
      <Card className={isPflegegrad1 ? 'opacity-50' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {isPflegegrad1 && <Lock className="h-4 w-4 text-muted-foreground" />}
              Umwandlung Pflegesachleistung (§ 45a SGB XI)
            </CardTitle>
            <Switch
              checked={customerData.pflegesachleistung_aktiv}
              onCheckedChange={(checked) => {
                if (!isPflegegrad1) {
                  setCustomerData(p => ({
                    ...p,
                    pflegesachleistung_aktiv: checked,
                    ...(checked ? { pflegesachleistung_beantragt: true, pflegesachleistung_genehmigt: true } : {}),
                  }));
                }
              }}
              disabled={isPflegegrad1}
            />
          </div>
          {isPflegegrad1 && <p className="text-xs text-destructive">Nicht verfügbar bei Pflegegrad 1</p>}
        </CardHeader>
        {customerData.pflegesachleistung_aktiv && !isPflegegrad1 && (
          <CardContent className="space-y-4">
            <div>
              <Label>Budget (€/Monat)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="z.B. 573.00"
                value={customerData.pflegesachleistung_budget ?? ''}
                onChange={(e) =>
                  setCustomerData(p => ({
                    ...p,
                    pflegesachleistung_budget: e.target.value ? parseFloat(e.target.value) : null,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Info className="h-3 w-3" />
                40% des Sachleistungsbetrags (PG2: 318,40 €, PG3: 598,80 €, PG4: 743,60 €, PG5: 916,60 €)
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Abrechnungsreihenfolge (Budget-Priorisierung) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Euro className="h-4 w-4" />
            Abrechnungsreihenfolge
          </CardTitle>
          <CardDescription className="text-xs">
            Legen Sie fest, in welcher Reihenfolge die Budgettöpfe für diesen Kunden genutzt werden.
            Nicht verfügbare Töpfe werden automatisch übersprungen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {normalizedOrder.map((bucketKey, index) => {
              const meta = BUDGET_BUCKETS.find((b) => b.key === bucketKey);
              if (!meta) return null;
              const isFirst = index === 0;
              const isLast = index === normalizedOrder.length - 1;

              return (
                <div
                  key={bucketKey}
                  draggable={!meta.alwaysEnabled}
                  onDragStart={() => !meta.alwaysEnabled && setDraggedBudget(bucketKey)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedBudget && draggedBudget !== bucketKey) {
                      setBudgetOrder((prev) => {
                        const order = normalizeBudgetOrder(prev.length > 0 ? prev : null);
                        const fromIndex = order.indexOf(draggedBudget as BudgetBucketKey);
                        const toIndex = order.indexOf(bucketKey);
                        if (fromIndex === -1 || toIndex === -1) return order;
                        const updated = [...order];
                        updated.splice(fromIndex, 1);
                        updated.splice(toIndex, 0, draggedBudget as BudgetBucketKey);
                        return updated;
                      });
                    }
                    setDraggedBudget(null);
                  }}
                  className={[
                    'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                    draggedBudget === bucketKey ? 'border-primary bg-primary/5' : 'bg-background hover:bg-muted/50',
                    !meta.alwaysEnabled ? 'cursor-grab active:cursor-grabbing' : 'opacity-70',
                  ].join(' ')}
                >
                  <Badge variant="outline" className="text-xs min-w-[24px] justify-center shrink-0">
                    {index + 1}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{meta.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{meta.description}</p>
                  </div>
                  {meta.alwaysEnabled ? (
                    <Badge variant="secondary" className="text-xs shrink-0">Fix</Badge>
                  ) : (
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={isFirst}
                        onClick={() => moveUp(index)}
                        aria-label="Nach oben"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={isLast}
                        onClick={() => moveDown(index)}
                        aria-label="Nach unten"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Reihenfolge per Drag & Drop oder Pfeile ändern. Gilt nur für diesen Kunden.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
