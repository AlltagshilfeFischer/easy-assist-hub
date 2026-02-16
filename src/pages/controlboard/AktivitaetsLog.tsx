import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Search, Filter, Clock, User, Database, Edit, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const TABLE_LABELS: Record<string, string> = {
  termine: 'Termine',
  kunden: 'Kunden',
  mitarbeiter: 'Mitarbeiter',
  benutzer: 'Benutzer',
  leistungsnachweise: 'Leistungsnachweise',
  dokumente: 'Dokumente',
  rechnungen: 'Rechnungen',
  haushalte: 'Haushalte',
  leistungen: 'Leistungen',
  mitarbeiter_abwesenheiten: 'Abwesenheiten',
  termin_vorlagen: 'Terminvorlagen',
  user_roles: 'Benutzerrollen',
};

const OP_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  INSERT: { label: 'Erstellt', color: 'bg-emerald-500/15 text-emerald-700 border-emerald-200', icon: Plus },
  UPDATE: { label: 'Geändert', color: 'bg-amber-500/15 text-amber-700 border-amber-200', icon: Edit },
  DELETE: { label: 'Gelöscht', color: 'bg-destructive/15 text-destructive border-destructive/30', icon: Trash2 },
};

export default function AktivitaetsLog() {
  const [searchTerm, setSearchTerm] = useState('');
  const [tableFilter, setTableFilter] = useState<string>('all');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-log', tableFilter],
    queryFn: async () => {
      let query = supabase
        .from('audit_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(200);

      if (tableFilter && tableFilter !== 'all') {
        query = query.eq('table_name', tableFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ['benutzer-names'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('benutzer')
        .select('id, vorname, nachname, email');
      if (error) throw error;
      return data;
    },
  });

  const getUserName = (userId: string | null) => {
    if (!userId || !users) return 'System';
    const user = users.find(u => u.id === userId);
    if (!user) return 'Unbekannt';
    if (user.vorname || user.nachname) {
      return [user.vorname, user.nachname].filter(Boolean).join(' ');
    }
    return user.email;
  };

  const getChangeSummary = (log: any): string => {
    const op = log.operation;
    const tableName = TABLE_LABELS[log.table_name] || log.table_name;

    if (op === 'INSERT' && log.new_data) {
      const d = log.new_data as Record<string, any>;
      const name = d.titel || d.name || d.vorname ? `${d.vorname || ''} ${d.nachname || ''}`.trim() : d.email || '';
      return name ? `${tableName}: "${name}" erstellt` : `Neuer Eintrag in ${tableName}`;
    }

    if (op === 'UPDATE' && log.old_data && log.new_data) {
      const oldD = log.old_data as Record<string, any>;
      const newD = log.new_data as Record<string, any>;
      const changes: string[] = [];
      for (const key of Object.keys(newD)) {
        if (['updated_at', 'created_at'].includes(key)) continue;
        if (JSON.stringify(oldD[key]) !== JSON.stringify(newD[key])) {
          changes.push(key.replace(/_/g, ' '));
        }
      }
      if (changes.length === 0) return `${tableName} aktualisiert`;
      if (changes.length <= 3) return `${tableName}: ${changes.join(', ')} geändert`;
      return `${tableName}: ${changes.length} Felder geändert`;
    }

    if (op === 'DELETE' && log.old_data) {
      const d = log.old_data as Record<string, any>;
      const name = d.titel || d.name || d.email || '';
      return name ? `${tableName}: "${name}" gelöscht` : `Eintrag in ${tableName} gelöscht`;
    }

    return `${op} in ${tableName}`;
  };

  const filteredLogs = (logs || []).filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const summary = getChangeSummary(log).toLowerCase();
    const userName = getUserName(log.actor_benutzer_id).toLowerCase();
    const table = (TABLE_LABELS[log.table_name] || log.table_name).toLowerCase();
    return summary.includes(term) || userName.includes(term) || table.includes(term);
  });

  const uniqueTables = [...new Set((logs || []).map(l => l.table_name))].sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          Aktivitätsprotokoll
        </h1>
        <p className="text-muted-foreground mt-1">
          Übersicht aller Änderungen und Tätigkeiten im System
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suchen nach Benutzer, Aktion, Bereich..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Alle Bereiche" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Bereiche</SelectItem>
                {uniqueTables.map(t => (
                  <SelectItem key={t} value={t}>
                    {TABLE_LABELS[t] || t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Log entries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center justify-between">
            <span>Letzte Aktivitäten</span>
            <Badge variant="secondary">{filteredLogs.length} Einträge</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-340px)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Database className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Keine Aktivitäten gefunden</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredLogs.map((log) => {
                  const opCfg = OP_CONFIG[log.operation] || OP_CONFIG.UPDATE;
                  const OpIcon = opCfg.icon;
                  return (
                    <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                      <div className={`mt-0.5 rounded-md p-1.5 ${opCfg.color}`}>
                        <OpIcon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {getChangeSummary(log)}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {getUserName(log.actor_benutzer_id)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(log.changed_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {TABLE_LABELS[log.table_name] || log.table_name}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
