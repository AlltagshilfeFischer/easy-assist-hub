import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Clock, UserPlus } from 'lucide-react';

interface PendingBenutzer {
  id: string;
  email: string;
  vorname: string | null;
  nachname: string | null;
  status: string;
  created_at: string;
}

interface Mitarbeiter {
  id: string;
  vorname: string | null;
  nachname: string | null;
  ist_aktiv: boolean;
  benutzer?: {
    email: string;
  };
}

export default function BenutzerverwaltungNeu() {
  const [pendingBenutzer, setPendingBenutzer] = useState<PendingBenutzer[]>([]);
  const [processedBenutzer, setProcessedBenutzer] = useState<PendingBenutzer[]>([]);
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedBenutzer, setSelectedBenutzer] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('benutzer-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'benutzer' },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mitarbeiter' },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadData = async () => {
    try {
      const [benutzerResponse, mitarbeiterResponse] = await Promise.all([
        supabase
          .from('benutzer')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('mitarbeiter')
          .select(`
            *,
            benutzer:benutzer_id (
              email
            )
          `)
          .order('created_at', { ascending: false })
      ]);

      if (benutzerResponse.error) throw benutzerResponse.error;
      if (mitarbeiterResponse.error) throw mitarbeiterResponse.error;

      const allBenutzer = benutzerResponse.data || [];
      setPendingBenutzer(allBenutzer.filter(b => b.status === 'pending'));
      setProcessedBenutzer(allBenutzer.filter(b => b.status !== 'pending'));
      setMitarbeiter(mitarbeiterResponse.data || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Daten konnten nicht geladen werden.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (benutzer: PendingBenutzer) => {
    setActionLoading(benutzer.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke('approve-benutzer', {
        body: {
          benutzer_id: benutzer.id,
          email: benutzer.email,
          vorname: benutzer.vorname,
          nachname: benutzer.nachname
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) {
        const serverMsg = (data as any)?.error || (typeof data === 'string' ? data : null);
        throw new Error(serverMsg || error.message);
      }

      toast({
        title: 'Erfolgreich',
        description: 'Benutzer wurde genehmigt und als Mitarbeiter aktiviert.',
      });

      loadData();
    } catch (error: any) {
      console.error('Error approving:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error.message || 'Genehmigung fehlgeschlagen.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selectedBenutzer) return;

    setActionLoading(selectedBenutzer);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke('reject-benutzer', {
        body: {
          benutzer_id: selectedBenutzer,
          reason: rejectionReason
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: 'Erfolgreich',
        description: 'Benutzer wurde abgelehnt.',
      });

      setRejectDialogOpen(false);
      setSelectedBenutzer(null);
      setRejectionReason('');
      loadData();
    } catch (error: any) {
      console.error('Error rejecting:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error.message || 'Ablehnung fehlgeschlagen.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10"><Clock className="w-3 h-3 mr-1" />Ausstehend</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/10"><CheckCircle className="w-3 h-3 mr-1" />Genehmigt</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10"><XCircle className="w-3 h-3 mr-1" />Abgelehnt</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Benutzerverwaltung</h1>
        <p className="text-muted-foreground">Registrierungen verwalten und Mitarbeiter freischalten</p>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">
            Ausstehend {pendingBenutzer.length > 0 && `(${pendingBenutzer.length})`}
          </TabsTrigger>
          <TabsTrigger value="processed">Verlauf ({processedBenutzer.length})</TabsTrigger>
          <TabsTrigger value="mitarbeiter">Mitarbeiter ({mitarbeiter.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingBenutzer.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Ausstehende Registrierungen</CardTitle>
                <CardDescription>
                  Benutzer die auf Genehmigung warten
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {pendingBenutzer.map((benutzer) => (
                  <Card key={benutzer.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">
                              {benutzer.vorname || benutzer.nachname
                                ? `${benutzer.vorname || ''} ${benutzer.nachname || ''}`.trim()
                                : 'Kein Name'}
                            </h3>
                            {getStatusBadge(benutzer.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">{benutzer.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Registriert am: {new Date(benutzer.created_at).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleApprove(benutzer)}
                            disabled={actionLoading === benutzer.id}
                          >
                            {actionLoading === benutzer.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Genehmigen
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              setSelectedBenutzer(benutzer.id);
                              setRejectDialogOpen(true);
                            }}
                            disabled={actionLoading === benutzer.id}
                          >
                            Ablehnen
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Keine ausstehenden Registrierungen
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="processed">
          <Card>
            <CardHeader>
              <CardTitle>Verlauf</CardTitle>
              <CardDescription>Historie aller genehmigten und abgelehnten Registrierungen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {processedBenutzer.length > 0 ? (
                processedBenutzer.map((benutzer) => (
                  <div key={benutzer.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">
                        {benutzer.vorname || benutzer.nachname
                          ? `${benutzer.vorname || ''} ${benutzer.nachname || ''}`.trim()
                          : 'Kein Name'}
                      </p>
                      <p className="text-sm text-muted-foreground">{benutzer.email}</p>
                    </div>
                    {getStatusBadge(benutzer.status)}
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Kein Verlauf vorhanden
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mitarbeiter">
          <Card>
            <CardHeader>
              <CardTitle>Alle Mitarbeiter</CardTitle>
              <CardDescription>Übersicht aller aktiven Mitarbeiter</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mitarbeiter.length > 0 ? (
                  mitarbeiter.map((m) => (
                    <div key={m.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">
                          {m.vorname || m.nachname
                            ? `${m.vorname || ''} ${m.nachname || ''}`.trim()
                            : 'Unbekannt'}
                        </p>
                        <p className="text-sm text-muted-foreground">{m.benutzer?.email || 'Keine E-Mail'}</p>
                      </div>
                      <Badge variant={m.ist_aktiv ? 'default' : 'secondary'}>
                        {m.ist_aktiv ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Keine Mitarbeiter vorhanden
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Benutzer ablehnen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diesen Benutzer wirklich ablehnen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="rejection-reason">Ablehnungsgrund (optional)</Label>
            <Input
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Grund der Ablehnung..."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-destructive text-destructive-foreground">
              Ablehnen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
