import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  FileText, PenLine, CheckCircle2, Clock,
  Loader2, Trash2, Calendar, EyeOff, Eye, ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface LNRow {
  id: string;
  kunden_id: string;
  monat: number;
  jahr: number;
  geplante_stunden: number;
  geleistete_stunden: number;
  status: string;
  unterschrift_kunde_bild: string | null;
  unterschrift_kunde_zeitstempel: string | null;
  unterschrift_kunde_durch: string | null;
  // Computed from termine at query time (always current, not stale DB value)
  computedGeplant: number;
  computedGeleistet: number;
}

interface Termin {
  id: string;
  titel: string;
  start_at: string;
  end_at: string;
  status: string;
  iststunden: number | null;
}

const monthNames = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const terminStatusLabel: Record<string, string> = {
  completed: 'Stattgefunden',
  scheduled: 'Geplant',
  in_progress: 'Läuft',
  nicht_angetroffen: 'Nicht angetroffen',
  abgesagt_rechtzeitig: 'Rechtzeitig abgesagt',
  cancelled: 'Abgesagt',
};

export function LeistungsnachweisSignature() {
  const { mitarbeiterId } = useUserRole();
  const queryClient = useQueryClient();
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [selectedLN, setSelectedLN] = useState<LNRow | null>(null);
  const [signerName, setSignerName] = useState('');
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('ln-hidden-ids');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const hideNachweis = (id: string) => {
    setHiddenIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('ln-hidden-ids', JSON.stringify([...next]));
      return next;
    });
    toast.success('Leistungsnachweis ausgeblendet');
  };

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Fetch open leistungsnachweise, then filter to only those where
  // this MA had termine in that specific month
  const { data: nachweise, isLoading } = useQuery({
    queryKey: ['mitarbeiter-leistungsnachweise', mitarbeiterId],
    queryFn: async () => {
      if (!mitarbeiterId) return [];

      // 1. Get all open LN
      const { data: allLN, error: lnError } = await supabase
        .from('leistungsnachweise')
        .select('*')
        .eq('status', 'offen')
        .order('jahr', { ascending: false })
        .order('monat', { ascending: false });
      if (lnError) throw lnError;
      if (!allLN?.length) return [];

      // 2. Get termine for this MA (with hours data for computation)
      const { data: myTermine, error: tError } = await supabase
        .from('termine')
        .select('kunden_id, start_at, end_at, status, iststunden')
        .eq('mitarbeiter_id', mitarbeiterId)
        .not('kunden_id', 'is', null);
      if (tError) throw tError;

      // Build map of hours per "kundenId-monat-jahr" and set of matching keys
      const now = new Date();
      const myKeys = new Set<string>();
      const hoursMap = new Map<string, { geplant: number; geleistet: number }>();

      for (const t of myTermine ?? []) {
        const d = new Date(t.start_at);
        const key = `${t.kunden_id}-${d.getMonth() + 1}-${d.getFullYear()}`;
        myKeys.add(key);

        if (['cancelled', 'abgesagt_rechtzeitig'].includes(t.status)) continue;
        const start = new Date(t.start_at);
        const end = new Date(t.end_at);
        const duration = (end.getTime() - start.getTime()) / 3600000;
        const cur = hoursMap.get(key) || { geplant: 0, geleistet: 0 };
        cur.geplant += duration;
        const effectiveStatus = (t.status === 'scheduled' && end < now) ? 'completed' : t.status;
        if (['completed', 'nicht_angetroffen'].includes(effectiveStatus)) {
          cur.geleistet += t.iststunden ? Number(t.iststunden) : duration;
        }
        hoursMap.set(key, cur);
      }

      // 3. Filter LN to only those matching and attach computed hours
      return (allLN as Omit<LNRow, 'computedGeplant' | 'computedGeleistet'>[])
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
    enabled: !!mitarbeiterId
  });

  // Fetch customer names
  const { data: kunden } = useQuery({
    queryKey: ['mitarbeiter-kunden-names'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kunden')
        .select('id, vorname, nachname, name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch termine for selected LN
  const { data: termine } = useQuery({
    queryKey: ['ln-termine-sign', selectedLN?.kunden_id, selectedLN?.monat, selectedLN?.jahr],
    queryFn: async () => {
      if (!selectedLN) return [];
      const von = new Date(selectedLN.jahr, selectedLN.monat - 1, 1).toISOString();
      const bis = new Date(selectedLN.jahr, selectedLN.monat, 0, 23, 59, 59).toISOString();
      const { data, error } = await supabase
        .from('termine')
        .select('id, titel, start_at, end_at, status, iststunden')
        .eq('kunden_id', selectedLN.kunden_id)
        .gte('start_at', von)
        .lte('start_at', bis)
        .order('start_at');
      if (error) throw error;
      return data as Termin[];
    },
    enabled: !!selectedLN
  });

  // Sign mutation
  const signMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLN || !canvasRef.current) throw new Error('Keine Daten');
      const signatureData = canvasRef.current.toDataURL('image/png');

      // Calculate frozen hours from termine
      let frozenGeplant = 0;
      let frozenGeleistet = 0;
      if (termine) {
        const now = new Date();
        for (const t of termine) {
          if (['cancelled', 'abgesagt_rechtzeitig'].includes(t.status)) continue;
          const start = new Date(t.start_at);
          const end = new Date(t.end_at);
          const duration = (end.getTime() - start.getTime()) / 3600000;
          frozenGeplant += duration;
          const effectiveStatus = (t.status === 'scheduled' && end < now) ? 'completed' : t.status;
          if (['completed', 'nicht_angetroffen'].includes(effectiveStatus)) {
            frozenGeleistet += t.iststunden ? Number(t.iststunden) : duration;
          }
        }
      }

      const { error } = await supabase
        .from('leistungsnachweise')
        .update({
          unterschrift_kunde_bild: signatureData,
          unterschrift_kunde_zeitstempel: new Date().toISOString(),
          unterschrift_kunde_durch: signerName || 'Kunde',
          status: 'unterschrieben',
          frozen_geplante_stunden: Math.round(frozenGeplant * 100) / 100,
          frozen_geleistete_stunden: Math.round(frozenGeleistet * 100) / 100,
        })
        .eq('id', selectedLN.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Leistungsnachweis unterschrieben');
      setSignDialogOpen(false);
      setSelectedLN(null);
      queryClient.invalidateQueries({ queryKey: ['mitarbeiter-leistungsnachweise'] });
    },
    onError: (err) => {
      toast.error('Fehler', { description: err instanceof Error ? err.message : 'Unbekannt' });
    }
  });

  // Canvas drawing
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    if (signDialogOpen) {
      const timerId = setTimeout(initCanvas, 100);
      return () => clearTimeout(timerId);
    }
  }, [signDialogOpen, initCanvas]);

  const getPos = (e: React.TouchEvent | React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    isDrawingRef.current = true;
    lastPointRef.current = getPos(e);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawingRef.current || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPointRef.current = pos;
  };

  const endDraw = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getKundeName = (kundenId: string) => {
    const k = kunden?.find(c => c.id === kundenId);
    if (!k) return 'Unbekannt';
    if (k.vorname && k.nachname) return `${k.vorname} ${k.nachname}`;
    return k.name || 'Unbekannt';
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

  const pendingNachweise = nachweise?.filter(n => !n.unterschrift_kunde_zeitstempel && !hiddenIds.has(n.id)) || [];
  const hiddenNachweise = nachweise?.filter(n => !n.unterschrift_kunde_zeitstempel && hiddenIds.has(n.id)) || [];

  const unhideNachweis = (id: string) => {
    setHiddenIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      localStorage.setItem('ln-hidden-ids', JSON.stringify([...next]));
      return next;
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Leistungsnachweise
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!pendingNachweise.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Keine offenen Leistungsnachweise zur Unterschrift
            </p>
          ) : (
            <div className="space-y-2">
              {pendingNachweise.map(ln => (
                <div key={ln.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{getKundeName(ln.kunden_id)}</p>
                    <p className="text-sm text-muted-foreground">
                      {monthNames[ln.monat - 1]} {ln.jahr} • {ln.computedGeleistet}h geleistet ({ln.computedGeplant}h geplant)
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => hideNachweis(ln.id)}
                      title="Ausblenden"
                    >
                      <EyeOff className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => { setSelectedLN(ln); setSignDialogOpen(true); }}
                    >
                      <PenLine className="h-4 w-4 mr-1" /> Unterschreiben
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {hiddenNachweise.length > 0 && (
            <Collapsible className="mt-4">
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
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        onClick={() => unhideNachweis(ln.id)}
                      >
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

      {/* Signature Dialog */}
      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Leistungsnachweis unterschreiben</DialogTitle>
          </DialogHeader>

          {selectedLN && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 p-1">
                <Card>
                  <CardContent className="p-3">
                    <p className="font-medium">{getKundeName(selectedLN.kunden_id)}</p>
                    <p className="text-sm text-muted-foreground">
                      {monthNames[selectedLN.monat - 1]} {selectedLN.jahr}
                    </p>
                  </CardContent>
                </Card>

                <div className="bg-muted/50 p-3 rounded-lg text-sm">
                  <p className="font-medium mb-2">
                    Ich bestätige, dass folgende Termine stattgefunden haben:
                  </p>

                  {!termine?.length ? (
                    <p className="text-muted-foreground">Keine Termine</p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-auto">
                      {termine.map(t => {
                        const start = new Date(t.start_at);
                        const end = new Date(t.end_at);
                        return (
                          <div key={t.id} className="flex items-center justify-between py-1 border-b last:border-0">
                            <span>
                              {format(start, 'dd.MM.', { locale: de })} {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {terminStatusLabel[t.status] || t.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Name des Unterschreibenden</Label>
                  <Input
                    value={signerName}
                    onChange={e => setSignerName(e.target.value)}
                    placeholder="Name eingeben"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Unterschrift</Label>
                    <Button variant="ghost" size="sm" onClick={clearCanvas}>
                      <Trash2 className="h-3 w-3 mr-1" /> Löschen
                    </Button>
                  </div>
                  <div className="border-2 border-dashed rounded-lg bg-white">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-40 touch-none cursor-crosshair"
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={endDraw}
                      onMouseLeave={endDraw}
                      onTouchStart={startDraw}
                      onTouchMove={draw}
                      onTouchEnd={endDraw}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Bitte hier unterschreiben (Touch oder Maus)
                  </p>
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSignDialogOpen(false)}>Abbrechen</Button>
            <Button
              onClick={() => signMutation.mutate()}
              disabled={signMutation.isPending || !signerName.trim()}
            >
              {signMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PenLine className="h-4 w-4 mr-2" />}
              Unterschreiben & Bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
