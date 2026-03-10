import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

const BEREICHE = [
  'Dienstplan & Terminplanung',
  'Kundenverwaltung',
  'Mitarbeiterverwaltung',
  'Dokumentenverwaltung',
  'Leistungsnachweise',
  'Abrechnung / Billing',
  'Benutzerverwaltung & Rollen',
  'Dashboard & Statistiken',
  'Mitarbeiter-Portal',
  'Sonstiges',
];

interface DevTodo {
  id: string;
  bereich: string;
  titel: string;
  erledigt: boolean;
  erstellt_von: string;
  created_at: string;
}

export default function EntwicklungsStatus() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [newTodoTexts, setNewTodoTexts] = useState<Record<string, string>>({});

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ['development-todos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('development_todos')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as DevTodo[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({ bereich, titel }: { bereich: string; titel: string }) => {
      const { error } = await supabase.from('development_todos').insert({
        bereich,
        titel,
        erstellt_von: session?.user?.id ?? '',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-todos'] });
      toast.success('ToDo hinzugefügt');
    },
    onError: () => toast.error('Fehler beim Hinzufügen'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, erledigt }: { id: string; erledigt: boolean }) => {
      const { error } = await supabase
        .from('development_todos')
        .update({ erledigt, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['development-todos'] }),
    onError: () => toast.error('Fehler beim Aktualisieren'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('development_todos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-todos'] });
      toast.success('ToDo gelöscht');
    },
    onError: () => toast.error('Fehler beim Löschen'),
  });

  const todosByBereich = useMemo(() => {
    const map: Record<string, DevTodo[]> = {};
    for (const b of BEREICHE) map[b] = [];
    for (const t of todos) {
      if (!map[t.bereich]) map[t.bereich] = [];
      map[t.bereich].push(t);
    }
    return map;
  }, [todos]);

  const overallProgress = useMemo(() => {
    if (todos.length === 0) return 0;
    const done = todos.filter((t) => t.erledigt).length;
    return Math.round((done / todos.length) * 100);
  }, [todos]);

  const bereichProgress = (bereich: string) => {
    const items = todosByBereich[bereich] || [];
    if (items.length === 0) return null;
    const done = items.filter((t) => t.erledigt).length;
    return Math.round((done / items.length) * 100);
  };

  const handleAdd = (bereich: string) => {
    const text = (newTodoTexts[bereich] || '').trim();
    if (!text) return;
    addMutation.mutate({ bereich, titel: text });
    setNewTodoTexts((prev) => ({ ...prev, [bereich]: '' }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header with overall progress */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />
            <div className="flex-1">
              <CardTitle className="text-xl">Entwicklungsstand</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Gesamtfortschritt der Webanwendung
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-primary">{overallProgress}%</span>
              <p className="text-xs text-muted-foreground">
                {todos.filter((t) => t.erledigt).length} / {todos.length} erledigt
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={overallProgress} className="h-3" />
        </CardContent>
      </Card>

      {/* Per-area cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {BEREICHE.map((bereich) => {
          const items = todosByBereich[bereich] || [];
          const progress = bereichProgress(bereich);

          return (
            <Card key={bereich}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{bereich}</CardTitle>
                  <div className="flex items-center gap-2">
                    {progress !== null && (
                      <Badge variant={progress === 100 ? 'default' : 'secondary'}>
                        {progress}%
                      </Badge>
                    )}
                    <Badge variant="outline">{items.length}</Badge>
                  </div>
                </div>
                {progress !== null && <Progress value={progress} className="h-1.5 mt-2" />}
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Todo list */}
                {items.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-center gap-2 group rounded-md p-1.5 hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={todo.erledigt}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: todo.id, erledigt: !!checked })
                      }
                    />
                    <span
                      className={`flex-1 text-sm ${
                        todo.erledigt ? 'line-through text-muted-foreground' : ''
                      }`}
                    >
                      {todo.titel}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(todo.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}

                {/* Add new */}
                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="Neues ToDo..."
                    className="h-8 text-sm"
                    value={newTodoTexts[bereich] || ''}
                    onChange={(e) =>
                      setNewTodoTexts((prev) => ({ ...prev, [bereich]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAdd(bereich);
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => handleAdd(bereich)}
                    disabled={!(newTodoTexts[bereich] || '').trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
