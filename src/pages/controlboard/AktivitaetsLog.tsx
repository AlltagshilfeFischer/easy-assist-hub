import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Activity, Search, Filter, Clock, User, Database, Edit, Plus, Trash2,
  LogIn, LogOut, KeyRound, ChevronDown, ChevronRight, ArrowRight, CalendarIcon,
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { de } from 'date-fns/locale';

// ─── Constants ───────────────────────────────────────────────────────

const TABLE_LABELS: Record<string, string> = {
  auth: 'Authentifizierung',
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
  LOGIN: { label: 'Anmeldung', color: 'bg-blue-500/15 text-blue-700 border-blue-200', icon: LogIn },
  LOGOUT: { label: 'Abmeldung', color: 'bg-slate-500/15 text-slate-700 border-slate-200', icon: LogOut },
  PASSWORD_CHANGE: { label: 'Passwort', color: 'bg-purple-500/15 text-purple-700 border-purple-200', icon: KeyRound },
};

const FIELD_LABELS: Record<string, string> = {
  vorname: 'Vorname', nachname: 'Nachname', email: 'E-Mail', telefon: 'Telefon', telefonnr: 'Telefon',
  strasse: 'Straße', plz: 'PLZ', stadt: 'Stadt', stadtteil: 'Stadtteil', status: 'Status',
  aktiv: 'Aktiv', ist_aktiv: 'Aktiv', pflegegrad: 'Pflegegrad', geburtsdatum: 'Geburtsdatum',
  titel: 'Titel', start_at: 'Beginn', end_at: 'Ende', notizen: 'Notizen',
  rolle: 'Rolle', role: 'Rolle', farbe_kalender: 'Kalenderfarbe',
  mitarbeiter_id: 'Mitarbeiter', kunden_id: 'Kunde', soll_wochenstunden: 'Soll-Wochenstunden',
  is_bookable: 'Buchbar', qualification: 'Qualifikation', employment_type: 'Beschäftigungsart',
  pflegekasse: 'Pflegekasse', versichertennummer: 'Versichertennr.', kategorie: 'Kategorie',
  stunden_kontingent_monat: 'Stundenkontingent/Monat', termindauer_stunden: 'Termindauer (Std.)',
  iststunden: 'Ist-Stunden', geleistete_stunden: 'Geleistete Stunden', geplante_stunden: 'Geplante Stunden',
  unterschrift_kunde_bild: 'Kundenunterschrift', unterschrift_kunde_durch: 'Unterschrieben durch',
};

const HIDDEN_FIELDS = new Set(['updated_at', 'created_at', 'id', 'haushalt_id', 'benutzer_id', 'column1']);

const DATE_RANGES = [
  { label: 'Heute', days: 0 },
  { label: 'Letzte 7 Tage', days: 7 },
  { label: 'Letzte 30 Tage', days: 30 },
  { label: 'Alle', days: -1 },
];

// ─── Helpers ─────────────────────────────────────────────────────────

function formatFieldValue(value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  if (Array.isArray(value)) return value.length === 0 ? '—' : value.join(', ');
  if (typeof value === 'string') {
    // ISO datetime
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      try { return format(new Date(value), 'dd.MM.yyyy HH:mm', { locale: de }); } catch { /* fall through */ }
    }
    // date only
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      try { return format(new Date(value + 'T00:00:00'), 'dd.MM.yyyy', { locale: de }); } catch { /* fall through */ }
    }
  }
  return String(value);
}

function getChangedFields(oldData: Record<string, any> | null, newData: Record<string, any> | null): Array<{ field: string; old: any; new: any }> {
  if (!oldData || !newData) return [];
  const changes: Array<{ field: string; old: any; new: any }> = [];
  for (const key of Object.keys(newData)) {
    if (HIDDEN_FIELDS.has(key)) continue;
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changes.push({ field: key, old: oldData[key], new: newData[key] });
    }
  }
  return changes;
}

// ─── Component ───────────────────────────────────────────────────────

