import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Clock, UserPlus, Trash2, UserX, UserCheck, Pencil, Mail, Users, Search, Upload } from 'lucide-react';
import { AvatarUpload } from '@/components/mitarbeiter/AvatarUpload';
import { MitarbeiterImport } from '@/components/import/MitarbeiterImport';

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
  avatar_url: string | null;
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
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', vorname: '', nachname: '' });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);

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
          .order('nachname', { ascending: true })
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
        description: 'Mitarbeiter wurde komplett gelöscht.',
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

  const handleInviteMitarbeiter = async () => {
    if (!inviteForm.email) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'E-Mail-Adresse ist erforderlich.',
      });
      return;
    }

    setInviteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-mitarbeiter', {
        body: {
          email: inviteForm.email,
          vorname: inviteForm.vorname,
          nachname: inviteForm.nachname
        },
      });

      if (error) {
        const serverMsg = (data as any)?.error || (typeof data === 'string' ? data : null);
        throw new Error(serverMsg || error.message);
      }

      toast({
        title: 'Erfolgreich',
        description: data?.message || 'Mitarbeiter eingeladen.',
      });

      setInviteDialogOpen(false);
      setInviteForm({ email: '', vorname: '', nachname: '' });
      loadData();
    } catch (error: any) {
      console.error('Error inviting:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error.message || 'Einladung fehlgeschlagen.',
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const filteredMitarbeiter = mitarbeiter.filter(m => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${m.vorname || ''} ${m.nachname || ''}`.toLowerCase();
    const email = m.benutzer?.email?.toLowerCase() || '';
    return fullName.includes(query) || email.includes(query);
  });

  const activeMitarbeiter = filteredMitarbeiter.filter(m => m.ist_aktiv);
  const inactiveMitarbeiter = filteredMitarbeiter.filter(m => !m.ist_aktiv);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Benutzerverwaltung</h1>
          <p className="text-muted-foreground">Mitarbeiter verwalten und neue einladen</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Importieren
          </Button>
          <Button onClick={() => setInviteDialogOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Mitarbeiter einladen
          </Button>
        </div>
      </div>

      {/* Import Dialog */}
      <MitarbeiterImport 
        open={importDialogOpen} 
        onOpenChange={setImportDialogOpen} 
      />

      {/* Main Layout: Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Employee List (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-xl">Alle Mitarbeiter</CardTitle>
                  <Badge variant="secondary">{mitarbeiter.length}</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full sm:w-64"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-320px)] pr-4">
                {/* Active Employees */}
                {activeMitarbeiter.length > 0 && (
                  <div className="space-y-2 mb-6">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      Aktive Mitarbeiter ({activeMitarbeiter.length})
                    </h3>
                    {activeMitarbeiter.map((m) => (
                      <MitarbeiterRow
                        key={m.id}
                        mitarbeiter={m}
                        actionLoading={actionLoading}
                        onEdit={handleEditMitarbeiter}
                        onToggleActive={handleToggleActive}
                        onDelete={(id) => {
                          setSelectedMitarbeiter(id);
                          setDeleteDialogOpen(true);
                        }}
                        loadData={loadData}
                      />
                    ))}
                  </div>
                )}

                {/* Inactive Employees */}
                {inactiveMitarbeiter.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      Inaktive Mitarbeiter ({inactiveMitarbeiter.length})
                    </h3>
                    {inactiveMitarbeiter.map((m) => (
                      <MitarbeiterRow
                        key={m.id}
                        mitarbeiter={m}
                        actionLoading={actionLoading}
                        onEdit={handleEditMitarbeiter}
                        onToggleActive={handleToggleActive}
                        onDelete={(id) => {
                          setSelectedMitarbeiter(id);
                          setDeleteDialogOpen(true);
                        }}
                        loadData={loadData}
                      />
                    ))}
                  </div>
                )}

                {filteredMitarbeiter.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    {searchQuery ? 'Keine Mitarbeiter gefunden' : 'Keine Mitarbeiter vorhanden'}
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right: Pending Registrations (1/3 width) */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-xl">Ausstehend</CardTitle>
                {pendingBenutzer.length > 0 && (
                  <Badge variant="destructive">{pendingBenutzer.length}</Badge>
                )}
              </div>
              <CardDescription>
                Registrierungsanfragen prüfen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-380px)]">
                {pendingBenutzer.length > 0 ? (
                  <div className="space-y-3">
                    {pendingBenutzer.map((benutzer) => (
                      <Card key={benutzer.id} className="bg-muted/50">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div>
                              <p className="font-medium">
                                {benutzer.vorname || benutzer.nachname
                                  ? `${benutzer.vorname || ''} ${benutzer.nachname || ''}`.trim()
                                  : 'Kein Name'}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                {benutzer.email}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(benutzer.created_at).toLocaleDateString('de-DE')}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApprove(benutzer)}
                                disabled={actionLoading === benutzer.id}
                                className="flex-1"
                              >
                                {actionLoading === benutzer.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedBenutzer(benutzer.id);
                                  setRejectDialogOpen(true);
                                }}
                                disabled={actionLoading === benutzer.id}
                                className="flex-1"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Keine ausstehenden Anfragen</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reject Dialog */}
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

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mitarbeiter komplett löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher? Dabei werden gelöscht: Auth-User, Benutzer-Eintrag, 
              Mitarbeiter-Eintrag, alle Termine und Änderungsanträge.
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

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Mitarbeiter einladen
            </DialogTitle>
            <DialogDescription>
              Der Mitarbeiter erhält eine E-Mail mit einem Link zur Passwort-Erstellung.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">E-Mail-Adresse *</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="mitarbeiter@beispiel.de"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invite-vorname">Vorname</Label>
                <Input
                  id="invite-vorname"
                  value={inviteForm.vorname}
                  onChange={(e) => setInviteForm({ ...inviteForm, vorname: e.target.value })}
                  placeholder="Max"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-nachname">Nachname</Label>
                <Input
                  id="invite-nachname"
                  value={inviteForm.nachname}
                  onChange={(e) => setInviteForm({ ...inviteForm, nachname: e.target.value })}
                  placeholder="Mustermann"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleInviteMitarbeiter} disabled={inviteLoading}>
              {inviteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Einladung senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
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
              {/* Avatar Upload Section */}
              <div className="flex justify-center pb-4 border-b">
                <div className="text-center">
                  <AvatarUpload
                    mitarbeiterId={editingMitarbeiter.id}
                    currentAvatarUrl={editingMitarbeiter.avatar_url}
                    name={`${editingMitarbeiter.vorname || ''} ${editingMitarbeiter.nachname || ''}`.trim() || 'Mitarbeiter'}
                    color={editingMitarbeiter.farbe_kalender || '#3B82F6'}
                    size="lg"
                    onUploadComplete={() => loadData()}
                    onRemove={() => loadData()}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Hover für Upload-Optionen
                  </p>
                </div>
              </div>
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

// Extracted component for employee rows
function MitarbeiterRow({ 
  mitarbeiter: m, 
  actionLoading, 
  onEdit, 
  onToggleActive, 
  onDelete,
  loadData 
}: {
  mitarbeiter: Mitarbeiter;
  actionLoading: string | null;
  onEdit: (m: Mitarbeiter) => void;
  onToggleActive: (id: string, status: boolean) => void;
  onDelete: (id: string) => void;
  loadData: () => void;
}) {
  const fullName = m.vorname || m.nachname
    ? `${m.vorname || ''} ${m.nachname || ''}`.trim()
    : 'Unbekannt';

  return (
    <div className={`flex justify-between items-center p-4 border rounded-lg hover:bg-muted/50 transition-colors ${!m.ist_aktiv ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-4">
        <AvatarUpload
          mitarbeiterId={m.id}
          currentAvatarUrl={m.avatar_url}
          name={fullName}
          color={m.farbe_kalender || '#3B82F6'}
          size="md"
          onUploadComplete={loadData}
          onRemove={loadData}
        />
        <div>
          <p className="font-medium">{fullName}</p>
          <p className="text-sm text-muted-foreground">{m.benutzer?.email || 'Keine E-Mail'}</p>
          {m.telefon && (
            <p className="text-xs text-muted-foreground">{m.telefon}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={m.ist_aktiv ? 'default' : 'secondary'}>
          {m.ist_aktiv ? 'Aktiv' : 'Inaktiv'}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(m)}
          disabled={actionLoading === m.id}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant={m.ist_aktiv ? 'outline' : 'default'}
          size="sm"
          onClick={() => onToggleActive(m.id, m.ist_aktiv)}
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
          onClick={() => onDelete(m.id)}
          disabled={actionLoading === m.id}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
