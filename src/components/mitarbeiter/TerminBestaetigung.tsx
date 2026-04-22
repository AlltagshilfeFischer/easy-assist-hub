import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { format, differenceInMinutes, startOfDay, startOfTomorrow } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  XCircle, AlertTriangle, Clock, Loader2, CheckCircle2,
  Paperclip, X as XIcon,
} from 'lucide-react';
import { useTerminUpload } from '@/hooks/useTerminUpload';

interface Appointment {
  id: string;
  titel: string;
  start_at: string;
  end_at: string;
  status: string;
  kunden_id: string;
  customer?: { id: string; name: string };
}

interface TerminBestaetigungProps {
  appointments: Appointment[];
  onUpdate: () => void;
}

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function TerminBestaetigung({ appointments, onUpdate }: TerminBestaetigungProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [istStundenMap, setIstStundenMap] = useState<Record<string, string>>({});

  // Inline-Formular für Ausnahme-Status
  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<Record<string, string>>({});
  const [kommentarMap, setKommentarMap] = useState<Record<string, string>>({});
  const [filesMap, setFilesMap] = useState<Record<string, File[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFiles, uploading } = useTerminUpload();

  // Nur heutige vergangene Termine anzeigen (auto-complete hat gestern+ bereits erledigt)
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = startOfTomorrow();

  const unconfirmedToday = appointments
    .filter(a => {
      const end = new Date(a.end_at);
      return (
        end >= todayStart &&
        end < tomorrowStart &&
        end < now &&
        ['scheduled', 'in_progress'].includes(a.status)
      );
    })
    .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());

  const handleDirectComplete = async (appointmentId: string) => {
    setLoadingId(appointmentId);
    try {
      const updateData: Record<string, unknown> = {
        status: 'completed' as Database['public']['Enums']['termin_status'],
      };
      const istStr = istStundenMap[appointmentId];
      if (istStr && !isNaN(parseFloat(istStr))) {
        updateData.iststunden = parseFloat(istStr);
      }
      const { error } = await supabase.from('termine').update(updateData).eq('id', appointmentId);
      if (error) throw error;
      toast.success('Termin als "Durchgeführt" markiert');
      onUpdate();
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      toast.error('Fehler beim Aktualisieren des Termins');
    } finally {
      setLoadingId(null);
    }
  };

  const openExceptionForm = (appointmentId: string, status: string) => {
    setActiveFormId(appointmentId);
    setPendingStatus(prev => ({ ...prev, [appointmentId]: status }));
  };

  const handleFileSelect = (appointmentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const valid = selected.filter(f => {
      if (!ALLOWED_TYPES.includes(f.type)) {
        toast.error(`Dateityp nicht erlaubt: ${f.name}`);
        return false;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`Datei zu groß (max 10 MB): ${f.name}`);
        return false;
      }
      return true;
    });
    if (valid.length > 0) {
      setFilesMap(prev => ({ ...prev, [appointmentId]: [...(prev[appointmentId] ?? []), ...valid] }));
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (appointmentId: string, index: number) => {
    setFilesMap(prev => ({
      ...prev,
      [appointmentId]: (prev[appointmentId] ?? []).filter((_, i) => i !== index),
    }));
  };

  const handleExceptionSave = async (appointmentId: string) => {
    const status = pendingStatus[appointmentId];
    const kommentar = kommentarMap[appointmentId]?.trim() ?? '';
    const files = filesMap[appointmentId] ?? [];

    if (!kommentar || kommentar.length < 5) return; // Pflichtfeld — Button ist bereits disabled

    setLoadingId(appointmentId);
    try {
      const { error } = await supabase
        .from('termine')
        .update({
          status: status as Database['public']['Enums']['termin_status'],
          ma_kommentar: kommentar,
        } as Parameters<ReturnType<typeof supabase.from>['update']>[0])
        .eq('id', appointmentId);

      if (error) throw error;

      if (files.length > 0) {
        await uploadFiles(appointmentId, files);
      }

      const labels: Record<string, string> = {
        abgesagt_rechtzeitig: 'Rechtzeitig abgesagt',
        nicht_angetroffen: 'Nicht angetroffen',
      };
      toast.success(`Termin als "${labels[status] ?? status}" gespeichert`);

      // Formular-State aufräumen
      setActiveFormId(null);
      setKommentarMap(prev => { const n = { ...prev }; delete n[appointmentId]; return n; });
      setFilesMap(prev => { const n = { ...prev }; delete n[appointmentId]; return n; });
      setPendingStatus(prev => { const n = { ...prev }; delete n[appointmentId]; return n; });

      onUpdate();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      toast.error('Fehler beim Speichern des Termins');
    } finally {
      setLoadingId(null);
    }
  };

  if (unconfirmedToday.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Offene Terminbestätigungen
          <Badge variant="destructive" className="ml-2">{unconfirmedToday.length}</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Bitte bestätige deine heutigen Termine oder melde Ausnahmen.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {unconfirmedToday.map(appointment => {
          const start = new Date(appointment.start_at);
          const end = new Date(appointment.end_at);
          const isLoading = loadingId === appointment.id;
          const customerName = appointment.customer?.name ?? appointment.titel;
          const plannedHours = (differenceInMinutes(end, start) / 60).toFixed(1);
          const isFormOpen = activeFormId === appointment.id;
          const kommentar = kommentarMap[appointment.id] ?? '';
          const files = filesMap[appointment.id] ?? [];
          const canSave = kommentar.trim().length >= 5 && !isLoading && !uploading;

          return (
            <div
              key={appointment.id}
              className="flex flex-col gap-3 p-3 bg-background rounded-lg border"
            >
              {/* Termin-Info + Ist-Stunden */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{customerName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(start, 'EEEE, dd.MM.yyyy', { locale: de })} · {format(start, 'HH:mm')} – {format(end, 'HH:mm')} ({plannedHours}h)
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Ist-Std:</span>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    max="12"
                    placeholder={plannedHours}
                    value={istStundenMap[appointment.id] ?? ''}
                    onChange={e => setIstStundenMap(prev => ({ ...prev, [appointment.id]: e.target.value }))}
                    className="w-20 h-7 text-sm"
                    disabled={isLoading || isFormOpen}
                  />
                </div>
              </div>

              {/* Aktions-Buttons — nur wenn kein Formular offen */}
              {!isFormOpen && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={isLoading}
                    onClick={() => handleDirectComplete(appointment.id)}
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    )}
                    Durchgeführt
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-300 text-slate-700 hover:bg-slate-100"
                    disabled={isLoading}
                    onClick={() => openExceptionForm(appointment.id, 'abgesagt_rechtzeitig')}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Rechtzeitig abgesagt
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                    disabled={isLoading}
                    onClick={() => openExceptionForm(appointment.id, 'nicht_angetroffen')}
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Nicht angetroffen
                  </Button>
                </div>
              )}

              {/* Inline-Formular für Ausnahme */}
              {isFormOpen && (
                <div className="space-y-3 pt-1 border-t">
                  <p className="text-xs font-medium text-muted-foreground">
                    {pendingStatus[appointment.id] === 'abgesagt_rechtzeitig'
                      ? 'Rechtzeitig abgesagt'
                      : 'Nicht angetroffen'}{' '}
                    — Bitte kurz erklären:
                  </p>

                  <Textarea
                    placeholder="Was ist passiert? (mind. 5 Zeichen)"
                    value={kommentar}
                    onChange={e => setKommentarMap(prev => ({ ...prev, [appointment.id]: e.target.value }))}
                    className="text-sm min-h-[72px] resize-none"
                    disabled={isLoading}
                  />

                  {/* Datei-Upload */}
                  <div className="space-y-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      multiple
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      onChange={e => handleFileSelect(appointment.id, e)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={isLoading || uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="h-3 w-3 mr-1" />
                      Datei anhängen (optional)
                    </Button>
                    {files.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {files.map((f, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full"
                          >
                            {f.name}
                            <button
                              type="button"
                              onClick={() => removeFile(appointment.id, i)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <XIcon className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Formular-Aktionen */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!canSave}
                      onClick={() => handleExceptionSave(appointment.id)}
                    >
                      {isLoading || uploading ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : null}
                      Speichern
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isLoading}
                      onClick={() => {
                        setActiveFormId(null);
                        setPendingStatus(prev => { const n = { ...prev }; delete n[appointment.id]; return n; });
                      }}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
