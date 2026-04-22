import { useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Loader2, Paperclip, X as XIcon } from 'lucide-react';
import { useTerminUpload } from '@/hooks/useTerminUpload';
import type { CalendarAppointment } from '@/types/domain';

interface TerminKorrekturDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: CalendarAppointment | null;
  onUpdate: () => void;
}

type KorrekturStatus = 'nicht_angetroffen' | 'abgesagt_rechtzeitig';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function TerminKorrekturDialog({
  isOpen, onClose, appointment, onUpdate,
}: TerminKorrekturDialogProps) {
  const [status, setStatus] = useState<KorrekturStatus | ''>('');
  const [kommentar, setKommentar] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFiles, uploading } = useTerminUpload();

  const canSave = status !== '' && kommentar.trim().length >= 5 && !saving && !uploading;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (valid.length > 0) setFiles(prev => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!appointment || !status) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('termine')
        .update({
          status: status as Database['public']['Enums']['termin_status'],
          ma_kommentar: kommentar.trim(),
        } as Parameters<ReturnType<typeof supabase.from>['update']>[0])
        .eq('id', appointment.id);

      if (error) throw error;

      if (files.length > 0) {
        await uploadFiles(appointment.id, files);
      }

      const labels: Record<KorrekturStatus, string> = {
        nicht_angetroffen: 'Nicht angetroffen',
        abgesagt_rechtzeitig: 'Rechtzeitig abgesagt',
      };
      toast.success(`Termin als "${labels[status]}" gespeichert`);
      handleClose();
      onUpdate();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStatus('');
    setKommentar('');
    setFiles([]);
    onClose();
  };

  if (!appointment) return null;

  const start = new Date(appointment.start_at);
  const end = new Date(appointment.end_at);
  const customerName = appointment.customer?.name ?? appointment.titel;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Termin korrigieren</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Termin-Info (read-only) */}
          <div className="rounded-md bg-muted/40 p-3 text-sm space-y-0.5">
            <p className="font-medium">{customerName}</p>
            <p className="text-muted-foreground">
              {format(start, 'EEEE, dd.MM.yyyy', { locale: de })} · {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
            </p>
          </div>

          {/* Status-Auswahl */}
          <div className="space-y-1.5">
            <Label htmlFor="korrektur-status">Was ist passiert?</Label>
            <Select
              value={status}
              onValueChange={val => setStatus(val as KorrekturStatus)}
            >
              <SelectTrigger id="korrektur-status">
                <SelectValue placeholder="Status auswählen…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nicht_angetroffen">Nicht angetroffen</SelectItem>
                <SelectItem value="abgesagt_rechtzeitig">Rechtzeitig abgesagt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Kommentar (Pflichtfeld) */}
          <div className="space-y-1.5">
            <Label htmlFor="korrektur-kommentar">
              Kommentar <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="korrektur-kommentar"
              placeholder="Kurze Erklärung (mind. 5 Zeichen)"
              value={kommentar}
              onChange={e => setKommentar(e.target.value)}
              className="resize-none min-h-[80px]"
              disabled={saving}
            />
          </div>

          {/* Datei-Upload (optional) */}
          <div className="space-y-1.5">
            <Label>Anhänge (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={handleFileSelect}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving || uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-3.5 w-3.5 mr-1.5" />
              Datei anhängen
            </Button>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {files.map((f, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full"
                  >
                    {f.name}
                    <button
                      type="button"
                      onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {(saving || uploading) && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
