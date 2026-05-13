import { useState } from 'react';
import { format, isAfter, isBefore, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Plus, Pencil, Trash2, Clock, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  useHaushaltshilfeVerordnungen,
  useCreateHaushaltshilfeVerordnung,
  useUpdateHaushaltshilfeVerordnung,
  useDeleteHaushaltshilfeVerordnung,
  type HaushaltshilfeVerordnung,
  type HaushaltshilfeVerordnungUpdate,
} from '@/hooks/useHaushaltshilfeVerordnungen';

interface VerordnungFormState {
  gueltig_von: string;
  gueltig_bis: string;
  termine_pro_woche: number;
  max_dauer_stunden: number;
  notizen: string;
}

const FORM_DEFAULTS: VerordnungFormState = {
  gueltig_von: '',
  gueltig_bis: '',
  termine_pro_woche: 3,
  max_dauer_stunden: 2.0,
  notizen: '',
};

function isVerordnungAktiv(verordnung: HaushaltshilfeVerordnung): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const von = parseISO(verordnung.gueltig_von);
  const bis = parseISO(verordnung.gueltig_bis);
  return !isAfter(von, today) && !isBefore(bis, today);
}

function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'dd.MM.yyyy', { locale: de });
}

interface HaushaltshilfeVerordnungenProps {
  kundenId: string;
}

export function HaushaltshilfeVerordnungen({ kundenId }: HaushaltshilfeVerordnungenProps) {
  const { data: verordnungen = [], isLoading } = useHaushaltshilfeVerordnungen(kundenId);
  const createMutation = useCreateHaushaltshilfeVerordnung();
  const updateMutation = useUpdateHaushaltshilfeVerordnung();
  const deleteMutation = useDeleteHaushaltshilfeVerordnung();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VerordnungFormState>(FORM_DEFAULTS);
  const [formError, setFormError] = useState<string | null>(null);

  function openCreateDialog() {
    setEditingId(null);
    setForm(FORM_DEFAULTS);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(v: HaushaltshilfeVerordnung) {
    setEditingId(v.id);
    setForm({
      gueltig_von: v.gueltig_von,
      gueltig_bis: v.gueltig_bis,
      termine_pro_woche: v.termine_pro_woche,
      max_dauer_stunden: v.max_dauer_stunden,
      notizen: v.notizen ?? '',
    });
    setFormError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(FORM_DEFAULTS);
    setFormError(null);
  }

  function validateForm(): boolean {
    if (!form.gueltig_von || !form.gueltig_bis) {
      setFormError('Gültig von und Gültig bis sind Pflichtfelder.');
      return false;
    }
    if (form.gueltig_von > form.gueltig_bis) {
      setFormError('"Gültig von" muss vor "Gültig bis" liegen.');
      return false;
    }
    if (form.termine_pro_woche < 1) {
      setFormError('Termine/Woche muss mindestens 1 sein.');
      return false;
    }
    if (form.max_dauer_stunden <= 0) {
      setFormError('Max. Termindauer muss größer als 0 sein.');
      return false;
    }
    setFormError(null);
    return true;
  }

  async function handleSubmit() {
    if (!validateForm()) return;

    const payload = {
      gueltig_von: form.gueltig_von,
      gueltig_bis: form.gueltig_bis,
      termine_pro_woche: form.termine_pro_woche,
      max_dauer_stunden: form.max_dauer_stunden,
      notizen: form.notizen || null,
    };

    if (editingId) {
      await updateMutation.mutateAsync({
        id: editingId,
        kundenId,
        updates: payload as HaushaltshilfeVerordnungUpdate,
      });
    } else {
      await createMutation.mutateAsync({ kunden_id: kundenId, ...payload });
    }
    closeDialog();
  }

  async function handleDelete(id: string) {
    await deleteMutation.mutateAsync({ id, kundenId });
  }

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-2">Lade Verordnungen...</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {verordnungen.length === 0
            ? 'Keine Verordnungen hinterlegt'
            : `${verordnungen.length} Verordnung${verordnungen.length !== 1 ? 'en' : ''}`}
        </span>
        <Button size="sm" variant="outline" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-1" />
          Neue Verordnung
        </Button>
      </div>

      {verordnungen.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Haushaltshilfe-Verordnung für diesen Kunden hinterlegt.
        </p>
      ) : (
        <div className="space-y-2">
          {verordnungen.map((v) => {
            const aktiv = isVerordnungAktiv(v);
            return (
              <Card key={v.id} className="border">
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {formatDate(v.gueltig_von)} – {formatDate(v.gueltig_bis)}
                    </CardTitle>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={aktiv ? 'default' : 'secondary'}>
                        {aktiv ? 'Aktiv' : 'Abgelaufen'}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openEditDialog(v)}
                        disabled={isPending}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(v.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{v.termine_pro_woche}× pro Woche</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Max. {v.max_dauer_stunden} h / Termin</span>
                    </div>
                  </div>
                  {v.notizen && (
                    <p className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 whitespace-pre-wrap">
                      {v.notizen}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Verordnung bearbeiten' : 'Neue Verordnung anlegen'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gueltig_von">Gültig von *</Label>
                <Input
                  id="gueltig_von"
                  type="date"
                  value={form.gueltig_von}
                  onChange={(e) => setForm((f) => ({ ...f, gueltig_von: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gueltig_bis">Gültig bis *</Label>
                <Input
                  id="gueltig_bis"
                  type="date"
                  value={form.gueltig_bis}
                  onChange={(e) => setForm((f) => ({ ...f, gueltig_bis: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="termine_pro_woche">Termine / Woche</Label>
                <Input
                  id="termine_pro_woche"
                  type="number"
                  min={1}
                  max={7}
                  value={form.termine_pro_woche}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, termine_pro_woche: parseInt(e.target.value, 10) || 1 }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_dauer_stunden">Max. Dauer (Stunden)</Label>
                <Input
                  id="max_dauer_stunden"
                  type="number"
                  min={0.5}
                  max={8}
                  step={0.5}
                  value={form.max_dauer_stunden}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      max_dauer_stunden: parseFloat(e.target.value) || 2.0,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notizen">Notizen (optional)</Label>
              <Textarea
                id="notizen"
                rows={3}
                placeholder="z.B. Verordnung durch Dr. Müller, Besonderheiten..."
                value={form.notizen}
                onChange={(e) => setForm((f) => ({ ...f, notizen: e.target.value }))}
              />
            </div>

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? 'Speichern...' : editingId ? 'Speichern' : 'Anlegen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
