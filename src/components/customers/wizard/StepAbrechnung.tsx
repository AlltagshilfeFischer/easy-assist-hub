import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Lock, Euro, GripVertical } from 'lucide-react';

interface StepAbrechnungProps {
  customerData: any;
  setCustomerData: (fn: (prev: any) => any) => void;
  budgetOrder: string[];
  setBudgetOrder: (fn: (prev: string[]) => string[]) => void;
  draggedBudget: string | null;
  setDraggedBudget: (v: string | null) => void;
}

export function StepAbrechnung({
  customerData,
  setCustomerData,
  budgetOrder,
  setBudgetOrder,
  draggedBudget,
  setDraggedBudget,
}: StepAbrechnungProps) {
  const isPflegegrad1 = customerData.pflegegrad === '1';

  return (
    <div className="space-y-6 mt-4">
      {/* Grundkonfiguration */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Grundkonfiguration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Abrechnungsart</Label>
            <Select value={customerData.kasse_privat} onValueChange={(v) => setCustomerData((p: any) => ({ ...p, kasse_privat: v }))}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent><SelectItem value="Kasse">Kasse</SelectItem><SelectItem value="Privat">Privat</SelectItem></SelectContent>
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

      {/* Verhinderungspflege (§ 39) */}
      <Card className={`${isPflegegrad1 ? 'opacity-50' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {isPflegegrad1 && <Lock className="h-4 w-4 text-muted-foreground" />}
              Verhinderungspflege (§ 39 SGB XI)
            </CardTitle>
            <Switch checked={customerData.verhinderungspflege_aktiv} onCheckedChange={(checked) => {
              if (!isPflegegrad1) {
                setCustomerData((p: any) => ({ ...p, verhinderungspflege_aktiv: checked }));
                if (checked && !budgetOrder.includes('verhinderungspflege')) setBudgetOrder((prev) => [...prev, 'verhinderungspflege']);
                else if (!checked) setBudgetOrder((prev) => prev.filter((b) => b !== 'verhinderungspflege'));
              }
            }} disabled={isPflegegrad1} />
          </div>
          {isPflegegrad1 && <p className="text-xs text-destructive">Nicht verfügbar bei Pflegegrad 1</p>}
        </CardHeader>
        {customerData.verhinderungspflege_aktiv && !isPflegegrad1 && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Beantragt</Label>
                <Select value={customerData.verhinderungspflege_beantragt ? 'ja' : 'nein'} onValueChange={(v) => setCustomerData((p: any) => ({ ...p, verhinderungspflege_beantragt: v === 'ja' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ja">Ja</SelectItem><SelectItem value="nein">Nein</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Genehmigt</Label>
                <Select value={customerData.verhinderungspflege_genehmigt ? 'ja' : 'nein'} onValueChange={(v) => setCustomerData((p: any) => ({ ...p, verhinderungspflege_genehmigt: v === 'ja' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ja">Ja</SelectItem><SelectItem value="nein">Nein</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Budget (€)</Label>
                <Input type="number" value={customerData.verhinderungspflege_budget} onChange={(e) => setCustomerData((p: any) => ({ ...p, verhinderungspflege_budget: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">💡 Jährliche Neubeantragung zum 01.01. – System erinnert automatisch.</p>
          </CardContent>
        )}
      </Card>

      {/* Umwandlung Pflegesachleistung (§ 45a) */}
      <Card className={`${isPflegegrad1 ? 'opacity-50' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {isPflegegrad1 && <Lock className="h-4 w-4 text-muted-foreground" />}
              Umwandlung Pflegesachleistung (§ 45a SGB XI)
            </CardTitle>
            <Switch checked={customerData.pflegesachleistung_aktiv} onCheckedChange={(checked) => {
              if (!isPflegegrad1) {
                setCustomerData((p: any) => ({ ...p, pflegesachleistung_aktiv: checked }));
                if (checked && !budgetOrder.includes('pflegesachleistung')) setBudgetOrder((prev) => [...prev, 'pflegesachleistung']);
                else if (!checked) setBudgetOrder((prev) => prev.filter((b) => b !== 'pflegesachleistung'));
              }
            }} disabled={isPflegegrad1} />
          </div>
          {isPflegegrad1 && <p className="text-xs text-destructive">Nicht verfügbar bei Pflegegrad 1</p>}
        </CardHeader>
        {customerData.pflegesachleistung_aktiv && !isPflegegrad1 && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Beantragt</Label>
                <Select value={customerData.pflegesachleistung_beantragt ? 'ja' : 'nein'} onValueChange={(v) => setCustomerData((p: any) => ({ ...p, pflegesachleistung_beantragt: v === 'ja' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ja">Ja</SelectItem><SelectItem value="nein">Nein</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Genehmigt</Label>
                <Select value={customerData.pflegesachleistung_genehmigt ? 'ja' : 'nein'} onValueChange={(v) => setCustomerData((p: any) => ({ ...p, pflegesachleistung_genehmigt: v === 'ja' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ja">Ja</SelectItem><SelectItem value="nein">Nein</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Budget-Priorisierung */}
      {budgetOrder.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Budget-Priorisierung</CardTitle>
            <CardDescription className="text-xs">Ziehen Sie die Budgets in die gewünschte Abrechnungsreihenfolge</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {budgetOrder.map((budget, index) => (
                <div key={budget} draggable onDragStart={() => setDraggedBudget(budget)} onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (draggedBudget && draggedBudget !== budget) { setBudgetOrder((prev) => { const newOrder = [...prev]; const fromIndex = newOrder.indexOf(draggedBudget!); const toIndex = newOrder.indexOf(budget); newOrder.splice(fromIndex, 1); newOrder.splice(toIndex, 0, draggedBudget!); return newOrder; }); } setDraggedBudget(null); }}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-colors ${draggedBudget === budget ? 'border-primary bg-primary/5' : 'bg-background hover:bg-muted/50'}`}>
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Badge variant="outline" className="text-xs">{index + 1}</Badge>
                  <span className="text-sm font-medium">
                    {budget === 'verhinderungspflege' && 'Verhinderungspflege (§ 39)'}
                    {budget === 'pflegesachleistung' && 'Pflegesachleistung (§ 45a)'}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">Die Abrechnungs-Engine verwendet diese Reihenfolge zur Budget-Priorisierung.</p>
          </CardContent>
        </Card>
      )}

      {budgetOrder.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Euro className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aktivieren Sie oben Budgets, um die Priorisierung festzulegen.</p>
        </div>
      )}
    </div>
  );
}
