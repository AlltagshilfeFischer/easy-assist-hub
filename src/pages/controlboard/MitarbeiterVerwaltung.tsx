import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Clock, UserPlus, Trash2, UserX, UserCheck, Upload } from 'lucide-react';
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
  telefon: string | null;
  ist_aktiv: boolean;
  created_at: string;
  benutzer_id: string | null;
  avatar_url: string | null;
  farbe_kalender: string | null;
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
  
  const { toast } = useToast();

  // New employee form
  const [newEmployee, setNewEmployee] = useState({
    email: '',
    password: '',
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
      // Load registrations first
      const { data: regData, error: regError } = await supabase
        .from('pending_registrations')
        .select('*')
        .order('created_at', { ascending: false });
      if (regError) throw regError;

      // Load employees (without relying on FK embedding)
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
        description: 'Registrierung wurde genehmigt. Einladung zum Setzen des Passworts gesendet.',
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
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('create-employee', {
        body: newEmployee,
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: 'Erfolgreich',
        description: 'Mitarbeiter wurde erstellt.',
      });

      setNewEmployee({
        email: '',
        password: '',
        vorname: '',
        nachname: '',
        telefon: '',
      });
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
      // First, get the benutzer_id before deleting
      const { data: mitarbeiterData } = await supabase
        .from('mitarbeiter')
        .select('benutzer_id')
        .eq('id', selectedMitarbeiter)
        .single();

      // Delete mitarbeiter record
      const { error: mitError } = await supabase
        .from('mitarbeiter')
        .delete()
        .eq('id', selectedMitarbeiter);

      if (mitError) throw mitError;

      // Optionally delete the benutzer record as well
      if (mitarbeiterData?.benutzer_id) {
        const { error: benError } = await supabase
          .from('benutzer')
          .delete()
          .eq('id', mitarbeiterData.benutzer_id);

        if (benError) {
          console.error('Error deleting benutzer:', benError);
          // Continue anyway as mitarbeiter is deleted
        }
      }

      toast({
        title: 'Erfolgreich',
        description: 'Mitarbeiter wurde gelöscht.',
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
        <p className="text-muted-foreground">Registrierungen verwalten und Mitarbeiter anlegen</p>
      </div>

      <Tabs defaultValue="registrations" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="registrations">
              Registrierungen {pendingRegistrations.length > 0 && `(${pendingRegistrations.length})`}
            </TabsTrigger>
            <TabsTrigger value="employees">Mitarbeiter ({mitarbeiter.length})</TabsTrigger>
            <TabsTrigger value="create">Neuer Mitarbeiter</TabsTrigger>
          </TabsList>
          <Button onClick={() => setShowImportDialog(true)} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Mitarbeiter importieren
          </Button>
        </div>

        <TabsContent value="registrations" className="space-y-4">
          {pendingRegistrations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ausstehende Registrierungen</CardTitle>
                <CardDescription>
                  Registrierungsanfragen die auf Genehmigung warten
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
                              Genehmigen & Einladung senden
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
                Keine Registrierungen vorhanden
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alle Mitarbeiter</CardTitle>
              <CardDescription>Übersicht aller registrierten Mitarbeiter</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mitarbeiter.map((m) => {
                  const fullName = `${m.benutzer?.vorname || 'Unbekannt'} ${m.benutzer?.nachname || ''}`.trim();
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
                        <p className="font-medium">
                          {fullName}
                        </p>
                        <p className="text-sm text-muted-foreground">{m.benutzer?.email}</p>
                        {m.telefon && (
                          <p className="text-xs text-muted-foreground">Tel: {m.telefon}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={m.ist_aktiv ? 'default' : 'secondary'}>
                        {m.ist_aktiv ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Neuen Mitarbeiter anlegen
              </CardTitle>
              <CardDescription>
                Direktes Anlegen eines Mitarbeiters mit sofortigem Zugang
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
                  <Label htmlFor="email">E-Mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Passwort *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newEmployee.password}
                    onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                    required
                  />
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
