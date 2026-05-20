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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Palmtree, Plus, Loader2, CalendarDays, Trash2, Search, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type Abwesenheit = Database['public']['Tables']['mitarbeiter_abwesenheiten']['Row'] & {
  mitarbeiter: { id: string; vorname: string | null; nachname: string | null } | null;
};

type Mitarbeiter = { id: string; vorname: string | null; nachname: string | null };

type ZeitraumFilter = 'aktuell' | 'vergangen' | 'alle';

const TYP_OPTIONS = [
  { value: 'urlaub', label: 'Urlaub' },
  { value: 'krank', label: 'Krankheit' },
  { value: 'fortbildung', label: 'Fortbildung' },
  { value: 'sonstiges', label: 'Sonstiges' },
] as const;

function getTypLabel(t: string) {
  return TYP_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

interface AbwesenheitVerwaltungProps {
  embedded?: boolean;
}

export function AbwesenheitVerwaltung({ embedded = false }: AbwesenheitVerwaltungProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [maComboOpen, setMaComboOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [zeitraumFilter, setZeitraumFilter] = useState<ZeitraumFilter>('aktuell');
  const [selectedMaId, setSelectedMaId] = useState('');
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [typ, setTyp] = useState('urlaub');
  const [grund, setGrund] = useState('');

  const today = new Date().toISOString().split('T')[0];

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
    queryKey: ['alle-abwesenheiten', zeitraumFilter],
    queryFn: async () => {
      let query = supabase
        .from('mitarbeiter_abwesenheiten')
        .select('*, mitarbeiter:mitarbeiter_id(id, vorname, nachname)')
        .order('von', { ascending: false });

      if (zeitraumFilter === 'aktuell') {
        query = query.gte('bis', today);
      } else if (zeitraumFilter === 'vergangen') {
        query = query.lt('bis', today);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Abwesenheit[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMaId || !user) throw new Error('Mitarbeiter und Benutzer erforderlich');
      if (!von || !bis) throw new Error('Von- und Bis-Datum erforderlich');

      // Parse as local midnight to avoid UTC-offset issues
      const startDate = new Date(von + 'T00:00:00');
      const endDate = new Date(bis + 'T23:59:59');

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

      // Scheduled + in_progress Termine im Zeitraum auf unassigned setzen
      const { data: overlapping, error: selectError } = await supabase
        .from('termine')
        .select('id')
        .eq('mitarbeiter_id', selectedMaId)
        .in('status', ['scheduled', 'in_progress'])
        .gte('start_at', startDate.toISOString())
        .lte('start_at', endDate.toISOString());

      if (selectError) {
        console.error('Termine-Abfrage fehlgeschlagen:', selectError);
      }

      if (overlapping?.length) {
        const ids = overlapping.map((t) => t.id);
        const { error: unassignError } = await supabase
          .from('termine')
          .update({ mitarbeiter_id: null, status: 'unassigned' })
          .in('id', ids);
        if (unassignError) throw unassignError;

        const typLabel = TYP_OPTIONS.find((o) => o.value === typ)?.label ?? typ;
        const reason = `Automatisch freigegeben: Abwesenheit ${typLabel} ${von} – ${bis}`;
        const { error: historyError } = await supabase.from('termin_aenderungen').insert(
          ids.map((terminId) => ({
            termin_id: terminId,
            requested_by: user!.id,
            status: 'approved' as const,
            old_mitarbeiter_id: selectedMaId,
            new_mitarbeiter_id: null,
            reason,
            approver_id: user!.id,
            approved_at: new Date().toISOString(),
          })),
        );
        if (historyError) throw historyError;
      }

      return { movedCount: overlapping?.length ?? 0, bis };
    },
    onSuccess: ({ movedCount, bis: bisDate }) => {
      const msg =
        movedCount > 0
          ? `Abwesenheit eingetragen — ${movedCount} Termin${movedCount !== 1 ? 'e' : ''} freigegeben`
          : 'Abwesenheit eingetragen';
      toast.success(msg);
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['alle-abwesenheiten'] });
      queryClient.invalidateQueries({ queryKey: ['termine'] });
      // Tab automatisch auf den passenden Zeitraum setzen, damit die neue Abwesenheit sichtbar ist
      setZeitraumFilter(bisDate < today ? 'vergangen' : 'aktuell');
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
    setMaComboOpen(false);
  }

  function getMaName(ma: Mitarbeiter | null) {
    if (!ma) return 'Unbekannt';
    return `${ma.vorname ?? ''} ${ma.nachname ?? ''}`.trim() || 'Unbekannt';
  }

  const selectedMaName = mitarbeiterList.find((m) => m.id === selectedMaId);

  const filtered = abwesenheiten.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = getMaName(a.mitarbeiter).toLowerCase();
    const typStr = getTypLabel(a.typ ?? '').toLowerCase();
    return name.includes(q) || typStr.includes(q);
  });

  const zeitraumTabs: { value: ZeitraumFilter; label: string }[] = [
    { value: 'aktuell', label: 'Aktuell' },
    { value: 'vergangen', label: 'Vergangen' },
    { value: 'alle', label: 'Alle' },
  ];

  const toolbar = (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-40">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-8 h-8 text-sm"
          placeholder="Name oder Typ suchen…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <div className="flex border rounded-md overflow-hidden h-8 shrink-0">
        {zeitraumTabs.map((tab) => (
          <button
            key={tab.value}
            className={`px-3 text-xs font-medium transition-colors ${
              zeitraumFilter === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
            onClick={() => setZeitraumFilter(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <Button size="sm" className="shrink-0" onClick={() => setDialogOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        Eintragen
      </Button>
    </div>
  );

  const list = isLoading ? (
    <div className="flex justify-center py-6">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ) : !filtered.length ? (
    <p className="text-sm text-muted-foreground text-center py-4">
      {searchQuery.trim() ? 'Keine Treffer für Ihre Suche' : 'Keine Abwesenheiten vorhanden'}
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
                  {' '}— {getTypLabel(a.typ ?? '')}
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
  );

  return (
    <>
      {embedded ? (
        <div className="space-y-3">
          {toolbar}
          {list}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3">
              <CardTitle className="flex items-center gap-2">
                <Palmtree className="h-5 w-5 text-emerald-600" />
                Abwesenheiten verwalten
              </CardTitle>
              {toolbar}
            </div>
          </CardHeader>
          <CardContent>{list}</CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Abwesenheit eintragen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mitarbeiter</Label>
              <Popover open={maComboOpen} onOpenChange={setMaComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={maComboOpen}
                    className="w-full justify-between font-normal"
                  >
                    {selectedMaName ? getMaName(selectedMaName) : 'Mitarbeiter suchen…'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Name suchen…" />
                    <CommandList>
                      <CommandEmpty>Kein Mitarbeiter gefunden</CommandEmpty>
                      <CommandGroup>
                        {mitarbeiterList.map((ma) => (
                          <CommandItem
                            key={ma.id}
                            value={getMaName(ma)}
                            onSelect={() => {
                              setSelectedMaId(ma.id);
                              setMaComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn('mr-2 h-4 w-4', selectedMaId === ma.id ? 'opacity-100' : 'opacity-0')}
                            />
                            {getMaName(ma)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
