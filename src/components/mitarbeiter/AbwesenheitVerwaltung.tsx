import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Palmtree, Plus, Loader2, CalendarDays, Trash2, Users } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Abwesenheit = Database['public']['Tables']['mitarbeiter_abwesenheiten']['Row'] & {
  mitarbeiter: { id: string; vorname: string | null; nachname: string | null } | null;
};

type Mitarbeiter = { id: string; vorname: string | null; nachname: string | null };

const TYP_OPTIONS = [
  { value: 'urlaub', label: 'Urlaub' },
  { value: 'krank', label: 'Krankheit' },
  { value: 'fortbildung', label: 'Fortbildung' },
  { value: 'sonstiges', label: 'Sonstiges' },
] as const;

function getTypLabel(t: string) {
  return TYP_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

export function AbwesenheitVerwaltung() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterMaId, setFilterMaId] = useState<string>('alle');
  const [selectedMaId, setSelectedMaId] = useState('');
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [typ, setTyp] = useState('urlaub');
  const [grund, setGrund] = useState('');

  const { data: mitarbeiterList = [] } = useQuery<Mitarbeiter[]>({
    queryKey: ['mitarbeiter-liste'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mitarbeiter')
        .select('id, vorname, nachname')
        .order('nachname');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: abwesenheiten = [], isLoading } = useQuery<Abwesenheit[]>({
    queryKey: ['alle-abwesenheiten'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mitarbeiter_abwesenheiten')
        .select('*, mitarbeiter:mitarbeiter_id(id, vorname, nachname)')
        .order('von', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Abwesenheit[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMaId || !user) throw new Error('Mitarbeiter und Benutzer erforderlich');
      if (!von || !bis) throw new Error('Von- und Bis-Datum erforderlich');

      const startDate = new Date(von);
      const endDate = new Date(bis);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      const { error } = await supabase
        .from('mitarbeiter_abwesenheiten')
        .insert({
          mitarbeiter_id: selectedMaId,
          von,
          bis,
          typ,
          grund: grund || null,
          status: 'approved',
          requested_by: user.id,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          zeitraum: `[${startDate.toISOString()},${endDate.toISOString()}]`,
        });
      if (error) throw error;

      // Überlappende aktive Termine des MA auf unassigned setzen
      const { data: overlapping } = await supabase
        .from('termine')
        .select('id')
        .eq('mitarbeiter_id', selectedMaId)
        .gte('start_at', startDate.toISOString())
        .lte('start_at', endDate.toISOString())
        .not('status', 'in', '("cancelled","completed","abgerechnet","bezahlt")');

      if (overlapping?.length) {
        const ids = overlapping.map((t) => t.id);
        await supabase
          .from('termine')
          .update({ mitarbeiter_id: null, status: 'unassigned' })
          .in('id', ids);
      }
    },
    onSuccess: () => {
      toast.success('Abwesenheit eingetragen');
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['alle-abwesenheiten'] });
    },
    onError: (err) => {
      toast.error('Fehler', { description: err instanceof Error ? err.message : 'Unbekannt' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('mitarbeiter_abwesenheiten').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Abwesenheit gelöscht');
      queryClient.invalidateQueries({ queryKey: ['alle-abwesenheiten'] });
    },
    onError: () => toast.error('Fehler beim Löschen'),
  });

  function resetForm() {
    setSelectedMaId('');
    setVon('');
    setBis('');
    setTyp('urlaub');
    setGrund('');
  }

  function getMaName(ma: Mitarbeiter | null) {
    if (!ma) return 'Unbekannt';
    return `${ma.vorname ?? ''} ${ma.nachname ?? ''}`.trim() || 'Unbekannt';
  }

  const filtered = filterMaId === 'alle'
    ? abwesenheiten
    : abwesenheiten.filter((a) => a.mitarbeiter_id === filterMaId);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CardTitle className="flex items-center gap-2 flex-1">
              <Palmtree className="h-5 w-5 text-emerald-600" />
              Abwesenheiten verwalten
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={filterMaId} onValueChange={setFilterMaId}>
                <SelectTrigger className="w-44 h-8 text-sm">
                  <Users className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Alle Mitarbeiter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Mitarbeiter</SelectItem>
                  {mitarbeiterList.map((ma) => (
                    <SelectItem key={ma.id} value={ma.id}>
                      {getMaName(ma)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Eintragen
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !filtered.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Keine Abwesenheiten vorhanden
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {getMaName(a.mitarbeiter)}
                        <span className="text-muted-foreground font-normal">
                          {' '}— {getTypLabel(a.typ)}
                        </span>
                        {a.grund && (
                          <span className="text-muted-foreground font-normal"> ({a.grund})</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.von ? format(new Date(a.von), 'dd.MM.yyyy', { locale: de }) : '?'}
                        {' – '}
                        {a.bis ? format(new Date(a.bis), 'dd.MM.yyyy', { locale: de }) : '?'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 text-xs">
                      Genehmigt
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(a.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Abwesenheit eintragen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mitarbeiter</Label>
              <Select value={selectedMaId} onValueChange={setSelectedMaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Mitarbeiter wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {mitarbeiterList.map((ma) => (
                    <SelectItem key={ma.id} value={ma.id}>
                      {getMaName(ma)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Typ</Label>
              <Select value={typ} onValueChange={setTyp}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYP_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Von</Label>
                <Input type="date" value={von} onChange={(e) => setVon(e.target.value)} />
              </div>
              <div>
                <Label>Bis</Label>
                <Input type="date" value={bis} onChange={(e) => setBis(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Grund / Anmerkung</Label>
              <Textarea
                value={grund}
                onChange={(e) => setGrund(e.target.value)}
                placeholder="Optional"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Abbrechen
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!selectedMaId || !von || !bis || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eintragen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
