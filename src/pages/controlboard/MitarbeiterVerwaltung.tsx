import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Clock, UserPlus, Trash2, UserX, UserCheck, Upload, Mail, LinkIcon } from 'lucide-react';
import { AvatarUpload } from '@/components/mitarbeiter/AvatarUpload';
import { MitarbeiterImport } from '@/components/import/MitarbeiterImport';

interface PendingRegistration {
  id: string;
  email: string;
  vorname: string;
  nachname: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
}

interface Mitarbeiter {
  id: string;
  vorname: string | null;
  nachname: string | null;
  telefon: string | null;
  ist_aktiv: boolean;
  created_at: string;
  benutzer_id: string | null;
  avatar_url: string | null;
  farbe_kalender: string | null;
  soll_wochenstunden: number | null;
  strasse: string | null;
  plz: string | null;
  stadt: string | null;
  benutzer?: {
    vorname: string;
    nachname: string;
    email: string;
  };
}

export default function MitarbeiterVerwaltung() {
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMitarbeiter, setSelectedMitarbeiter] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  // Invite dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteMitarbeiterId, setInviteMitarbeiterId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMitarbeiterName, setInviteMitarbeiterName] = useState('');
  
  const { toast } = useToast();

  // New employee form
  const [newEmployee, setNewEmployee] = useState({
    vorname: '',
    nachname: '',
    telefon: '',
  });

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('mitarbeiter-changes')
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
      const { data: regData, error: regError } = await supabase
        .from('pending_registrations')
        .select('*')
        .order('created_at', { ascending: false });
      if (regError) throw regError;

      const { data: mitData, error: mitError } = await supabase
        .from('mitarbeiter')
        .select('*')
        .order('created_at', { ascending: false });
      if (mitError) throw mitError;

      let enrichedMitarbeiter: any[] = mitData || [];
      const benutzerIds = (enrichedMitarbeiter
        .map((m: any) => m.benutzer_id)
        .filter((id: string | null) => !!id)) as string[];

      if (benutzerIds.length > 0) {
        const { data: benData, error: benError } = await supabase
          .from('benutzer')
          .select('id, vorname, nachname, email')
          .in('id', benutzerIds);

        if (!benError && benData) {
          const byId = new Map(benData.map((b: any) => [b.id, b]));
          enrichedMitarbeiter = enrichedMitarbeiter.map((m: any) => ({
            ...m,
            benutzer: m.benutzer_id ? byId.get(m.benutzer_id) : undefined,
          }));
        }
      }

      setRegistrations(regData || []);
      setMitarbeiter(enrichedMitarbeiter as any);
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

  const handleApprove = async (registrationId: string, email: string) => {
    setActionLoading(registrationId);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke('approve-registration', {
        body: { registration_id: registrationId, email },
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
        description: 'Registrierung wurde genehmigt.',
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
    if (!selectedRegistration) return;

    setActionLoading(selectedRegistration);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('reject-registration', {
        body: { registration_id: selectedRegistration, reason: rejectionReason },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: 'Erfolgreich',
        description: 'Registrierung wurde abgelehnt.',
      });

      setRejectDialogOpen(false);
      setSelectedRegistration(null);
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

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('create-new');

    try {
      const { error } = await supabase
        .from('mitarbeiter')
        .insert({
          vorname: newEmployee.vorname,
          nachname: newEmployee.nachname,
          telefon: newEmployee.telefon || null,
          ist_aktiv: true,
        });

      if (error) throw error;

      toast({
        title: 'Erfolgreich',
        description: 'Mitarbeiter wurde als Datensatz angelegt. Sie können ihn später einladen.',
      });

      setNewEmployee({ vorname: '', nachname: '', telefon: '' });
      loadData();
    } catch (error: any) {
      console.error('Error creating employee:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error.message || 'Erstellung fehlgeschlagen.',
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
      const { data: mitarbeiterData } = await supabase
        .from('mitarbeiter')
        .select('benutzer_id')
        .eq('id', selectedMitarbeiter)
        .single();

      const { error: mitError } = await supabase
        .from('mitarbeiter')
        .delete()
        .eq('id', selectedMitarbeiter);

      if (mitError) throw mitError;

      if (mitarbeiterData?.benutzer_id) {
        await supabase
          .from('benutzer')
          .delete()
          .eq('id', mitarbeiterData.benutzer_id);
      }

      toast({
        title: 'Erfolgreich',
        description: 'Mitarbeiter wurde gelöscht.',
      });

      setDeleteDialogOpen(false);
      setSelectedMitarbeiter(null);
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error.message || 'Löschen fehlgeschlagen.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenInviteDialog = (m: Mitarbeiter) => {
    setInviteMitarbeiterId(m.id);
    setInviteMitarbeiterName(`${m.vorname || ''} ${m.nachname || ''}`.trim());
    setInviteEmail('');
    setInviteDialogOpen(true);
  };

  const handleSendInvite = async () => {
    if (!inviteMitarbeiterId || !inviteEmail) return;

    setActionLoading(inviteMitarbeiterId);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke('activate-mitarbeiter', {
        body: { mitarbeiter_id: inviteMitarbeiterId, email: inviteEmail.trim() },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Einladung gesendet',
        description: data?.message || `Einladung an ${inviteEmail} gesendet.`,
      });

      setInviteDialogOpen(false);
      setInviteMitarbeiterId(null);
      setInviteEmail('');
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error.message || 'Einladung fehlgeschlagen.',
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

  const pendingRegistrations = registrations.filter(r => r.status === 'pending');
  const processedRegistrations = registrations.filter(r => r.status !== 'pending');

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Mitarbeiterverwaltung</h1>
        <p className="text-muted-foreground">Mitarbeiter anlegen, verwalten und zur Registrierung einladen</p>
      </div>

      <Tabs defaultValue="employees" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="employees">Mitarbeiter ({mitarbeiter.length})</TabsTrigger>
            <TabsTrigger value="registrations">
              Registrierungen {pendingRegistrations.length > 0 && `(${pendingRegistrations.length})`}
            </TabsTrigger>
            <TabsTrigger value="create">Neuer Mitarbeiter</TabsTrigger>
          </TabsList>
          <Button onClick={() => setShowImportDialog(true)} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            KI-Import
          </Button>
        </div>

        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alle Mitarbeiter</CardTitle>
              <CardDescription>Mitarbeiter als Datensätze – können separat zur Registrierung eingeladen werden</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mitarbeiter.map((m) => {
                  const fullName = `${m.vorname || m.benutzer?.vorname || 'Unbekannt'} ${m.nachname || m.benutzer?.nachname || ''}`.trim();
                  const hasAccount = !!m.benutzer_id;
                  return (
                  <div key={m.id} className="flex justify-between items-center p-4 border rounded-lg gap-4">
                    <div className="flex items-center gap-4">
                      <AvatarUpload
                        mitarbeiterId={m.id}
                        currentAvatarUrl={m.avatar_url}
                        name={fullName}
                        color={m.farbe_kalender || '#3B82F6'}
                        size="md"
                        onUploadComplete={() => loadData()}
                        onRemove={() => loadData()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{fullName}</p>
                          {hasAccount ? (
                            <Badge variant="outline" className="text-xs bg-green-500/10">
                              <LinkIcon className="w-3 h-3 mr-1" />Verknüpft
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-muted">
                              Nur Datensatz
                            </Badge>
                          )}
                        </div>
                        {m.benutzer?.email && (
                          <p className="text-sm text-muted-foreground">{m.benutzer.email}</p>
                        )}
                        {m.telefon && (
                          <p className="text-xs text-muted-foreground">Tel: {m.telefon}</p>
                        )}
                        {m.soll_wochenstunden && (
                          <p className="text-xs text-muted-foreground">{m.soll_wochenstunden}h/Woche</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={m.ist_aktiv ? 'default' : 'secondary'}>
                        {m.ist_aktiv ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                      {!hasAccount && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenInviteDialog(m)}
                          disabled={actionLoading === m.id}
                          title="Zur Registrierung einladen"
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Einladen
                        </Button>
                      )}
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
                  );
                })}
                {mitarbeiter.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Keine Mitarbeiter vorhanden. Nutzen Sie den KI-Import oder legen Sie manuell an.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="registrations" className="space-y-4">
          {pendingRegistrations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ausstehende Registrierungen</CardTitle>
                <CardDescription>
                  Mitarbeiter die sich über den Einladungslink registriert haben und auf Freischaltung warten
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {pendingRegistrations.map((reg) => (
                  <Card key={reg.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{reg.vorname} {reg.nachname}</h3>
                            {getStatusBadge(reg.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">{reg.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Beantragt am: {new Date(reg.created_at).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                        <div className="space-y-2 min-w-[300px]">
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleApprove(reg.id, reg.email)}
                              disabled={actionLoading === reg.id}
                              className="flex-1"
                            >
                              {actionLoading === reg.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Freischalten
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => {
                                setSelectedRegistration(reg.id);
                                setRejectDialogOpen(true);
                              }}
                              disabled={actionLoading === reg.id}
                            >
                              Ablehnen
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          )}

          {processedRegistrations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Bearbeitete Registrierungen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {processedRegistrations.map((reg) => (
                  <div key={reg.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{reg.vorname} {reg.nachname}</p>
                      <p className="text-sm text-muted-foreground">{reg.email}</p>
                      {reg.rejection_reason && (
                        <p className="text-xs text-destructive mt-1">Grund: {reg.rejection_reason}</p>
                      )}
                    </div>
                    {getStatusBadge(reg.status)}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {registrations.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Keine Registrierungen vorhanden. Laden Sie Mitarbeiter ein, damit sie sich registrieren können.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Neuen Mitarbeiter anlegen
              </CardTitle>
              <CardDescription>
                Erstellt einen Mitarbeiter-Datensatz. Sie können den Mitarbeiter später zur Registrierung einladen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateEmployee} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vorname">Vorname *</Label>
                    <Input
                      id="vorname"
                      value={newEmployee.vorname}
                      onChange={(e) => setNewEmployee({ ...newEmployee, vorname: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nachname">Nachname *</Label>
                    <Input
                      id="nachname"
                      value={newEmployee.nachname}
                      onChange={(e) => setNewEmployee({ ...newEmployee, nachname: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefon">Telefon</Label>
                  <Input
                    id="telefon"
                    type="tel"
                    value={newEmployee.telefon}
                    onChange={(e) => setNewEmployee({ ...newEmployee, telefon: e.target.value })}
                  />
                </div>
                <Button type="submit" disabled={actionLoading === 'create-new'}>
                  {actionLoading === 'create-new' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Mitarbeiter anlegen
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <MitarbeiterImport 
        open={showImportDialog} 
        onOpenChange={setShowImportDialog} 
      />

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Mitarbeiter einladen
            </DialogTitle>
            <DialogDescription>
              Senden Sie eine Einladungs-E-Mail an <strong>{inviteMitarbeiterName}</strong>.
              Der Link läuft nach 24 Stunden ab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">E-Mail-Adresse des Mitarbeiters</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="mitarbeiter@beispiel.de"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleSendInvite} 
              disabled={!inviteEmail || actionLoading === inviteMitarbeiterId}
            >
              {actionLoading === inviteMitarbeiterId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Mail className="h-4 w-4 mr-2" />
              Einladung senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrierung ablehnen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diese Registrierung wirklich ablehnen?
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
            <AlertDialogTitle>Mitarbeiter löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie diesen Mitarbeiter dauerhaft löschen möchten? 
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
    </div>
  );
}
