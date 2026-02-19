import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface AppointmentChange {
  id: string;
  termin_id: string;
  requested_by: string;
  old_start_at: string;
  old_end_at: string;
  old_mitarbeiter_id: string | null;
  old_kunden_id: string;
  new_start_at: string | null;
  new_end_at: string | null;
  new_mitarbeiter_id: string | null;
  new_kunden_id: string | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  requester?: {
    vorname: string;
    nachname: string;
  };
  old_customer?: {
    vorname: string;
    nachname: string;
  };
  new_customer?: {
    vorname: string;
    nachname: string;
  };
  old_employee?: {
    vorname: string;
    nachname: string;
  };
  new_employee?: {
    vorname: string;
    nachname: string;
  };
}

interface AppointmentApprovalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  changes: AppointmentChange[];
  onApprovalAction: () => void;
}

export function AppointmentApprovalDialog({ 
  isOpen, 
  onClose, 
  changes, 
  onApprovalAction 
}: AppointmentApprovalDialogProps) {
  const [selectedChange, setSelectedChange] = useState<AppointmentChange | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const ensureContext = async () => {
    try {
      const email = user?.email;
      if (!email) return;
      const { data: benutzer, error: benutzerError } = await supabase
        .from('benutzer')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (benutzerError || !benutzer?.id) return;
      await supabase.rpc('app_set_context', { p_benutzer_id: benutzer.id });
    } catch (_) {
      // ignore; context is best-effort
    }
  };

  const handleApprove = async (changeId: string) => {
    setLoading(true);
    try {
      await ensureContext();

      const { error } = await supabase.rpc('approve_termin_change', {
        p_request_id: changeId,
      });

      if (error) throw error;

      toast({
        title: 'Erfolg',
        description: 'Terminänderung wurde genehmigt.',
      });

      onApprovalAction();
      setSelectedChange(null);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      const isOverlap = /termine_no_overlap|overlap|conflicting key value/i.test(msg);
      const isContext = /User context not set/i.test(msg);
      toast({
        title: 'Fehler',
        description: isOverlap
          ? 'Konflikt: Der neue Termin überschneidet sich mit einem bestehenden Termin. Bitte Zeiten anpassen.'
          : isContext
          ? 'Sitzungskontext fehlte. Bitte erneut versuchen.'
          : 'Fehler beim Genehmigen der Änderung.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (changeId: string) => {
    setLoading(true);
    try {
      await ensureContext();

      const { error } = await supabase.rpc('reject_termin_change', {
        p_request_id: changeId,
        p_reason: rejectionReason || 'Keine Begründung angegeben',
      });

      if (error) throw error;

      toast({
        title: 'Erfolg',
        description: 'Terminänderung wurde abgelehnt.',
      });

      onApprovalAction();
      setSelectedChange(null);
      setRejectionReason('');
    } catch (err: any) {
      toast({
        title: 'Fehler',
        description: 'Fehler beim Ablehnen der Änderung.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Terminänderungen genehmigen</DialogTitle>
          <DialogDescription id="approval-desc">
            Prüfen Sie die angefragten Änderungen und genehmigen oder lehnen Sie diese ab.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {changes.map((change) => (
            <Card key={change.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={change.status === 'pending' ? 'secondary' : 'outline'}>
                      {change.status === 'pending' ? 'Ausstehend' : 
                       change.status === 'approved' ? 'Genehmigt' : 'Abgelehnt'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Angefragt am {format(new Date(change.created_at), 'dd.MM.yyyy HH:mm')}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Angefragt von: {change.requester?.vorname} {change.requester?.nachname}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="font-medium mb-2">Alt:</h4>
                    <div className="text-sm space-y-1">
                      <div>Datum: {format(new Date(change.old_start_at), 'dd.MM.yyyy HH:mm')} - {format(new Date(change.old_end_at), 'HH:mm')}</div>
                      <div>Kunde: {change.old_customer?.vorname} {change.old_customer?.nachname}</div>
                      <div>Mitarbeiter: {change.old_employee?.vorname} {change.old_employee?.nachname}</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Neu:</h4>
                    <div className="text-sm space-y-1">
                      {change.new_start_at && change.new_end_at && (
                        <div>Datum: {format(new Date(change.new_start_at), 'dd.MM.yyyy HH:mm')} - {format(new Date(change.new_end_at), 'HH:mm')}</div>
                      )}
                      {change.new_customer && (
                        <div>Kunde: {change.new_customer.vorname} {change.new_customer.nachname}</div>
                      )}
                      {change.new_employee && (
                        <div>Mitarbeiter: {change.new_employee.vorname} {change.new_employee.nachname}</div>
                      )}
                    </div>
                  </div>
                </div>

                {change.reason && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-1">Begründung:</h4>
                    <p className="text-sm text-muted-foreground">{change.reason}</p>
                  </div>
                )}

                {change.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleApprove(change.id)}
                      disabled={loading}
                      className="flex items-center gap-1"
                    >
                      <Check className="h-4 w-4" />
                      Genehmigen
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setSelectedChange(change)}
                      disabled={loading}
                      className="flex items-center gap-1"
                    >
                      <X className="h-4 w-4" />
                      Ablehnen
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedChange && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Ablehnungsgrund:</h4>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Bitte geben Sie einen Grund für die Ablehnung an..."
              className="mb-3"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleReject(selectedChange.id)}
                disabled={loading}
              >
                Ablehnen bestätigen
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedChange(null);
                  setRejectionReason('');
                }}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}