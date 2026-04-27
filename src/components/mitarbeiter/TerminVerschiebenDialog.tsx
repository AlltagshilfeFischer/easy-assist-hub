import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { AlertTriangle, Info, MoveRight, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Appointment } from '@/types/domain';

const MAJOR_THRESHOLD_MINUTES = 120;

function isMajorChange(oldStart: string, newStart: string): boolean {
  const diffMs = Math.abs(new Date(newStart).getTime() - new Date(oldStart).getTime());
  const diffMin = diffMs / 60_000;
  return diffMin >= MAJOR_THRESHOLD_MINUTES || !isSameDay(new Date(oldStart), new Date(newStart));
}

interface TerminVerschiebenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  isGeschaeftsfuehrer: boolean;
  onSuccess: () => void;
}

export function TerminVerschiebenDialog({
  isOpen,
  onClose,
  appointment,
  isGeschaeftsfuehrer,
  onSuccess,
}: TerminVerschiebenDialogProps) {
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  // Felder beim Öffnen vorbelegen
  const handleOpenChange = (open: boolean) => {
    if (open && appointment) {
      const start = new Date(appointment.start_at);
      const end = new Date(appointment.end_at);
      setNewDate(format(start, 'yyyy-MM-dd'));
      setNewStartTime(format(start, 'HH:mm'));
      setNewEndTime(format(end, 'HH:mm'));
      setReason('');
    }
    if (!open) onClose();
  };

  const newStart = useMemo(() => {
    if (!newDate || !newStartTime) return null;
    return new Date(`${newDate}T${newStartTime}:00`);
  }, [newDate, newStartTime]);

  const newEnd = useMemo(() => {
    if (!newDate || !newEndTime) return null;
    return new Date(`${newDate}T${newEndTime}:00`);
  }, [newDate, newEndTime]);

  const majorChange = useMemo(() => {
    if (!appointment || !newStart) return false;
    return isMajorChange(appointment.start_at, newStart.toISOString());
  }, [appointment, newStart]);

  const needsApproval = majorChange && !isGeschaeftsfuehrer;

  const isValid = newDate && newStartTime && newEndTime && reason.trim() && newStart && newEnd && newEnd > newStart;

  const handleSave = async () => {
    if (!appointment || !newStart || !newEnd || !reason.trim()) return;

    if (newEnd <= newStart) {
      toast.error('Die Endzeit muss nach der Startzeit liegen.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('apply_termin_change', {
        p_termin_id:  appointment.id,
        p_new_start:  newStart.toISOString(),
        p_new_end:    newEnd.toISOString(),
        p_reason:     reason.trim(),
        p_is_gf:      isGeschaeftsfuehrer,
      });
      if (error) throw error;

      if (needsApproval) {
        toast.success('Termin verschoben – GF-Bestätigung ausstehend.', {
          description: 'Der Termin wurde direkt angewendet. Die GF wird zur Kenntnisnahme benachrichtigt.',
        });
      } else {
        toast.success('Termin erfolgreich verschoben.');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('apply_termin_change Fehler:', err);
      toast.error('Termin konnte nicht verschoben werden.');
    } finally {
      setLoading(false);
    }
  };

  if (!appointment) return null;

  const oldStart = new Date(appointment.start_at);
  const oldEnd = new Date(appointment.end_at);
  const customerName = appointment.customer
    ? ([appointment.customer.vorname, appointment.customer.nachname].filter(Boolean).join(' ') || appointment.customer.name || 'Unbekannt')
    : 'Unbekannt';

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MoveRight className="h-5 w-5" />
            Termin verschieben
          </DialogTitle>
          <DialogDescription>
            Wähle neue Zeiten und gib einen Grund an. Der Kommentar wird in der Termin-Historie gespeichert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Aktueller Termin */}
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <p className="font-medium">{appointment.titel} · {customerName}</p>
            <p className="text-muted-foreground">
              Aktuell: {format(oldStart, 'EEEE, dd.MM.yyyy', { locale: de })} · {format(oldStart, 'HH:mm')} – {format(oldEnd, 'HH:mm')} Uhr
            </p>
          </div>

          {/* Neue Zeit */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Neuer Termin</Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3">
                <Label className="text-xs text-muted-foreground mb-1 block">Datum</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Von</Label>
                <Input
                  type="time"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Bis</Label>
                <Input
                  type="time"
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                />
              </div>
              <div className="flex items-end pb-0.5">
                {newStart && newEnd && newEnd > newStart && (
                  <Badge variant="outline" className="text-xs">
                    {Math.round((newEnd.getTime() - newStart.getTime()) / 60_000)} Min
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Hinweis: groß / klein */}
          {newStart && (
            needsApproval ? (
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-medium">Große Änderung – GF-Bestätigung erforderlich</p>
                  <p className="mt-0.5 text-xs">Der Termin wird sofort verschoben. Die Geschäftsführung wird im Dienstplan benachrichtigt und muss die Änderung bestätigen oder rückgängig machen.</p>
                </div>
              </div>
            ) : isGeschaeftsfuehrer ? (
              <div className="flex gap-2 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <p>Änderung wird direkt gespeichert und in der Termin-Historie dokumentiert.</p>
              </div>
            ) : (
              <div className="flex gap-2 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <p>Kleine Anpassung – wird direkt gespeichert und dokumentiert.</p>
              </div>
            )
          )}

          {/* Kommentar */}
          <div className="space-y-1.5">
            <Label htmlFor="reason">
              Kommentar / Grund <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Warum wird der Termin verschoben? (z. B. Kundenwunsch, persönlicher Termin, ...)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Erscheint in der Termin-Historie und ist für die GF sichtbar.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={loading || !isValid}>
            <Save className="h-4 w-4 mr-2" />
            {needsApproval ? 'Verschieben (GF benachrichtigen)' : 'Verschieben'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