export default function AktivitaetsLog() {
  const [searchTerm, setSearchTerm] = useState('');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState(7);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-log', tableFilter, dateRange],
    queryFn: async () => {
      let query = supabase
        .from('audit_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(500);

      if (tableFilter && tableFilter !== 'all') {
        query = query.eq('table_name', tableFilter);
      }

      if (dateRange >= 0) {
        const from = startOfDay(subDays(new Date(), dateRange)).toISOString();
        query = query.gte('changed_at', from);
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
    if (user.vorname || user.nachname) return [user.vorname, user.nachname].filter(Boolean).join(' ');
    return user.email;
  };

  const getChangeSummary = (log: any): string => {
    const op = log.operation;
    const tableName = TABLE_LABELS[log.table_name] || log.table_name;

    // Auth events
    if (log.table_name === 'auth') {
      const email = (log.new_data as any)?.email || '';
      if (op === 'LOGIN') return `Anmeldung: ${email}`;
      if (op === 'LOGOUT') return `Abmeldung: ${email}`;
      if (op === 'PASSWORD_CHANGE') return `Passwort geändert: ${email}`;
      return `${op}: ${email}`;
    }

    if (op === 'INSERT' && log.new_data) {
      const d = log.new_data as Record<string, any>;
      const name = d.titel || d.name || (d.vorname ? `${d.vorname || ''} ${d.nachname || ''}`.trim() : '') || d.email || '';
      return name ? `${tableName}: „${name}" erstellt` : `Neuer Eintrag in ${tableName}`;
    }

    if (op === 'UPDATE' && log.old_data && log.new_data) {
      const changes = getChangedFields(log.old_data, log.new_data);
      if (changes.length === 0) return `${tableName} aktualisiert`;
      const fieldNames = changes.map(c => FIELD_LABELS[c.field] || c.field.replace(/_/g, ' '));
      if (fieldNames.length <= 3) return `${tableName}: ${fieldNames.join(', ')} geändert`;
      return `${tableName}: ${changes.length} Felder geändert`;
    }

    if (op === 'DELETE' && log.old_data) {
      const d = log.old_data as Record<string, any>;
      const name = d.titel || d.name || d.email || '';
      return name ? `${tableName}: „${name}" gelöscht` : `Eintrag in ${tableName} gelöscht`;
    }

    return `${op} in ${tableName}`;
  };

  const filteredLogs = useMemo(() => {
    return (logs || []).filter(log => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const summary = getChangeSummary(log).toLowerCase();
      const userName = getUserName(log.actor_benutzer_id).toLowerCase();
      const table = (TABLE_LABELS[log.table_name] || log.table_name).toLowerCase();
      return summary.includes(term) || userName.includes(term) || table.includes(term);
    });
  }, [logs, searchTerm, users]);

  const uniqueTables = useMemo(() =>
    [...new Set((logs || []).map(l => l.table_name))].sort(),
    [logs]
  );

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Stats
  const stats = useMemo(() => {
    const all = filteredLogs;
    return {
      total: all.length,
      logins: all.filter(l => l.operation === 'LOGIN').length,
      changes: all.filter(l => ['INSERT', 'UPDATE', 'DELETE'].includes(l.operation)).length,
      users: new Set(all.map(l => l.actor_benutzer_id).filter(Boolean)).size,
    };
  }, [filteredLogs]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          Aktivitätsprotokoll
        </h1>
        <p className="text-muted-foreground mt-1">
          Lückenlose Übersicht aller Benutzeraktivitäten und Systemänderungen
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="py-3">
          <CardContent className="p-0 px-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Ereignisse gesamt</div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="p-0 px-4">
            <div className="text-2xl font-bold text-primary">{stats.logins}</div>
            <div className="text-xs text-muted-foreground">Anmeldungen</div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="p-0 px-4">
            <div className="text-2xl font-bold text-accent-foreground">{stats.changes}</div>
            <div className="text-xs text-muted-foreground">Datenänderungen</div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="p-0 px-4">
            <div className="text-2xl font-bold text-secondary-foreground">{stats.users}</div>
            <div className="text-xs text-muted-foreground">Aktive Benutzer</div>
          </CardContent>
        </Card>
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
            <div className="flex gap-1">
              {DATE_RANGES.map(r => (
                <Button
                  key={r.days}
                  variant={dateRange === r.days ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateRange(r.days)}
                  className="text-xs"
                >
                  {r.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log entries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center justify-between">
            <span>Aktivitäten</span>
            <Badge variant="secondary">{filteredLogs.length} Einträge</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-420px)]">
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
                  const isExpanded = expandedIds.has(log.id);
                  const hasDetail = log.operation === 'UPDATE' || log.operation === 'INSERT' || log.operation === 'DELETE';
                  const changes = log.operation === 'UPDATE'
                    ? getChangedFields(log.old_data as any, log.new_data as any)
                    : [];

                  return (
                    <Collapsible key={log.id} open={isExpanded} onOpenChange={() => hasDetail && toggleExpand(log.id)}>
                      <CollapsibleTrigger asChild disabled={!hasDetail}>
                        <div className={`flex items-start gap-3 px-4 py-3 transition-colors ${hasDetail ? 'cursor-pointer hover:bg-muted/50' : ''}`}>
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
                                {log.table_name === 'auth' && (log.new_data as any)?.email
                                  ? (log.new_data as any).email
                                  : getUserName(log.actor_benutzer_id)
                                }
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(log.changed_at), 'dd.MM.yyyy HH:mm:ss', { locale: de })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="text-xs">
                              {TABLE_LABELS[log.table_name] || log.table_name}
                            </Badge>
                            <Badge className={`text-xs ${opCfg.color} border`} variant="outline">
                              {opCfg.label}
                            </Badge>
                            {hasDetail && (
                              isExpanded
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      {hasDetail && (
                        <CollapsibleContent>
                          <div className="px-4 pb-3 pl-12">
                            {/* UPDATE: show field-level diff */}
                            {log.operation === 'UPDATE' && changes.length > 0 && (
                              <div className="rounded-md border bg-muted/30 divide-y text-sm">
                                <div className="grid grid-cols-[180px_1fr_24px_1fr] gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                                  <span>Feld</span>
                                  <span>Alter Wert</span>
                                  <span />
                                  <span>Neuer Wert</span>
                                </div>
                                {changes.map(c => (
                                  <div key={c.field} className="grid grid-cols-[180px_1fr_24px_1fr] gap-2 px-3 py-1.5 items-center text-xs">
                                    <span className="font-medium text-foreground">
                                      {FIELD_LABELS[c.field] || c.field.replace(/_/g, ' ')}
                                    </span>
                                    <span className="text-destructive/80 line-through truncate">
                                      {formatFieldValue(c.old)}
                                    </span>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-emerald-700 font-medium truncate">
                                      {formatFieldValue(c.new)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* INSERT: show created fields */}
                            {log.operation === 'INSERT' && log.new_data && (
                              <div className="rounded-md border bg-muted/30 divide-y text-sm">
                                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                                  Erstellte Daten
                                </div>
                                {Object.entries(log.new_data as Record<string, any>)
                                  .filter(([k]) => !HIDDEN_FIELDS.has(k) && (log.new_data as any)[k] !== null)
                                  .slice(0, 12)
                                  .map(([k, v]) => (
                                    <div key={k} className="grid grid-cols-[180px_1fr] gap-2 px-3 py-1 text-xs">
                                      <span className="font-medium">{FIELD_LABELS[k] || k.replace(/_/g, ' ')}</span>
                                      <span className="text-emerald-700 truncate">{formatFieldValue(v)}</span>
                                    </div>
                                  ))
                                }
                              </div>
                            )}

                            {/* DELETE: show deleted fields */}
                            {log.operation === 'DELETE' && log.old_data && (
                              <div className="rounded-md border bg-destructive/5 divide-y text-sm">
                                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                                  Gelöschte Daten
                                </div>
                                {Object.entries(log.old_data as Record<string, any>)
                                  .filter(([k]) => !HIDDEN_FIELDS.has(k) && (log.old_data as any)[k] !== null)
                                  .slice(0, 12)
                                  .map(([k, v]) => (
                                    <div key={k} className="grid grid-cols-[180px_1fr] gap-2 px-3 py-1 text-xs">
                                      <span className="font-medium">{FIELD_LABELS[k] || k.replace(/_/g, ' ')}</span>
                                      <span className="text-destructive/80 line-through truncate">{formatFieldValue(v)}</span>
                                    </div>
                                  ))
                                }
                              </div>
                            )}

                            {log.operation === 'UPDATE' && changes.length === 0 && (
                              <p className="text-xs text-muted-foreground italic">Keine sichtbaren Feldänderungen</p>
                            )}
                          </div>
                        </CollapsibleContent>
                      )}
                    </Collapsible>
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
