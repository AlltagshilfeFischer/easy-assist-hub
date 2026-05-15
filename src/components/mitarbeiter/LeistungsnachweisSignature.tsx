import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  FileText, PenLine, CheckCircle2,
  Loader2, EyeOff, Eye, ChevronDown, RefreshCw, WifiOff, UserCheck
} from 'lucide-react';
import KundenSignaturPad from '@/components/leistungsnachweis/KundenSignaturPad';

interface LNRow {
  id: string;
  kunden_id: string;
  monat: number;
  jahr: number;
  status: string;
  unterschrift_kunde_zeitstempel: string | null;
  unterschrift_mitarbeiter_zeitstempel: string | null;
  computedGeplant: number;
  computedGeleistet: number;
}

interface Termin {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  iststunden: number | null;
}

const monthNames = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

export function LeistungsnachweisSignature() {
  const { mitarbeiterId } = useUserRole();
  const queryClient = useQueryClient();

  const [activeSignatur, setActiveSignatur] = useState<{ lnId: string; type: 'kunde' | 'ma' } | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hiddenKundeIds, setHiddenKundeIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ln-ma-hidden-kunde') || '[]')); }
    catch { return new Set(); }
  });
  const [hiddenMaIds, setHiddenMaIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ln-ma-hidden-ma') || '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Alle LNs für diesen Monat wo MA Termine hatte (unabhängig von Status)
  const { data: allLN, isLoading } = useQuery({
    queryKey: ['ma-ln-alle', mitarbeiterId],
    queryFn: async () => {
      if (!mitarbeiterId) return [];

      const { data: lns, error: lnError } = await supabase
        .from('leistungsnachweise')
        .select('id, kunden_id, monat, jahr, status, unterschrift_kunde_zeitstempel, unterschrift_mitarbeiter_zeitstempel')
        .not('status', 'eq', 'abgeschlossen')
        .order('jahr', { ascending: false })
        .order('monat', { ascending: false });
      if (lnError) throw lnError;
      if (!lns?.length) return [];

      const { data: myTermine, error: tError } = await supabase
        .from('termine')
        .select('kunden_id, start_at, end_at, status, iststunden')
        .eq('mitarbeiter_id', mitarbeiterId)
        .not('kunden_id', 'is', null);
      if (tError) throw tError;

      const now = new Date();
      const myKeys = new Set<string>();
      const hoursMap = new Map<string, { geplant: number; geleistet: number }>();

      for (const t of myTermine ?? []) {
        const d = new Date(t.start_at);
        const key = `${t.kunden_id}-${d.getMonth() + 1}-${d.getFullYear()}`;
        myKeys.add(key);
        if (['cancelled', 'abgesagt_rechtzeitig'].includes(t.status)) continue;
        const duration = (new Date(t.end_at).getTime() - new Date(t.start_at).getTime()) / 3600000;
        const cur = hoursMap.get(key) || { geplant: 0, geleistet: 0 };
        cur.geplant += duration;
        const effectiveStatus = t.status === 'scheduled' && new Date(t.end_at) < now ? 'completed' : t.status;
        if (['completed', 'nicht_angetroffen'].includes(effectiveStatus)) {
          cur.geleistet += t.iststunden ? Number(t.iststunden) : duration;
        }
        hoursMap.set(key, cur);
      }

      return lns
        .filter(ln => myKeys.has(`${ln.kunden_id}-${ln.monat}-${ln.jahr}`))
        .map(ln => {
          const h = hoursMap.get(`${ln.kunden_id}-${ln.monat}-${ln.jahr}`) || { geplant: 0, geleistet: 0 };
          return {
            ...ln,
            computedGeplant: Math.round(h.geplant * 100) / 100,
            computedGeleistet: Math.round(h.geleistet * 100) / 100,
          } as LNRow;
        });
    },
    enabled: !!mitarbeiterId,
  });

  const selectedLN = useMemo(
    () => allLN?.find(ln => ln.id === activeSignatur?.lnId) ?? null,
    [allLN, activeSignatur]
  );

  const { data: termine } = useQuery({
    queryKey: ['ma-ln-termine', selectedLN?.kunden_id, selectedLN?.monat, selectedLN?.jahr],
    queryFn: async () => {
      if (!selectedLN) return [];
      const von = new Date(selectedLN.jahr, selectedLN.monat - 1, 1).toISOString();
      const bis = new Date(selectedLN.jahr, selectedLN.monat, 0, 23, 59, 59).toISOString();
      const { data, error } = await supabase
        .from('termine')
        .select('id, start_at, end_at, status, iststunden')
        .eq('kunden_id', selectedLN.kunden_id)
        .gte('start_at', von)
        .lte('start_at', bis)
        .order('start_at');
      if (error) throw error;
      return data as Termin[];
    },
    enabled: !!selectedLN,
  });

  const { data: kunden } = useQuery({
    queryKey: ['kunden-names-ma'],
    queryFn: async () => {
      const { data, error } = await supabase.from('kunden').select('id, vorname, nachname, name');
      if (error) throw error;
      return data;
    },
  });

  const getKundeName = (kundenId: string) => {
    const k = kunden?.find(c => c.id === kundenId);
    if (!k) return 'Unbekannt';
    return [k.vorname, k.nachname].filter(Boolean).join(' ') || k.name || 'Unbekannt';
  };

  const syncKundeToDb = async (lnId: string, data: { dataUrl: string; zeitstempel: string; durch: string; frozenGeplant: number; frozenGeleistet: number }) => {
    const { error } = await supabase
      .from('leistungsnachweise')
      .update({
        unterschrift_kunde_bild: data.dataUrl,
        unterschrift_kunde_zeitstempel: data.zeitstempel,
        unterschrift_kunde_durch: data.durch,
        status: 'unterschrieben',
        frozen_geplante_stunden: data.frozenGeplant,
        frozen_geleistete_stunden: data.frozenGeleistet,
      })
      .eq('id', lnId);
    if (error) throw error;
  };

  const syncMaToDb = async (lnId: string, data: { dataUrl: string; zeitstempel: string; durch: string }) => {
    const { error } = await supabase
      .from('leistungsnachweise')
      .update({
        unterschrift_mitarbeiter_bild: data.dataUrl,
        unterschrift_mitarbeiter_zeitstempel: data.zeitstempel,
        unterschrift_mitarbeiter_durch: data.durch,
      })
      .eq('id', lnId);
    if (error) throw error;
  };

  // Auto-sync pending on reconnect
  useEffect(() => {
    if (!isOnline) return;
    const syncPending = async () => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('pending_ma_sig_') || k.startsWith('pending_ma_own_'));
      if (!keys.length) return;
      for (const key of keys) {
        const isKunde = key.startsWith('pending_ma_sig_');
        const lnId = key.replace(isKunde ? 'pending_ma_sig_' : 'pending_ma_own_', '');
        try {
          const data = JSON.parse(localStorage.getItem(key) || '');
          if (isKunde) await syncKundeToDb(lnId, data);
          else await syncMaToDb(lnId, data);
          localStorage.removeItem(key);
          toast.success('Unterschrift synchronisiert');
        } catch (err) {
          console.error('Sync fehlgeschlagen:', lnId, err);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['ma-ln-alle'] });
    };
    syncPending();
  }, [isOnline]);

  const hasPending = useMemo(
    () => Object.keys(localStorage).some(k => k.startsWith('pending_ma_sig_') || k.startsWith('pending_ma_own_')),
    [isOnline]
  );

  const handleSignatur = async (dataUrl: string, durch: string) => {
    if (!activeSignatur) return;
    const { lnId, type } = activeSignatur;
    const ln = allLN?.find(l => l.id === lnId);
    if (!ln) return;

    const zeitstempel = new Date().toISOString();

    if (type === 'kunde') {
      const pendingData = { dataUrl, zeitstempel, durch, frozenGeplant: ln.computedGeplant, frozenGeleistet: ln.computedGeleistet };
      localStorage.setItem(`pending_ma_sig_${lnId}`, JSON.stringify(pendingData));
      setActiveSignatur(null);
      if (isOnline) {
        try {
          await syncKundeToDb(lnId, pendingData);
          localStorage.removeItem(`pending_ma_sig_${lnId}`);
          toast.success('Kunden-Unterschrift gespeichert');
        } catch {
          toast.success('Lokal gespeichert', { description: 'Wird synchronisiert, sobald Internet verfügbar.' });
        }
      } else {
        toast.success('Lokal gespeichert', { description: 'Wird synchronisiert, sobald Internet verfügbar.' });
      }
    } else {
      const pendingData = { dataUrl, zeitstempel, durch };
      localStorage.setItem(`pending_ma_own_${lnId}`, JSON.stringify(pendingData));
      setActiveSignatur(null);
      if (isOnline) {
        try {
          await syncMaToDb(lnId, pendingData);
          localStorage.removeItem(`pending_ma_own_${lnId}`);
          toast.success('Eigene Unterschrift gespeichert');
        } catch {
          toast.success('Lokal gespeichert', { description: 'Wird synchronisiert, sobald Internet verfügbar.' });
        }
      } else {
        toast.success('Lokal gespeichert', { description: 'Wird synchronisiert, sobald Internet verfügbar.' });
      }
    }
    queryClient.invalidateQueries({ queryKey: ['ma-ln-alle'] });
  };

  const kundeAusstehend = allLN?.filter(ln => !ln.unterschrift_kunde_zeitstempel && !hiddenKundeIds.has(ln.id)) || [];
  const kundeHidden = allLN?.filter(ln => !ln.unterschrift_kunde_zeitstempel && hiddenKundeIds.has(ln.id)) || [];
  const maAusstehend = allLN?.filter(ln => !ln.unterschrift_mitarbeiter_zeitstempel && !hiddenMaIds.has(ln.id)) || [];
  const maHidden = allLN?.filter(ln => !ln.unterschrift_mitarbeiter_zeitstempel && hiddenMaIds.has(ln.id)) || [];

  const hide = (id: string, type: 'kunde' | 'ma') => {
    if (type === 'kunde') {
      setHiddenKundeIds(prev => { const n = new Set(prev); n.add(id); localStorage.setItem('ln-ma-hidden-kunde', JSON.stringify([...n])); return n; });
    } else {
      setHiddenMaIds(prev => { const n = new Set(prev); n.add(id); localStorage.setItem('ln-ma-hidden-ma', JSON.stringify([...n])); return n; });
    }
  };
  const unhide = (id: string, type: 'kunde' | 'ma') => {
    if (type === 'kunde') {
      setHiddenKundeIds(prev => { const n = new Set(prev); n.delete(id); localStorage.setItem('ln-ma-hidden-kunde', JSON.stringify([...n])); return n; });
    } else {
      setHiddenMaIds(prev => { const n = new Set(prev); n.delete(id); localStorage.setItem('ln-ma-hidden-ma', JSON.stringify([...n])); return n; });
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

  const renderLNRow = (ln: LNRow, type: 'kunde' | 'ma') => (
    <div key={ln.id} className="flex items-center justify-between p-3 border rounded-lg">
      <div>
        <p className="font-medium text-sm">{getKundeName(ln.kunden_id)}</p>
        <p className="text-xs text-muted-foreground">
          {monthNames[ln.monat - 1]} {ln.jahr}
          {' · '}
          <span className="font-medium">{ln.computedGeleistet.toFixed(1)} h</span> geleistet
          {' · '}
          {ln.computedGeplant.toFixed(1)} h geplant
        </p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <Button size="sm" variant="ghost" className="text-muted-foreground h-8 w-8 p-0" onClick={() => hide(ln.id, type)} title="Ausblenden">
          <EyeOff className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" onClick={() => setActiveSignatur({ lnId: ln.id, type })}>
          <PenLine className="h-3.5 w-3.5 mr-1.5" />
          {type === 'kunde' ? 'Kunden unterschreiben lassen' : 'Selbst unterschreiben'}
        </Button>
      </div>
    </div>
  );

  const renderHidden = (items: LNRow[], type: 'kunde' | 'ma') => items.length > 0 ? (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full mt-2">
        <ChevronDown className="h-3 w-3" />{items.length} ausgeblendet
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 mt-2">
          {items.map(ln => (
            <div key={ln.id} className="flex items-center justify-between p-2 border border-dashed rounded-lg opacity-50">
              <div>
                <p className="text-sm">{getKundeName(ln.kunden_id)}</p>
                <p className="text-xs text-muted-foreground">{monthNames[ln.monat - 1]} {ln.jahr}</p>
              </div>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => unhide(ln.id, type)}>
                <Eye className="h-3.5 w-3.5 mr-1" /> Einblenden
              </Button>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  ) : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Leistungsnachweise
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sync-Status */}
          {hasPending && isOnline && (
            <div className="flex items-center gap-2 text-xs rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
              <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin" />
              <span className="text-primary font-medium">Unterschriften werden synchronisiert…</span>
            </div>
          )}
          {hasPending && !isOnline && (
            <div className="flex items-center gap-2 text-xs rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
              <WifiOff className="h-3.5 w-3.5 shrink-0" />
              <span>Offline — Unterschriften werden bei Verbindung synchronisiert.</span>
            </div>
          )}

          {/* Kunden-Unterschrift */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Kunden-Unterschrift ausstehend
            </p>
            {!kundeAusstehend.length ? (
              <p className="text-sm text-muted-foreground text-center py-3 bg-muted/30 rounded-lg">
                <CheckCircle2 className="h-4 w-4 inline mr-1 text-success" />
                Alle Kunden haben unterschrieben.
              </p>
            ) : (
              <div className="space-y-2">
                {kundeAusstehend.map(ln => renderLNRow(ln, 'kunde'))}
              </div>
            )}
            {renderHidden(kundeHidden, 'kunde')}
          </div>

          <Separator />

          {/* MA-eigene Unterschrift (optional) */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Eigene Unterschrift <span className="normal-case font-normal">(optional)</span>
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Wenn du unterschreibst, muss die GF nicht extra unterschreiben.
            </p>
            {!maAusstehend.length ? (
              <p className="text-sm text-muted-foreground text-center py-3 bg-muted/30 rounded-lg">
                <UserCheck className="h-4 w-4 inline mr-1 text-success" />
                Alle Nachweise für diesen Monat unterschrieben.
              </p>
            ) : (
              <div className="space-y-2">
                {maAusstehend.map(ln => renderLNRow(ln, 'ma'))}
              </div>
            )}
            {renderHidden(maHidden, 'ma')}
          </div>
        </CardContent>
      </Card>

      {/* Signaturpad */}
      {activeSignatur && selectedLN && (
        <KundenSignaturPad
          kundeName={getKundeName(selectedLN.kunden_id)}
          monat={selectedLN.monat}
          jahr={selectedLN.jahr}
          termine={termine || []}
          liveGeleistet={selectedLN.computedGeleistet}
          isOnline={isOnline}
          onConfirm={handleSignatur}
          onCancel={() => setActiveSignatur(null)}
          headerTitle={
            activeSignatur.type === 'kunde'
              ? `Unterschrift: ${getKundeName(selectedLN.kunden_id)}`
              : `Eigene Unterschrift — ${getKundeName(selectedLN.kunden_id)}, ${monthNames[selectedLN.monat - 1]} ${selectedLN.jahr}`
          }
          showHinweis={activeSignatur.type === 'kunde'}
        />
      )}
    </>
  );
}
