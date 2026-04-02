import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Clock, User, AlertCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { CalendarAppointment } from '@/types/domain';

interface EmployeeChangeRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: CalendarAppointment | null;
  mitarbeiterId: string;
}

export function EmployeeChangeRequestDialog({ 
  isOpen, 
  onClose, 
  appointment,
  mitarbeiterId
}: EmployeeChangeRequestDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (!appointment) return null;

  const handleSubmitChangeRequest = async () => {
    if (!reason.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte geben Sie einen Grund für die Änderung an.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('termin_aenderungen')
        .insert({
          termin_id: appointment.id,
          requested_by: mitarbeiterId,
          old_start_at: appointment.start_at,
          old_end_at: appointment.end_at,
          old_mitarbeiter_id: appointment.mitarbeiter_id,
          old_kunden_id: appointment.kunden_id,
          reason: reason,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: 'Änderungsantrag gesendet',
        description: 'Ihr Änderungsantrag wurde an die Administratoren gesendet und wird geprüft.'
      });

      setReason('');
      onClose();
    } catch (error: any) {
      console.error('Error submitting change request:', error);
      toast({
        title: 'Fehler',
        description: 'Der Änderungsantrag konnte nicht gesendet werden.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      unassigned: 'Unzugewiesen',
      scheduled: 'Geplant',
      in_progress: 'In Bearbeitung',
      completed: 'Durchgeführt',
      cancelled: 'Abgesagt'
    };
    return variants[status as keyof typeof variants] || 'Unbekannt';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Änderungsantrag stellen
          </DialogTitle>
          <DialogDescription>
            Stellen Sie einen Änderungsantrag für diesen Termin. Ein Administrator wird Ihre Anfrage prüfen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Appointment Info */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Kunde</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {appointment.customer && (
                      <>
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: appointment.customer.farbe_kalender || '#10B981' }}
                        />
                        <p className="text-sm font-medium">{appointment.customer.name}</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Startzeit</Label>
                    <p className="text-sm font-medium mt-1">
                      {format(new Date(appointment.start_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Endzeit</Label>
                    <p className="text-sm font-medium mt-1">
                      {format(new Date(appointment.end_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <Badge variant="outline" className="mt-1">
                    {getStatusBadge(appointment.status)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Box */}
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Bitte beachten Sie:</p>
                  <p className="mt-1">
                    Als Mitarbeiter können Sie Termine nicht direkt ändern. Ihr Änderungsantrag wird 
                    an einen Administrator weitergeleitet, der die Anfrage prüft und genehmigt oder ablehnt.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reason Input */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Grund für die Änderung <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Bitte beschreiben Sie, welche Änderung Sie vornehmen möchten und warum..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Geben Sie so viele Details wie möglich an, damit der Administrator Ihre Anfrage schnell bearbeiten kann.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleSubmitChangeRequest}
            disabled={loading || !reason.trim()}
          >
            <Send className="h-4 w-4 mr-2" />
            Antrag senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
