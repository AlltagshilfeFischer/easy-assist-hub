import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
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
import { 
  Palmtree, Plus, Clock, CheckCircle2, XCircle, Loader2, CalendarDays 
} from 'lucide-react';

interface AbwesenheitAnfrageProps {
  /** If true, GF can enter absences directly (no approval needed) */
  directEntry?: boolean;
}

export function AbwesenheitAnfrage({ directEntry = false }: AbwesenheitAnfrageProps) {
  const { mitarbeiterId } = useUserRole();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [grund, setGrund] = useState('');
  const [typ, setTyp] = useState('urlaub');

  const { data: absences, isLoading } = useQuery({
    queryKey: ['my-absences', mitarbeiterId],
    queryFn: async () => {
      if (!mitarbeiterId) return [];
      const { data, error } = await supabase
        .from('mitarbeiter_abwesenheiten')
        .select('*')
        .eq('mitarbeiter_id', mitarbeiterId)
        .order('von', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!mitarbeiterId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!mitarbeiterId || !user) throw new Error('Keine Mitarbeiter-ID');
      
      const startDate = new Date(von);
      const endDate = new Date(bis);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      const { error } = await supabase
        .from('mitarbeiter_abwesenheiten')
        .insert({
          mitarbeiter_id: mitarbeiterId,
          zeitraum: `[${startDate.toISOString()},${endDate.toISOString()}]`,
          grund: grund || null,
          status: directEntry ? 'approved' : 'pending',
          requested_by: user.id,
          approved_by: directEntry ? user.id : null,
          approved_at: directEntry ? new Date().toISOString() : null,
          typ,
          von,
          bis,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(directEntry ? 'Abwesenheit eingetragen' : 'Urlaubsantrag eingereicht');
      setDialogOpen(false);
      setVon('');
      setBis('');
      setGrund('');
      setTyp('urlaub');
      queryClient.invalidateQueries({ queryKey: ['my-absences'] });
    },
    onError: (err) => {
      toast.error('Fehler', { description: err instanceof Error ? err.message : 'Unbekannt' });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200">
            <Clock className="h-3 w-3 mr-1" />
            Ausstehend
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Genehmigt
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Abgelehnt
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypLabel = (t: string) => {
    switch (t) {
      case 'urlaub': return 'Urlaub';
      case 'krank': return 'Krankheit';
      case 'fortbildung': return 'Fortbildung';
      case 'sonstiges': return 'Sonstiges';
      default: return t;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Palmtree className="h-5 w-5 text-emerald-600" />
              {directEntry ? 'Meine Abwesenheiten' : 'Urlaub & Abwesenheiten'}
            </CardTitle>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {directEntry ? 'Eintragen' : 'Beantragen'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!absences?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Keine Abwesenheiten vorhanden
            </p>
          ) : (
            <div className="space-y-2">
              {absences.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">
                        {getTypLabel(a.typ || 'urlaub')}
                        {a.grund && <span className="text-muted-foreground font-normal"> — {a.grund}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.von ? format(new Date(a.von), 'dd.MM.yyyy', { locale: de }) : '?'} 
                        {' – '}
                        {a.bis ? format(new Date(a.bis), 'dd.MM.yyyy', { locale: de }) : '?'}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(a.status || 'approved')}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {directEntry ? 'Abwesenheit eintragen' : 'Abwesenheit beantragen'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Typ</Label>
              <Select value={typ} onValueChange={setTyp}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urlaub">Urlaub</SelectItem>
                  <SelectItem value="krank">Krankheit</SelectItem>
                  <SelectItem value="fortbildung">Fortbildung</SelectItem>
                  <SelectItem value="sonstiges">Sonstiges</SelectItem>
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
            {!directEntry && (
              <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-200 dark:border-amber-800">
                Ihr Antrag muss von der Geschäftsführung genehmigt werden, bevor die Termine blockiert werden.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!von || !bis || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {directEntry ? 'Eintragen' : 'Beantragen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
