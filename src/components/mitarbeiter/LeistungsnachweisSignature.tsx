import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  FileText, PenLine, CheckCircle2, Clock,
  Loader2, EyeOff, Eye, ChevronDown, RefreshCw, WifiOff
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import KundenSignaturPad from '@/components/leistungsnachweis/KundenSignaturPad';

interface LNRow {
  id: string;
  kunden_id: string;
  monat: number;
  jahr: number;
  status: string;
  unterschrift_kunde_bild: string | null;
  unterschrift_kunde_zeitstempel: string | null;
  unterschrift_kunde_durch: string | null;
  frozen_geplante_stunden: number | null;
  frozen_geleistete_stunden: number | null;
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

  const [selectedLN, setSelectedLN] = useState<LNRow | null>(null);
  const [showSignaturPad, setShowSignaturPad] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('ln-ma-hidden-ids');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch LNs without customer signature where this MA has termine
  const { data: nachweise, isLoading } = useQuery({
    queryKey: ['ma-ln-kunden-unterschrift', mitarbeiterId],
    queryFn: async () => {
      if (!mitarbeiterId) return [];

      // LNs ohne Kunden-Unterschrift, die nicht abgeschlossen sind
      const { data: allLN, error: lnError } = await supabase
        .from('leistungsnachweise')
        .select('id, kunden_id, monat, jahr, status, unterschrift_kunde_bild, unterschrift_kunde_zeitstempel, unterschrift_kunde_durch, frozen_geplante_stunden, frozen_geleistete_stunden')
        .is('unterschrift_kunde_zeitstempel', null)
        .not('status', 'eq', 'abgeschlossen')
        .order('jahr', { ascending: false })
        .order('monat', { ascending: false });
      if (lnError) throw lnError;
      if (!allLN?.length) return [];

      // Termine dieses Mitarbeiters
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

      return allLN
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

  // Termine für das ausgewählte LN (für das Signatur-Pad)
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
      const { data, error } = await supabase
        .from('kunden')
        .select('id, vorname, nachname, name');
      if (error) throw error;
      return data;
    },
  });

  const getKundeName = (kundenId: string) => {
    const k = kunden?.find(c => c.id === kundenId);
    if (!k) return 'Unbekannt';
    if (k.vorname && k.nachname) return `${k.vorname} ${k.nachname}`;
    return k.name || 'Unbekannt';
  };

  const syncSignatureToDb = async (lnId: string, data: { dataUrl: string; zeitstempel: string; durch: string; frozenGeplant: number; frozenGeleistet: number }) => {
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

  // Auto-sync pending signatures on reconnect
  useEffect(() => {
    if (!isOnline) return;
    const syncPending = async () => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('pending_ma_sig_'));
      if (!keys.length) return;
      for (const key of keys) {
        const lnId = key.replace('pending_ma_sig_', '');
        try {
          const data = JSON.parse(localStorage.getItem(key) || '');
          await syncSignatureToDb(lnId, data);
          localStorage.removeItem(key);
          toast.success('Unterschrift erfolgreich synchronisiert');
        } catch (err) {
          console.error('Sync fehlgeschlagen:', lnId, err);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['ma-ln-kunden-unterschrift'] });
    };
    syncPending();
  }, [isOnline]);

  const hasPendingSignatures = useMemo(
    () => Object.keys(localStorage).some(k => k.startsWith('pending_ma_sig_')),
    [isOnline]
  );

  const handleKundenSignatur = async (dataUrl: string, durch: string) => {
    if (!selectedLN) return;
    const zeitstempel = new Date().toISOString();
    const pendingData = {
      dataUrl,
      zeitstempel,
      durch,
      frozenGeplant: selectedLN.computedGeplant,
      frozenGeleistet: selectedLN.computedGeleistet,
    };

    localStorage.setItem(`pending_ma_sig_${selectedLN.id}`, JSON.stringify(pendingData));
    setShowSignaturPad(false);
    setSelectedLN(null);

    if (isOnline) {
      try {
        await syncSignatureToDb(selectedLN.id, pendingData);
        localStorage.removeItem(`pending_ma_sig_${selectedLN.id}`);
        toast.success('Unterschrift gespeichert');
      } catch {
        toast.success('Unterschrift lokal gespeichert', {
          description: 'Wird automatisch synchronisiert, sobald Internet verfügbar ist.',
        });
      }
    } else {
      toast.success('Unterschrift lokal gespeichert', {
        description: 'Wird automatisch synchronisiert, sobald Internet verfügbar ist.',
      });
    }
    queryClient.invalidateQueries({ queryKey: ['ma-ln-kunden-unterschrift'] });
  };

  const hideNachweis = (id: string) => {
    setHiddenIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('ln-ma-hidden-ids', JSON.stringify([...next]));
      return next;
    });
    toast.success('Leistungsnachweis ausgeblendet');
  };

  const unhideNachweis = (id: string) => {
    setHiddenIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      localStorage.setItem('ln-ma-hidden-ids', JSON.stringify([...next]));
      return next;
    });
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

  const pendingNachweise = nachweise?.filter(n => !hiddenIds.has(n.id)) || [];
  const hiddenNachweise = nachweise?.filter(n => hiddenIds.has(n.id)) || [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Leistungsnachweise — Kunden-Unterschrift
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Sync-Status */}
          {hasPendingSignatures && isOnline && (
            <div className="flex items-center gap-2 text-xs rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
              <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin" />
              <span className="text-primary font-medium">Ausstehende Unterschriften werden synchronisiert…</span>
            </div>
          )}
          {hasPendingSignatures && !isOnline && (
            <div className="flex items-center gap-2 text-xs rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
              <WifiOff className="h-3.5 w-3.5 shrink-0" />
              <span>Offline — Unterschriften werden bei Verbindung synchronisiert.</span>
            </div>
          )}

          {!pendingNachweise.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Keine Leistungsnachweise ausstehend — alle Kunden haben unterschrieben.
            </p>
          ) : (
            <div className="space-y-2">
              {pendingNachweise.map(ln => (
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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground h-8 w-8 p-0"
                      onClick={() => hideNachweis(ln.id)}
                      title="Ausblenden"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => { setSelectedLN(ln); setShowSignaturPad(true); }}
                    >
                      <PenLine className="h-3.5 w-3.5 mr-1.5" />
                      Unterschreiben lassen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hiddenNachweise.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
                <ChevronDown className="h-3 w-3" />
                {hiddenNachweise.length} ausgeblendet
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 mt-2">
                  {hiddenNachweise.map(ln => (
                    <div key={ln.id} className="flex items-center justify-between p-2 border border-dashed rounded-lg opacity-50">
                      <div>
                        <p className="text-sm">{getKundeName(ln.kunden_id)}</p>
                        <p className="text-xs text-muted-foreground">
                          {monthNames[ln.monat - 1]} {ln.jahr}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => unhideNachweis(ln.id)}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> Einblenden
                      </Button>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      {/* Vollbild-Signaturpad für den Kunden */}
      {showSignaturPad && selectedLN && (
        <KundenSignaturPad
          kundeName={getKundeName(selectedLN.kunden_id)}
          monat={selectedLN.monat}
          jahr={selectedLN.jahr}
          termine={termine || []}
          liveGeleistet={selectedLN.computedGeleistet}
          isOnline={isOnline}
          onConfirm={handleKundenSignatur}
          onCancel={() => { setShowSignaturPad(false); setSelectedLN(null); }}
          showHinweis
        />
      )}
    </>
  );
}
