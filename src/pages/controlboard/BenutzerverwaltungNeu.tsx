import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Clock, UserPlus, Trash2, UserX, UserCheck, Pencil } from 'lucide-react';

interface PendingRegistration {
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
  telefon: string | null;
  strasse: string | null;
  stadt: string | null;
  plz: string | null;
  farbe_kalender: string | null;
  standort: 'Hannover' | null;
  zustaendigkeitsbereich: string | null;
  soll_wochenstunden: number | null;
  max_termine_pro_tag: number | null;
  benutzer?: {
    email: string;
  };
}

export default function BenutzerverwaltungNeu() {
  const [pendingBenutzer, setPendingBenutzer] = useState<PendingRegistration[]>([]);
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedBenutzer, setSelectedBenutzer] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMitarbeiter, setSelectedMitarbeiter] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMitarbeiter, setEditingMitarbeiter] = useState<Mitarbeiter | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('registration-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_registrations' },
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
      const [registrationsResponse, mitarbeiterResponse] = await Promise.all([
        supabase
          .from('pending_registrations')
          .select('*')
          .eq('status', 'pending')
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

      if (registrationsResponse.error) throw registrationsResponse.error;
      if (mitarbeiterResponse.error) throw mitarbeiterResponse.error;

      setPendingBenutzer(registrationsResponse.data || []);
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

  const handleApprove = async (registration: PendingRegistration) => {
    setActionLoading(registration.id);
    try {
      const { data, error } = await supabase.functions.invoke('approve-benutzer', {
        body: {
          registration_id: registration.id,
          email: registration.email,
          vorname: registration.vorname,
          nachname: registration.nachname
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
      const { data, error } = await supabase.functions.invoke('reject-benutzer', {
        body: {
          registration_id: selectedBenutzer,
          reason: rejectionReason
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

  const handleToggleActive = async (mitarbeiterId: string, currentStatus: boolean) => {
    setActionLoading(mitarbeiterId);
    try {
      const { error } = await supabase
        .from('mitarbeiter')
        .update({ ist_aktiv: !currentStatus })
        .eq('id', mitarbeiterId);

      if (error) throw error;

      toast({
        title: 'Erfolgreich',
        description: `Mitarbeiter wurde ${!currentStatus ? 'aktiviert' : 'deaktiviert'}.`,
      });

      loadData();
    } catch (error: any) {
      console.error('Error toggling employee status:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error.message || 'Status konnte nicht geändert werden.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!selectedMitarbeiter) return;

    setActionLoading(selectedMitarbeiter);
    try {
      const { data, error } = await supabase.functions.invoke('delete-mitarbeiter', {
        body: { mitarbeiterId: selectedMitarbeiter },
      });

      if (error) {
        const serverMsg = (data as any)?.error || (typeof data === 'string' ? data : null);
        throw new Error(serverMsg || error.message);
      }

      toast({
        title: 'Erfolgreich',
        description: 'Mitarbeiter wurde komplett gelöscht (inkl. Auth-User, Termine, Änderungsanträge).',
      });

      setDeleteDialogOpen(false);
      setSelectedMitarbeiter(null);
      loadData();
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error.message || 'Löschen fehlgeschlagen.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditMitarbeiter = (mitarbeiter: Mitarbeiter) => {
    setEditingMitarbeiter(mitarbeiter);
    setEditDialogOpen(true);
  };

  const handleSaveMitarbeiter = async () => {
    if (!editingMitarbeiter) return;

    setActionLoading(editingMitarbeiter.id);
    try {
      const { error } = await supabase
        .from('mitarbeiter')
        .update({
          vorname: editingMitarbeiter.vorname,
          nachname: editingMitarbeiter.nachname,
          telefon: editingMitarbeiter.telefon,
          strasse: editingMitarbeiter.strasse,
          stadt: editingMitarbeiter.stadt,
          plz: editingMitarbeiter.plz,
          farbe_kalender: editingMitarbeiter.farbe_kalender,
          standort: editingMitarbeiter.standort,
          zustaendigkeitsbereich: editingMitarbeiter.zustaendigkeitsbereich,
          soll_wochenstunden: editingMitarbeiter.soll_wochenstunden,
          max_termine_pro_tag: editingMitarbeiter.max_termine_pro_tag,
        })
        .eq('id', editingMitarbeiter.id);

      if (error) throw error;

      toast({
        title: 'Erfolgreich',
        description: 'Mitarbeiter-Daten wurden aktualisiert.',
      });

      setEditDialogOpen(false);
      setEditingMitarbeiter(null);
      loadData();
    } catch (error: any) {
      console.error('Error updating employee:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error.message || 'Aktualisierung fehlgeschlagen.',
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
                      <div className="flex-1">
                        <p className="font-medium">
                          {m.vorname || m.nachname
                            ? `${m.vorname || ''} ${m.nachname || ''}`.trim()
                            : 'Unbekannt'}
                        </p>
                        <p className="text-sm text-muted-foreground">{m.benutzer?.email || 'Keine E-Mail'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={m.ist_aktiv ? 'default' : 'secondary'}>
                          {m.ist_aktiv ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditMitarbeiter(m)}
                          disabled={actionLoading === m.id}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={m.ist_aktiv ? 'outline' : 'default'}
                          size="sm"
                          onClick={() => handleToggleActive(m.id, m.ist_aktiv)}
                          disabled={actionLoading === m.id}
                        >
                          {actionLoading === m.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : m.ist_aktiv ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedMitarbeiter(m.id);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={actionLoading === m.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mitarbeiter komplett löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie diesen Mitarbeiter dauerhaft löschen möchten? 
              Dabei werden gelöscht: Auth-User, Benutzer-Eintrag, Mitarbeiter-Eintrag, alle Termine und Änderungsanträge.
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteEmployee} 
              className="bg-destructive text-destructive-foreground"
              disabled={actionLoading === selectedMitarbeiter}
            >
              {actionLoading === selectedMitarbeiter && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mitarbeiter bearbeiten</DialogTitle>
            <DialogDescription>
              Stammdaten des Mitarbeiters anpassen
            </DialogDescription>
          </DialogHeader>
          {editingMitarbeiter && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-vorname">Vorname</Label>
                  <Input
                    id="edit-vorname"
                    value={editingMitarbeiter.vorname || ''}
                    onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, vorname: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-nachname">Nachname</Label>
                  <Input
                    id="edit-nachname"
                    value={editingMitarbeiter.nachname || ''}
                    onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, nachname: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-telefon">Telefon</Label>
                <Input
                  id="edit-telefon"
                  value={editingMitarbeiter.telefon || ''}
                  onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, telefon: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit-strasse">Straße</Label>
                  <Input
                    id="edit-strasse"
                    value={editingMitarbeiter.strasse || ''}
                    onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, strasse: e.target.value })}
                    placeholder="Straße und Hausnummer"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-plz">PLZ</Label>
                  <Input
                    id="edit-plz"
                    value={editingMitarbeiter.plz || ''}
                    onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, plz: e.target.value })}
                    placeholder="PLZ"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-stadt">Stadt</Label>
                  <Input
                    id="edit-stadt"
                    value={editingMitarbeiter.stadt || ''}
                    onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, stadt: e.target.value })}
                    placeholder="Stadt"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-farbe">Kalenderfarbe</Label>
                  <Input
                    id="edit-farbe"
                    type="color"
                    value={editingMitarbeiter.farbe_kalender || '#3B82F6'}
                    onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, farbe_kalender: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-standort">Standort</Label>
                  <Select
                    value={editingMitarbeiter.standort || 'Hannover'}
                    onValueChange={(value: 'Hannover') => setEditingMitarbeiter({ ...editingMitarbeiter, standort: value })}
                  >
                    <SelectTrigger id="edit-standort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hannover">Hannover</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-zustaendigkeit">Zuständigkeitsbereich</Label>
                <Input
                  id="edit-zustaendigkeit"
                  value={editingMitarbeiter.zustaendigkeitsbereich || ''}
                  onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, zustaendigkeitsbereich: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-wochenstunden">Soll-Wochenstunden</Label>
                  <Input
                    id="edit-wochenstunden"
                    type="number"
                    min="0"
                    step="0.5"
                    value={editingMitarbeiter.soll_wochenstunden || ''}
                    onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, soll_wochenstunden: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-max-termine">Max. Termine pro Tag</Label>
                  <Input
                    id="edit-max-termine"
                    type="number"
                    min="0"
                    value={editingMitarbeiter.max_termine_pro_tag || ''}
                    onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, max_termine_pro_tag: e.target.value ? parseInt(e.target.value) : null })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveMitarbeiter} disabled={actionLoading === editingMitarbeiter?.id}>
              {actionLoading === editingMitarbeiter?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
