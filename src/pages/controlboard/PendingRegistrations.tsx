import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

interface PendingRegistration {
  id: string;
  email: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

export default function PendingRegistrations() {
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedReg, setSelectedReg] = useState<PendingRegistration | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const { toast } = useToast();

  const loadRegistrations = async () => {
    try {
      const { data, error } = await supabase
        .from('pending_registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRegistrations((data as PendingRegistration[]) || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegistrations();

    // Realtime updates
    const channel = supabase
      .channel('pending_registrations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_registrations',
        },
        () => {
          loadRegistrations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleApprove = async (registration: PendingRegistration) => {
    setActionLoading(registration.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Nicht angemeldet');
      }

      const { data, error } = await supabase.functions.invoke('approve-registration', {
        body: {
          registration_id: registration.id,
          email: registration.email,
          password: 'TempPass123!', // Temporäres Passwort - User sollte es ändern
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Genehmigt',
          description: `Registrierung für ${registration.email} wurde genehmigt. Temporäres Passwort: TempPass123!`,
        });
        loadRegistrations();
      } else {
        throw new Error(data?.error || 'Unbekannter Fehler');
      }
    } catch (error: any) {
      console.error('Approval error:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error.message || 'Fehler beim Genehmigen der Registrierung',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selectedReg || !rejectionReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Bitte geben Sie einen Ablehnungsgrund an.',
      });
      return;
    }

    setActionLoading(selectedReg.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Nicht angemeldet');
      }

      const { data, error } = await supabase.functions.invoke('reject-registration', {
        body: {
          registration_id: selectedReg.id,
          reason: rejectionReason,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Abgelehnt',
          description: `Registrierung für ${selectedReg.email} wurde abgelehnt.`,
        });
        setShowRejectDialog(false);
        setRejectionReason('');
        setSelectedReg(null);
        loadRegistrations();
      } else {
        throw new Error(data?.error || 'Unbekannter Fehler');
      }
    } catch (error: any) {
      console.error('Rejection error:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error.message || 'Fehler beim Ablehnen der Registrierung',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Ausstehend</Badge>;
      case 'approved':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="w-3 h-3" />Genehmigt</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Abgelehnt</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingRegs = registrations.filter(r => r.status === 'pending');
  const processedRegs = registrations.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Registrierungsanfragen</h1>
        <p className="text-muted-foreground">Neue Mitarbeiter-Registrierungen genehmigen oder ablehnen</p>
      </div>

      {pendingRegs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Ausstehende Anfragen ({pendingRegs.length})</h2>
          <div className="grid gap-4">
            {pendingRegs.map((reg) => (
              <Card key={reg.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{reg.email}</CardTitle>
                      <CardDescription>
                        Eingereicht am {new Date(reg.created_at).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </CardDescription>
                    </div>
                    {getStatusBadge(reg.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(reg)}
                      disabled={actionLoading === reg.id}
                      className="gap-2"
                    >
                      {actionLoading === reg.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Genehmigen
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setSelectedReg(reg);
                        setShowRejectDialog(true);
                      }}
                      disabled={actionLoading === reg.id}
                      className="gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Ablehnen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {processedRegs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Bearbeitete Anfragen ({processedRegs.length})</h2>
          <div className="grid gap-4">
            {processedRegs.map((reg) => (
              <Card key={reg.id} className="opacity-75">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{reg.email}</CardTitle>
                      <CardDescription>
                        Bearbeitet am {reg.reviewed_at ? new Date(reg.reviewed_at).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }) : '-'}
                      </CardDescription>
                    </div>
                    {getStatusBadge(reg.status)}
                  </div>
                  {reg.rejection_reason && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Grund: {reg.rejection_reason}
                    </p>
                  )}
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      {registrations.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Keine Registrierungsanfragen vorhanden</p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrierung ablehnen</AlertDialogTitle>
            <AlertDialogDescription>
              Bitte geben Sie einen Grund für die Ablehnung an.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Ablehnungsgrund..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="min-h-[100px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowRejectDialog(false);
              setRejectionReason('');
              setSelectedReg(null);
            }}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={!rejectionReason.trim() || actionLoading !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ablehnen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
