import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  FileText, Eye, Printer, Calendar, Clock,
  CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw,
  Search, ArrowUpDown, ChevronLeft, ChevronRight, X,
  User, TrendingUp, FileCheck, PenLine, ExternalLink,
  WifiOff, Wifi, RotateCcw, Lock
} from 'lucide-react';
import { format, startOfWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import LeistungsnachweisPreview from '@/components/leistungsnachweis/LeistungsnachweisPreview';
import { exportElementToPdf } from '@/lib/pdfExport';
import { downloadCsv } from '@/lib/csvExport';
import { Download } from 'lucide-react';

interface LeistungsnachweisRow {
  id: string;
  kunden_id: string;
  monat: number;
  jahr: number;
  geplante_stunden: number;
  geleistete_stunden: number;
  status: string;
  abweichende_rechnungsadresse: boolean;
  rechnungsadresse_name: string | null;
  rechnungsadresse_strasse: string | null;
  rechnungsadresse_plz: string | null;
  rechnungsadresse_stadt: string | null;
  ist_privat: boolean;
  kostentraeger_id: string | null;
  privat_empfaenger_name: string | null;
  unterschrift_kunde_bild: string | null;
  unterschrift_kunde_zeitstempel: string | null;
  unterschrift_kunde_durch: string | null;
  unterschrift_gf_template: string | null;
  unterschrift_gf_name: string | null;
  cb_kombinationsleistung: boolean;
  cb_entlastungsleistung: boolean;
  cb_verhinderungspflege: boolean;
  cb_haushaltshilfe: boolean;
  cb_deckeln_45b: boolean;
  cb_deckeln_45b_betrag: number | null;
  frozen_geplante_stunden: number | null;
  frozen_geleistete_stunden: number | null;
  created_at: string;
  updated_at: string;
}

interface Termin {
  id: string;
  titel: string;
  start_at: string;
  end_at: string;
  status: string;
  iststunden: number | null;
  mitarbeiter: { vorname: string | null; nachname: string | null } | null;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; dotColor: string }> = {
  offen: { label: 'Offen', variant: 'outline', icon: <Clock className="h-3 w-3" />, dotColor: 'bg-warning' },
  unterschrieben: { label: 'Unterschrieben', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" />, dotColor: 'bg-success' },
  abgeschlossen: { label: 'Abgeschlossen', variant: 'secondary', icon: <FileCheck className="h-3 w-3" />, dotColor: 'bg-muted-foreground' },
};

const terminStatusLabel: Record<string, { label: string; color: string }> = {
  completed: { label: 'Erfolgt', color: 'text-success bg-success/10' },
  scheduled: { label: 'Geplant', color: 'text-primary bg-primary/10' },
  in_progress: { label: 'Offen', color: 'text-warning bg-warning/10' },
  nicht_angetroffen: { label: 'Nicht rechtzeitig abgesagt', color: 'text-warning bg-warning/10' },
  abgesagt_rechtzeitig: { label: 'Rechtzeitig abgesagt', color: 'text-muted-foreground bg-muted' },
  cancelled: { label: 'Abgesagt', color: 'text-destructive bg-destructive/10' },
  unassigned: { label: 'Nicht zugewiesen', color: 'text-muted-foreground bg-muted' },
};

const monthNames = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

type SortKey = 'name' | 'geplant' | 'geleistet' | 'status';

export default function Leistungsnachweise() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedLN, setSelectedLN] = useState<LeistungsnachweisRow | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('alle');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showStornierConfirm, setShowStornierConfirm] = useState(false);

  // Online status tracking
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  const isCurrentMonth = selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();

  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };
  const goToCurrentMonth = () => { setSelectedMonth(now.getMonth() + 1); setSelectedYear(now.getFullYear()); };

  // Fetch Leistungsnachweise
  const { data: nachweise, isLoading } = useQuery({
    queryKey: ['leistungsnachweise', selectedMonth, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leistungsnachweise')
        .select('*')
        .eq('monat', selectedMonth)
        .eq('jahr', selectedYear)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as LeistungsnachweisRow[];
    }
  });

  // Fetch active customers
  const { data: kunden } = useQuery({
    queryKey: ['kunden-aktiv'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kunden')
        .select('id, vorname, nachname, name, pflegegrad, stunden_kontingent_monat, strasse, plz, stadt, adresse, geburtsdatum, pflegekasse, versichertennummer, verhinderungspflege_aktiv, pflegesachleistung_aktiv, kasse_privat')
        .eq('aktiv', true)
        .order('nachname');
      if (error) throw error;
      return data;
    }
  });

  // Fetch termine for selected LN
  const { data: termine } = useQuery({
    queryKey: ['termine-ln', selectedLN?.kunden_id, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!selectedLN) return [];
      const von = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
      const bis = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).toISOString();
      const { data, error } = await supabase
        .from('termine')
        .select('id, titel, start_at, end_at, status, iststunden, mitarbeiter:mitarbeiter_id(vorname, nachname)')
        .eq('kunden_id', selectedLN.kunden_id)
        .gte('start_at', von)
        .lte('start_at', bis)
        .order('start_at', { ascending: true });
      if (error) throw error;
      return data as any as Termin[];
    },
    enabled: !!selectedLN
  });

  // Filter: only show planned + past termine, no cancelled/abgesagt
  // Auto-complete: Vergangene scheduled-Termine als completed behandeln
  const filteredTermine = useMemo(() => {
    if (!termine) return [];
    const now = new Date();
    return termine
      .filter(t => !['cancelled', 'abgesagt_rechtzeitig'].includes(t.status))
      .map(t => {
        if (t.status === 'scheduled' && new Date(t.end_at) < now) {
          return { ...t, status: 'completed' as typeof t.status };
        }
        return t;
      });
  }, [termine]);

  // Auto-create missing Leistungsnachweise for all active customers
  const autoGenerateNachweise = async () => {
    if (!kunden) return;

    // Batch upsert: create LNs for all active customers (ignoreDuplicates = true: existing LNs are NOT overwritten)
    const rows = kunden.map(kunde => ({
      kunden_id: kunde.id,
      monat: selectedMonth,
      jahr: selectedYear,
      geplante_stunden: 0,
      geleistete_stunden: 0,
      status: 'offen' as const,
    }));

    if (rows.length > 0) {
      await supabase
        .from('leistungsnachweise')
        .upsert(rows, { onConflict: 'kunden_id,monat,jahr', ignoreDuplicates: true });
    }

    queryClient.invalidateQueries({ queryKey: ['leistungsnachweise', selectedMonth, selectedYear] });
  };

  // Trigger auto-generation when kunden and nachweise are loaded
  const [autoGenDone, setAutoGenDone] = useState<string | null>(null);
  useEffect(() => {
    const key = `${selectedMonth}-${selectedYear}`;
    if (kunden && nachweise !== undefined && autoGenDone !== key) {
      setAutoGenDone(key);
      autoGenerateNachweise();
    }
  }, [kunden, nachweise, selectedMonth, selectedYear]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<LeistungsnachweisRow>) => {
      if (!selectedLN) throw new Error('Kein LN ausgewählt');
      const { error } = await supabase
        .from('leistungsnachweise')
        .update(updates)
        .eq('id', selectedLN.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Gespeichert');
      queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });
    }
  });

  // Helper: calculate hours from termine
  const calculateHoursFromTermine = (terminList: Termin[]) => {
    const relevant = terminList.filter(t => !['cancelled', 'abgesagt_rechtzeitig'].includes(t.status));
    const now = new Date();
    const effective = relevant.map(t =>
      t.status === 'scheduled' && new Date(t.end_at) < now ? { ...t, status: 'completed' } : t
    );
    const geplant = effective.reduce((sum, t) => {
      const start = new Date(t.start_at);
      const end = new Date(t.end_at);
      return sum + (end.getTime() - start.getTime()) / 3600000;
    }, 0);
    const geleistet = effective
      .filter(t => ['completed', 'nicht_angetroffen'].includes(t.status))
      .reduce((sum, t) => {
        if (t.iststunden) return sum + Number(t.iststunden);
        const start = new Date(t.start_at);
        const end = new Date(t.end_at);
        return sum + (end.getTime() - start.getTime()) / 3600000;
      }, 0);
    return {
      geplant: Math.round(geplant * 100) / 100,
      geleistet: Math.round(geleistet * 100) / 100,
    };
  };

  // Helper to sync a pending signature to the database
  const syncSignatureToDb = async (lnId: string, data: { dataUrl: string; zeitstempel: string; durch: string; frozenGeplant?: number; frozenGeleistet?: number }) => {
    const { error } = await supabase
      .from('leistungsnachweise')
      .update({
        unterschrift_kunde_bild: data.dataUrl,
        unterschrift_kunde_zeitstempel: data.zeitstempel,
        unterschrift_kunde_durch: data.durch,
        status: 'unterschrieben',
        ...(data.frozenGeplant != null && { frozen_geplante_stunden: data.frozenGeplant }),
        ...(data.frozenGeleistet != null && { frozen_geleistete_stunden: data.frozenGeleistet }),
      })
      .eq('id', lnId);
    if (error) throw error;
  };

  // Stornieren mutation: revert signed LN back to offen
  const stornierMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leistungsnachweise')
        .update({
          status: 'offen',
          unterschrift_kunde_bild: null,
          unterschrift_kunde_zeitstempel: null,
          unterschrift_kunde_durch: null,
          frozen_geplante_stunden: null,
          frozen_geleistete_stunden: null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Leistungsnachweis storniert – Status zurück auf Offen');
      setShowStornierConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });
    },
    onError: (err) => {
      toast.error('Fehler', { description: err instanceof Error ? err.message : 'Unbekannt' });
    },
  });

  // Bulk close mutation: set selected LNs to abgeschlossen
  const bulkCloseMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('leistungsnachweise')
        .update({ status: 'abgeschlossen' })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selectedIds.size} Leistungsnachweise abgeschlossen`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });
    },
    onError: (err) => {
      toast.error('Fehler', { description: err instanceof Error ? err.message : 'Unbekannt' });
    },
  });

  // Signature mutation – offline-capable
  const signMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLN || !canvasRef.current) throw new Error('Keine Daten');
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const zeitstempel = new Date().toISOString();
      const durch = signerName || 'Kunde';

      // Freeze hours at signing time
      const hours = termine ? calculateHoursFromTermine(termine) : { geplant: 0, geleistet: 0 };
      const pendingData = { dataUrl, zeitstempel, durch, frozenGeplant: hours.geplant, frozenGeleistet: hours.geleistet };

      // Always save to localStorage first
      localStorage.setItem(`pending_signature_${selectedLN.id}`, JSON.stringify(pendingData));

      if (isOnline) {
        // Try to sync immediately
        await syncSignatureToDb(selectedLN.id, pendingData);
        localStorage.removeItem(`pending_signature_${selectedLN.id}`);
      }
    },
    onSuccess: () => {
      const dataUrl = canvasRef.current?.toDataURL('image/png') || null;
      const zeitstempel = new Date().toISOString();
      const durch = signerName || 'Kunde';

      // Update local state immediately
      setSelectedLN(prev => prev ? {
        ...prev,
        unterschrift_kunde_bild: dataUrl,
        unterschrift_kunde_zeitstempel: zeitstempel,
        unterschrift_kunde_durch: durch,
        status: 'unterschrieben',
      } : null);

      if (isOnline) {
        toast.success('Unterschrift gespeichert');
      } else {
        toast.success('Unterschrift lokal gespeichert', {
          description: 'Wird automatisch synchronisiert, sobald Internet verfügbar ist.',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });
    },
    onError: (err) => {
      // If online sync failed, signature is still in localStorage
      if (!isOnline) {
        toast.success('Unterschrift lokal gespeichert', {
          description: 'Wird automatisch synchronisiert, sobald Internet verfügbar ist.',
        });
        // Update local state anyway
        setSelectedLN(prev => prev ? {
          ...prev,
          unterschrift_kunde_bild: canvasRef.current?.toDataURL('image/png') || null,
          unterschrift_kunde_zeitstempel: new Date().toISOString(),
          unterschrift_kunde_durch: signerName || 'Kunde',
          status: 'unterschrieben',
        } : null);
      } else {
        toast.error('Fehler beim Speichern', { description: err instanceof Error ? err.message : 'Unbekannt' });
      }
    }
  });

  // Auto-sync pending signatures on reconnect
  useEffect(() => {
    if (!isOnline) return;

    const syncPending = async () => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('pending_signature_'));
      if (keys.length === 0) return;

      for (const key of keys) {
        const lnId = key.replace('pending_signature_', '');
        try {
          const data = JSON.parse(localStorage.getItem(key) || '');
          await syncSignatureToDb(lnId, data);
          localStorage.removeItem(key);
          toast.success('Unterschrift erfolgreich synchronisiert');
        } catch (err) {
          console.error('Sync fehlgeschlagen für', lnId, err);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['leistungsnachweise'] });
    };

    syncPending();
  }, [isOnline]);

  // Check if there are pending signatures
  const hasPendingSignatures = useMemo(() => {
    return Object.keys(localStorage).some(k => k.startsWith('pending_signature_'));
  }, [isOnline, selectedLN]);

  const getKundeName = (kundenId: string) => {
    const k = kunden?.find(c => c.id === kundenId);
    if (!k) return 'Unbekannt';
    if (k.vorname && k.nachname) return `${k.vorname} ${k.nachname}`;
    return k.name || 'Unbekannt';
  };

  const kundenMap = useMemo(() => {
    const map = new Map<string, (typeof kunden extends (infer T)[] | undefined ? T : never)>();
    kunden?.forEach(k => map.set(k.id, k));
    return map;
  }, [kunden]);

  // Filter & Sort
  const filteredNachweise = useMemo(() => {
    if (!nachweise) return [];
    let result = [...nachweise];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(ln => getKundeName(ln.kunden_id).toLowerCase().includes(q));
    }
    if (statusFilter !== 'alle') {
      result = result.filter(ln => ln.status === statusFilter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = getKundeName(a.kunden_id).localeCompare(getKundeName(b.kunden_id)); break;
        case 'geplant': cmp = a.geplante_stunden - b.geplante_stunden; break;
        case 'geleistet': cmp = a.geleistete_stunden - b.geleistete_stunden; break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [nachweise, searchQuery, statusFilter, sortKey, sortAsc, kunden]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  // Stats (uses live hours for open LNs, frozen for signed/closed)
  const stats = useMemo(() => {
    if (!nachweise) return { total: 0, signed: 0, abgeschlossen: 0, totalPlanned: 0, totalDone: 0 };
    let totalPlanned = 0;
    let totalDone = 0;
    for (const n of nachweise) {
      const h = (n.status !== 'offen' && n.frozen_geplante_stunden != null)
        ? { geplant: n.frozen_geplante_stunden, geleistet: n.frozen_geleistete_stunden ?? 0 }
        : { geplant: 0, geleistet: 0 };
      totalPlanned += h.geplant;
      totalDone += h.geleistet;
    }
    return {
      total: nachweise.length,
      signed: nachweise.filter(n => n.unterschrift_kunde_zeitstempel).length,
      abgeschlossen: nachweise.filter(n => n.status === 'abgeschlossen').length,
      totalPlanned,
      totalDone,
    };
  }, [nachweise]);

  // Canvas drawing helpers
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawingRef.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => { isDrawingRef.current = false; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Initialize canvas when detail dialog opens for signing
  useEffect(() => {
    if (showDetail && selectedLN?.status === 'offen' && !selectedLN?.unterschrift_kunde_zeitstempel) {
      setTimeout(initCanvas, 100);
    }
  }, [showDetail, selectedLN?.status, selectedLN?.unterschrift_kunde_zeitstempel, initCanvas]);

  // Pre-fill billing checkboxes from customer data when opening an entwurf
  useEffect(() => {
    if (!showDetail || !selectedLN || !kunden) return;
    const noneSet = !selectedLN.cb_kombinationsleistung && !selectedLN.cb_entlastungsleistung &&
      !selectedLN.cb_verhinderungspflege && !selectedLN.cb_haushaltshilfe &&
      !selectedLN.cb_deckeln_45b && !selectedLN.ist_privat;
    if (!noneSet) return;

    const kunde = kunden.find(k => k.id === selectedLN.kunden_id);
    if (!kunde) return;

    const updates: Partial<LeistungsnachweisRow> = {};
    if (kunde.verhinderungspflege_aktiv) updates.cb_verhinderungspflege = true;
    if (kunde.pflegesachleistung_aktiv) updates.cb_kombinationsleistung = true;
    if (kunde.kasse_privat === 'Privat') updates.ist_privat = true;

    if (Object.keys(updates).length > 0) {
      setSelectedLN(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [showDetail, selectedLN?.id]);

  // Dienstplan link with week param based on first termin date
  const getDienstplanLink = () => {
    const firstTerminDate = filteredTermine.length > 0
      ? new Date(filteredTermine[0].start_at)
      : new Date(selectedYear, selectedMonth - 1, 1);
    const weekStart = startOfWeek(firstTerminDate, { weekStartsOn: 1 });
    return `/dashboard/controlboard/schedule-builder?week=${format(weekStart, 'yyyy-MM-dd')}`;
  };

  const canSign = selectedLN?.status === 'offen' && !selectedLN?.unterschrift_kunde_zeitstempel;

  // Live hours for the selected LN
  const liveHours = useMemo(() => {
    if (!termine) return { geplant: 0, geleistet: 0 };
    return calculateHoursFromTermine(termine);
  }, [termine]);

  // Display hours: frozen for signed/closed, live for open
  const displayHours = useMemo(() => {
    if (!selectedLN) return { geplant: 0, geleistet: 0 };
    if (selectedLN.status !== 'offen' && selectedLN.frozen_geplante_stunden != null) {
      return { geplant: selectedLN.frozen_geplante_stunden, geleistet: selectedLN.frozen_geleistete_stunden ?? 0 };
    }
    return liveHours;
  }, [selectedLN, liveHours]);

  // Compute live hours per customer for the table
  const allTermineQuery = useQuery({
    queryKey: ['termine-alle-ln', selectedMonth, selectedYear],
    queryFn: async () => {
      const von = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
      const bis = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).toISOString();
      const { data, error } = await supabase
        .from('termine')
        .select('id, kunden_id, iststunden, start_at, end_at, status')
        .gte('start_at', von)
        .lte('start_at', bis);
      if (error) throw error;
      return data as { id: string; kunden_id: string; iststunden: number | null; start_at: string; end_at: string; status: string }[];
    },
  });

  const hoursByKunde = useMemo(() => {
    const map = new Map<string, { geplant: number; geleistet: number }>();
    if (!allTermineQuery.data) return map;
    const byKunde = new Map<string, typeof allTermineQuery.data>();
    for (const t of allTermineQuery.data) {
      const arr = byKunde.get(t.kunden_id) || [];
      arr.push(t);
      byKunde.set(t.kunden_id, arr);
    }
    for (const [kundenId, kundeTermine] of byKunde) {
      map.set(kundenId, calculateHoursFromTermine(kundeTermine as any));
    }
    return map;
  }, [allTermineQuery.data]);

  // Helper: get display hours for a LN row (frozen for signed/closed, live for open)
  const getRowHours = (ln: LeistungsnachweisRow) => {
    if (ln.status !== 'offen' && ln.frozen_geplante_stunden != null) {
      return { geplant: ln.frozen_geplante_stunden, geleistet: ln.frozen_geleistete_stunden ?? 0 };
    }
    return hoursByKunde.get(ln.kunden_id) || { geplant: 0, geleistet: 0 };
  };

  // Multi-select helpers
  const unterschriebeneIds = useMemo(() =>
    (nachweise || []).filter(n => n.status === 'unterschrieben').map(n => n.id),
    [nachweise]
  );
  const allUnterschriebeneSelected = unterschriebeneIds.length > 0 && unterschriebeneIds.every(id => selectedIds.has(id));
  const toggleSelectAll = () => {
    if (allUnterschriebeneSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unterschriebeneIds));
    }
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header with month navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Leistungsnachweise</h1>
          <p className="text-sm text-muted-foreground">Monatliche Nachweise pro Kunde verwalten</p>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => bulkCloseMutation.mutate([...selectedIds])}
              disabled={bulkCloseMutation.isPending}
            >
              {bulkCloseMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Lock className="h-4 w-4 mr-1.5" />}
              {selectedIds.size} abschließen
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!nachweise?.length) return;
              downloadCsv(
                ['Kunde', 'Monat', 'Jahr', 'Geplant (h)', 'Geleistet (h)', 'Status'],
                nachweise.map(ln => [
                  getKundeName(ln.kunden_id),
                  monthNames[ln.monat - 1],
                  ln.jahr,
                  ln.geplante_stunden,
                  ln.geleistete_stunden,
                  ln.status,
                ]),
                `leistungsnachweise_${monthNames[selectedMonth - 1]}_${selectedYear}.csv`
              );
            }}
            disabled={!nachweise?.length}
          >
            <Download className="h-4 w-4 mr-1.5" />
            CSV
          </Button>
          <div className="flex items-center rounded-lg border border-border bg-card shadow-sm">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-r-none" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={goToCurrentMonth}
              className={`px-4 py-2 text-sm font-semibold transition-colors min-w-[160px] text-center ${isCurrentMonth ? 'text-primary' : 'text-foreground hover:text-primary'}`}
            >
              {monthNames[selectedMonth - 1]} {selectedYear}
              {isCurrentMonth && (
                <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Aktuell
                </span>
              )}
            </button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-l-none" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Nachweise', value: stats.total, icon: FileText, color: 'text-primary' },
          { label: 'Unterschrieben', value: stats.signed, icon: CheckCircle2, color: 'text-success' },
          { label: 'Geplant (h)', value: Math.round(stats.totalPlanned * 10) / 10, icon: Clock, color: 'text-muted-foreground' },
          { label: 'Geleistet (h)', value: Math.round(stats.totalDone * 10) / 10, icon: TrendingUp, color: 'text-primary' },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`rounded-lg bg-muted p-2 ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content: Full Width List */}
      <div className="flex-1 min-h-0">
        <Card className="flex flex-col min-h-0 border-border/60">
          {/* Search & Filter Bar */}
          <div className="p-3 border-b border-border flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Kunde suchen..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Status</SelectItem>
                <SelectItem value="offen">Offen</SelectItem>
                <SelectItem value="unterschrieben">Unterschrieben</SelectItem>
                <SelectItem value="abgeschlossen">Abgeschlossen</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {filteredNachweise.length} Ergebnisse
            </span>
          </div>

          {/* Table */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !filteredNachweise.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground">Keine Nachweise gefunden</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {nachweise?.length ? 'Passe deine Filter an.' : 'Für diesen Monat gibt es noch keine Termine.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allUnterschriebeneSelected && unterschriebeneIds.length > 0}
                        onCheckedChange={toggleSelectAll}
                        disabled={unterschriebeneIds.length === 0}
                        aria-label="Alle unterschriebenen auswählen"
                      />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                      <span className="flex items-center gap-1">Kunde <ArrowUpDown className="h-3 w-3" /></span>
                    </TableHead>
                    <TableHead>PG</TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('geplant')}>
                      <span className="flex items-center justify-end gap-1">Geplant <ArrowUpDown className="h-3 w-3" /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('geleistet')}>
                      <span className="flex items-center justify-end gap-1">Geleistet <ArrowUpDown className="h-3 w-3" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>
                      <span className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></span>
                    </TableHead>
                    <TableHead>Signiert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNachweise.map(ln => {
                    const kunde = kundenMap.get(ln.kunden_id);
                    const cfg = statusConfig[ln.status] || statusConfig.offen;
                    const isActive = selectedLN?.id === ln.id;
                    const rowHours = getRowHours(ln);
                    const canCheck = ln.status === 'unterschrieben';
                    return (
                      <TableRow
                        key={ln.id}
                        className={`cursor-pointer transition-colors ${isActive ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/50'}`}
                        onClick={() => { setSelectedLN(ln); setShowDetail(true); }}
                      >
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(ln.id)}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedIds);
                              if (checked) next.add(ln.id); else next.delete(ln.id);
                              setSelectedIds(next);
                            }}
                            disabled={!canCheck}
                            aria-label={`${getKundeName(ln.kunden_id)} auswählen`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{getKundeName(ln.kunden_id)}</TableCell>
                        <TableCell>
                          {kunde?.pflegegrad ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-semibold text-foreground">
                              {kunde.pflegegrad}
                            </span>
                          ) : '–'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{rowHours.geplant}h</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{rowHours.geleistet}h</TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant} className="gap-1 text-xs">
                            {cfg.icon} {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {ln.unterschrift_kunde_zeitstempel ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </Card>
      </div>

      {/* Detail Dialog – wide fullscreen-like */}
      <Dialog open={showDetail && !!selectedLN} onOpenChange={(open) => { if (!open) setShowDetail(false); }}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-hidden flex flex-col">
          {selectedLN && (
            <>
              {/* Dialog Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-full bg-primary/10 p-2">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-lg text-foreground truncate">{getKundeName(selectedLN.kunden_id)}</p>
                    <p className="text-sm text-muted-foreground">{monthNames[selectedLN.monat - 1]} {selectedLN.jahr}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={async () => {
                      const el = document.getElementById('ln-preview-pdf');
                      if (!el) { toast.error('Preview nicht gefunden'); return; }
                      const kundeName = getKundeName(selectedLN.kunden_id).replace(/\s+/g, '_');
                      await exportElementToPdf(el, `LN_${kundeName}_${monthNames[selectedLN.monat - 1]}_${selectedLN.jahr}.pdf`);
                    }}
                  >
                    <Download className="h-4 w-4" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowPrint(true)}>
                    <Printer className="h-4 w-4" /> Drucken
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-5 py-4">
                  {/* Hours Summary */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border p-3 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Geplant</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{displayHours.geplant}h</p>
                    </div>
                    <div className="rounded-lg border border-border p-3 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Geleistet</p>
                      <p className="text-2xl font-bold text-primary mt-1">{displayHours.geleistet}h</p>
                    </div>
                  </div>

                  {/* Termine – wider table layout */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        Termine ({filteredTermine.length})
                      </h3>
                      <Link
                        to={getDienstplanLink()}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Im Dienstplan prüfen
                      </Link>
                    </div>
                    {!filteredTermine.length ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Keine Termine</p>
                    ) : (
                      <div className="border border-border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent bg-muted/30">
                              <TableHead className="text-xs">Datum</TableHead>
                              <TableHead className="text-xs">Uhrzeit</TableHead>
                              <TableHead className="text-xs">Mitarbeiter</TableHead>
                              <TableHead className="text-xs">Status</TableHead>
                              <TableHead className="text-xs text-right">Stunden</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredTermine.map(t => {
                              const start = new Date(t.start_at);
                              const end = new Date(t.end_at);
                              const hours = t.iststunden ?? ((end.getTime() - start.getTime()) / 3600000);
                              const sts = terminStatusLabel[t.status] || { label: t.status, color: 'text-muted-foreground bg-muted' };
                              const canEdit = selectedLN?.status === 'offen';
                              return (
                                <TableRow key={t.id} className="hover:bg-muted/20">
                                  <TableCell className="text-sm font-medium">
                                    {format(start, 'dd.MM.yyyy', { locale: de })}
                                  </TableCell>
                                  <TableCell className="text-sm tabular-nums">
                                    {canEdit ? (
                                      <div className="flex items-center gap-1">
                                        <Input
                                          type="time"
                                          defaultValue={format(start, 'HH:mm')}
                                          className="w-24 h-7 text-xs"
                                          onBlur={async (e) => {
                                            const [h, m] = e.target.value.split(':').map(Number);
                                            const newStart = new Date(start);
                                            newStart.setHours(h, m, 0, 0);
                                            await supabase.from('termine').update({ start_at: newStart.toISOString() }).eq('id', t.id);
                                            queryClient.invalidateQueries({ queryKey: ['termine-ln'] });
                                          }}
                                        />
                                        <span className="text-muted-foreground">–</span>
                                        <Input
                                          type="time"
                                          defaultValue={format(end, 'HH:mm')}
                                          className="w-24 h-7 text-xs"
                                          onBlur={async (e) => {
                                            const [h, m] = e.target.value.split(':').map(Number);
                                            const newEnd = new Date(end);
                                            newEnd.setHours(h, m, 0, 0);
                                            await supabase.from('termine').update({ end_at: newEnd.toISOString() }).eq('id', t.id);
                                            queryClient.invalidateQueries({ queryKey: ['termine-ln'] });
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <>{format(start, 'HH:mm')}–{format(end, 'HH:mm')}</>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {t.mitarbeiter ? `${t.mitarbeiter.vorname || ''} ${t.mitarbeiter.nachname || ''}`.trim() : '–'}
                                  </TableCell>
                                  <TableCell>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${sts.color}`}>
                                      {sts.label}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-sm font-semibold tabular-nums text-right">
                                    {canEdit ? (
                                      <Input
                                        type="number"
                                        step="0.25"
                                        min="0"
                                        defaultValue={Math.round(hours * 100) / 100}
                                        className="w-20 h-7 text-xs text-right"
                                        onBlur={async (e) => {
                                          const val = parseFloat(e.target.value);
                                          if (isNaN(val)) return;
                                          await supabase.from('termine').update({ iststunden: val }).eq('id', t.id);
                                          queryClient.invalidateQueries({ queryKey: ['termine-ln'] });
                                        }}
                                      />
                                    ) : (
                                      <>{Math.round(hours * 100) / 100}h</>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Signature Section – available when offen */}
                  {canSign && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <PenLine className="h-4 w-4 text-muted-foreground" />
                        Unterschrift Kunde
                      </h3>

                      {/* Offline indicator */}
                      {!isOnline && (
                        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
                          <WifiOff className="h-4 w-4 text-warning" />
                          <span className="text-warning font-medium">Offline-Modus</span>
                          <span className="text-muted-foreground">– Unterschrift wird lokal gespeichert</span>
                        </div>
                      )}

                      {hasPendingSignatures && isOnline && (
                        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
                          <RefreshCw className="h-4 w-4 text-primary animate-spin" />
                          <span className="text-primary font-medium">Synchronisiere ausstehende Unterschriften...</span>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-xs">Name des Unterzeichners</Label>
                        <Input
                          className="h-8 text-sm max-w-xs"
                          value={signerName}
                          onChange={e => setSignerName(e.target.value)}
                          placeholder="Name eingeben..."
                        />
                      </div>
                      <div className="relative">
                        <canvas
                          ref={canvasRef}
                          className="w-full h-32 border border-border rounded-lg bg-card cursor-crosshair touch-none"
                          onMouseDown={startDraw}
                          onMouseMove={draw}
                          onMouseUp={endDraw}
                          onMouseLeave={endDraw}
                          onTouchStart={startDraw}
                          onTouchMove={draw}
                          onTouchEnd={endDraw}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-1 right-1 h-6 text-xs text-muted-foreground"
                          onClick={clearCanvas}
                        >
                          Löschen
                        </Button>
                      </div>
                      <Button
                        className="w-full gap-2"
                        onClick={() => signMutation.mutate()}
                        disabled={signMutation.isPending}
                      >
                        {signMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        {!isOnline ? <WifiOff className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        {!isOnline ? 'Unterschrift lokal speichern' : 'Unterschreiben & Bestätigen'}
                      </Button>
                    </div>
                  )}

                  {/* Signature info if already signed */}
                  {selectedLN.unterschrift_kunde_zeitstempel && (
                    <div className="rounded-lg bg-success/10 border border-success/20 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-success">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="font-medium">Kunde hat unterschrieben</span>
                        </div>
                        {selectedLN.status === 'unterschrieben' && !showStornierConfirm && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                            onClick={() => setShowStornierConfirm(true)}
                          >
                            <RotateCcw className="h-3 w-3" /> Stornieren
                          </Button>
                        )}
                        {selectedLN.status === 'unterschrieben' && showStornierConfirm && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => stornierMutation.mutate(selectedLN.id)}
                              disabled={stornierMutation.isPending}
                            >
                              {stornierMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                              Ja, stornieren
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setShowStornierConfirm(false)}
                            >
                              Abbrechen
                            </Button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedLN.unterschrift_kunde_durch && `Durch: ${selectedLN.unterschrift_kunde_durch} · `}
                        {format(new Date(selectedLN.unterschrift_kunde_zeitstempel), 'dd.MM.yyyy HH:mm', { locale: de })}
                      </p>
                      {selectedLN.unterschrift_kunde_bild && (
                        <img src={selectedLN.unterschrift_kunde_bild} alt="Unterschrift" className="h-16 mt-2 border rounded bg-card" />
                      )}
                    </div>
                  )}

                  <Separator />

                  {/* Leistungstöpfe / Abrechnungs-Checkboxen */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Leistungsart / Abrechnung</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="cb-kombi"
                          checked={selectedLN.cb_kombinationsleistung}
                          onCheckedChange={(checked) => setSelectedLN({ ...selectedLN, cb_kombinationsleistung: !!checked })}
                        />
                        <Label htmlFor="cb-kombi" className="text-sm">Kombinationsleistung §38 SGB XI</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="cb-entlastung"
                          checked={selectedLN.cb_entlastungsleistung}
                          onCheckedChange={(checked) => setSelectedLN({ ...selectedLN, cb_entlastungsleistung: !!checked })}
                        />
                        <Label htmlFor="cb-entlastung" className="text-sm">Entlastungsleistung §45b SGB XI</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="cb-vhp"
                          checked={selectedLN.cb_verhinderungspflege}
                          onCheckedChange={(checked) => setSelectedLN({ ...selectedLN, cb_verhinderungspflege: !!checked })}
                        />
                        <Label htmlFor="cb-vhp" className="text-sm">Verhinderungspflege §39 SGB XI</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="cb-hh"
                          checked={selectedLN.cb_haushaltshilfe}
                          onCheckedChange={(checked) => setSelectedLN({ ...selectedLN, cb_haushaltshilfe: !!checked })}
                        />
                        <Label htmlFor="cb-hh" className="text-sm">Haushaltshilfe §38 SGB XI</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="cb-deckeln"
                          checked={selectedLN.cb_deckeln_45b}
                          onCheckedChange={(checked) => setSelectedLN({ ...selectedLN, cb_deckeln_45b: !!checked })}
                        />
                        <Label htmlFor="cb-deckeln" className="text-sm">Deckeln §45b</Label>
                        {selectedLN.cb_deckeln_45b && (
                          <Input
                            type="number"
                            className="h-7 w-24 text-sm"
                            value={selectedLN.cb_deckeln_45b_betrag ?? ''}
                            onChange={e => setSelectedLN({ ...selectedLN, cb_deckeln_45b_betrag: e.target.value ? Number(e.target.value) : null })}
                            placeholder="EUR"
                          />
                        )}
                        <span className="text-xs text-muted-foreground">Rest privat</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Edit Options */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground">Einstellungen</h3>

                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="abw-addr"
                        checked={selectedLN.abweichende_rechnungsadresse}
                        onCheckedChange={(checked) => setSelectedLN({ ...selectedLN, abweichende_rechnungsadresse: !!checked })}
                      />
                      <Label htmlFor="abw-addr" className="text-sm">Abweichende Rechnungsadresse</Label>
                    </div>

                    {selectedLN.abweichende_rechnungsadresse && (
                      <div className="grid grid-cols-2 gap-2 pl-6">
                        <div className="space-y-1">
                          <Label className="text-xs">Name</Label>
                          <Input className="h-8 text-sm" value={selectedLN.rechnungsadresse_name || ''} onChange={e => setSelectedLN({ ...selectedLN, rechnungsadresse_name: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Straße</Label>
                          <Input className="h-8 text-sm" value={selectedLN.rechnungsadresse_strasse || ''} onChange={e => setSelectedLN({ ...selectedLN, rechnungsadresse_strasse: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">PLZ</Label>
                          <Input className="h-8 text-sm" value={selectedLN.rechnungsadresse_plz || ''} onChange={e => setSelectedLN({ ...selectedLN, rechnungsadresse_plz: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Stadt</Label>
                          <Input className="h-8 text-sm" value={selectedLN.rechnungsadresse_stadt || ''} onChange={e => setSelectedLN({ ...selectedLN, rechnungsadresse_stadt: e.target.value })} />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="privat"
                        checked={selectedLN.ist_privat}
                        onCheckedChange={(checked) => setSelectedLN({ ...selectedLN, ist_privat: !!checked })}
                      />
                      <Label htmlFor="privat" className="text-sm">Privatperson statt Kasse</Label>
                    </div>

                    {selectedLN.ist_privat && (
                      <div className="pl-6 space-y-1">
                        <Label className="text-xs">Privat-Empfänger</Label>
                        <Input className="h-8 text-sm" value={selectedLN.privat_empfaenger_name || ''} onChange={e => setSelectedLN({ ...selectedLN, privat_empfaenger_name: e.target.value })} />
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs">GF-Unterschrift Name</Label>
                      <Input className="h-8 text-sm" value={selectedLN.unterschrift_gf_name || ''} onChange={e => setSelectedLN({ ...selectedLN, unterschrift_gf_name: e.target.value })} placeholder="Name der Geschäftsführung" />
                    </div>
                  </div>
                </div>
              </ScrollArea>

              {/* Save button */}
              <div className="pt-4 border-t border-border">
                <Button
                  className="w-full"
                  onClick={() => {
                    if (!selectedLN) return;
                    updateMutation.mutate({
                      abweichende_rechnungsadresse: selectedLN.abweichende_rechnungsadresse,
                      rechnungsadresse_name: selectedLN.rechnungsadresse_name,
                      rechnungsadresse_strasse: selectedLN.rechnungsadresse_strasse,
                      rechnungsadresse_plz: selectedLN.rechnungsadresse_plz,
                      rechnungsadresse_stadt: selectedLN.rechnungsadresse_stadt,
                      ist_privat: selectedLN.ist_privat,
                      privat_empfaenger_name: selectedLN.privat_empfaenger_name,
                      unterschrift_gf_name: selectedLN.unterschrift_gf_name,
                      cb_kombinationsleistung: selectedLN.cb_kombinationsleistung,
                      cb_entlastungsleistung: selectedLN.cb_entlastungsleistung,
                      cb_verhinderungspflege: selectedLN.cb_verhinderungspflege,
                      cb_haushaltshilfe: selectedLN.cb_haushaltshilfe,
                      cb_deckeln_45b: selectedLN.cb_deckeln_45b,
                      cb_deckeln_45b_betrag: selectedLN.cb_deckeln_45b_betrag,
                    });
                  }}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Änderungen speichern
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Print Preview Dialog */}
      <Dialog open={showPrint} onOpenChange={setShowPrint}>
        <DialogContent className="max-w-[240mm] max-h-[95vh] overflow-auto p-0 print:shadow-none print:border-none">
          <div className="p-4 border-b border-border flex items-center justify-between no-print">
            <h2 className="font-semibold text-foreground">Druckvorschau</h2>
            <Button variant="default" size="sm" className="gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Drucken
            </Button>
          </div>
          {selectedLN && (() => {
            const kunde = kundenMap.get(selectedLN.kunden_id);
            return kunde ? (
              <LeistungsnachweisPreview
                kunde={kunde}
                nachweis={selectedLN}
                termine={filteredTermine}
              />
            ) : null;
          })()}
        </DialogContent>
      </Dialog>

      {/* Hidden PDF preview for export */}
      {selectedLN && (() => {
        const kunde = kundenMap.get(selectedLN.kunden_id);
        return kunde ? (
          <div id="ln-preview-pdf" style={{ position: 'absolute', left: '-9999px', top: 0 }}>
            <LeistungsnachweisPreview
              kunde={kunde}
              nachweis={selectedLN}
              termine={filteredTermine}
            />
          </div>
        ) : null;
      })()}
    </div>
  );
}
