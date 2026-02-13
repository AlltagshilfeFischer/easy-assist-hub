import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { 
  CheckCircle2, XCircle, Loader2, Clock, UserCheck, CalendarDays 
} from 'lucide-react';

export function AbwesenheitGenehmigung() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: pendingRequests, isLoading } = useQuery({
    queryKey: ['pending-absence-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mitarbeiter_abwesenheiten')
        .select(`
          *,
          mitarbeiter:mitarbeiter_id(id, vorname, nachname)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Nicht angemeldet');
      const { error } = await supabase
        .from('mitarbeiter_abwesenheiten')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Abwesenheit genehmigt');
      queryClient.invalidateQueries({ queryKey: ['pending-absence-requests'] });
    },
    onError: () => toast.error('Fehler beim Genehmigen'),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Nicht angemeldet');
      const { error } = await supabase
        .from('mitarbeiter_abwesenheiten')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Abwesenheit abgelehnt');
      queryClient.invalidateQueries({ queryKey: ['pending-absence-requests'] });
    },
    onError: () => toast.error('Fehler beim Ablehnen'),
  });

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

  if (!pendingRequests?.length) return null;

  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserCheck className="h-5 w-5 text-blue-600" />
          Offene Abwesenheitsanträge
          <Badge className="ml-2 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            {pendingRequests.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingRequests.map((req) => {
          const ma = req.mitarbeiter as any;
          const name = ma ? `${ma.vorname || ''} ${ma.nachname || ''}`.trim() : 'Unbekannt';
          const isPending = approveMutation.isPending || rejectMutation.isPending;
          
          return (
            <div
              key={req.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-background rounded-lg border"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  <span>{getTypLabel(req.typ || 'urlaub')}</span>
                  <span>·</span>
                  <span>
                    {req.von ? format(new Date(req.von), 'dd.MM.yyyy', { locale: de }) : '?'}
                    {' – '}
                    {req.bis ? format(new Date(req.bis), 'dd.MM.yyyy', { locale: de }) : '?'}
                  </span>
                </div>
                {req.grund && (
                  <p className="text-xs text-muted-foreground mt-1">Grund: {req.grund}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={isPending}
                  onClick={() => approveMutation.mutate(req.id)}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Genehmigen
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  disabled={isPending}
                  onClick={() => rejectMutation.mutate(req.id)}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Ablehnen
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
