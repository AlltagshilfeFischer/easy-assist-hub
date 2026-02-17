import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, UserX, UserCheck, Pencil, Users, Search, Upload, Shield, KeyRound, CheckCircle2, Mail, Send, ChevronDown, ChevronRight, Plus, Sparkles, UserPlus } from 'lucide-react';
import { AvatarUpload } from '@/components/mitarbeiter/AvatarUpload';
import { useQueryClient } from '@tanstack/react-query';
import { useUserRole, type UserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';

// Geschützte System-Accounts die nicht gelöscht werden dürfen
const PROTECTED_EMAILS = ['admin@af-verwaltung.de'];

function isProtectedUser(m: Mitarbeiter): boolean {
  return PROTECTED_EMAILS.includes(m.benutzer?.email?.toLowerCase() || '');
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
  benutzer_id: string | null;
  benutzer?: {
    email: string;
  };
}

export default function BenutzerverwaltungNeu() {
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [userRolesMap, setUserRolesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkActionLoading] = useState(false);
   const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
   const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
   const [selectedMitarbeiter, setSelectedMitarbeiter] = useState<string | null>(null);
   const [editDialogOpen, setEditDialogOpen] = useState(false);
   const [editingMitarbeiter, setEditingMitarbeiter] = useState<Mitarbeiter | null>(null);
   const [activateDialogOpen, setActivateDialogOpen] = useState(false);
   const [activateTarget, setActivateTarget] = useState<Mitarbeiter | null>(null);
   const [activateEmail, setActivateEmail] = useState('');
   const [searchQuery, setSearchQuery] = useState('');
   const [importDialogOpen, setImportDialogOpen] = useState(false);
   const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
   const [createUserForm, setCreateUserForm] = useState({ email: '', password: '', vorname: '', nachname: '', rolle: 'geschaeftsfuehrer' });
   const [createUserLoading, setCreateUserLoading] = useState(false);
   const [deactivatedSectionOpen, setDeactivatedSectionOpen] = useState(false);
  
  // Multi-select removed - unified list now

  const { toast } = useToast();
  const { isGeschaeftsfuehrer, isAdmin } = useUserRole();
  const { user } = useAuth();
  
  // GF hat direkt vollen Zugriff auf Rollenverwaltung

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('benutzerverwaltung-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mitarbeiter' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'benutzer' }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadData = async () => {
    try {
      const [mitarbeiterResponse, rolesResponse] = await Promise.all([
        supabase
          .from('mitarbeiter')
          .select(`*, benutzer:benutzer_id (email)`)
          .order('nachname', { ascending: true }),
        supabase
          .from('user_roles')
          .select('user_id, role')
      ]);

      if (mitarbeiterResponse.error) throw mitarbeiterResponse.error;
      setMitarbeiter(mitarbeiterResponse.data || []);
      
      const rolesMap: Record<string, string> = {};
      if (rolesResponse.data) {
        for (const entry of rolesResponse.data) {
          const current = rolesMap[entry.user_id];
          const priority: Record<string, number> = { geschaeftsfuehrer: 4, admin: 3, buchhaltung: 2, mitarbeiter: 1 };
          if (!current || (priority[entry.role] || 0) > (priority[current] || 0)) {
            rolesMap[entry.user_id] = entry.role;
          }
        }
      }
      setUserRolesMap(rolesMap);
      
      // Clean up stale selections

    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({ variant: 'destructive', title: 'Fehler', description: 'Daten konnten nicht geladen werden.' });
    } finally {
      setLoading(false);
    }
  };

  // All active employees (with or without account)
  const allActiveMitarbeiter = mitarbeiter.filter(m => m.ist_aktiv);

  // Deactivated employees
  const deactivatedMitarbeiter = mitarbeiter.filter(m => !m.ist_aktiv);

  const filteredAllActive = allActiveMitarbeiter.filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = `${m.vorname || ''} ${m.nachname || ''}`.toLowerCase();
    const email = m.benutzer?.email?.toLowerCase() || '';
    return name.includes(q) || email.includes(q) || (m.telefon || '').includes(q);
  });

  const filteredDeactivated = deactivatedMitarbeiter.filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = `${m.vorname || ''} ${m.nachname || ''}`.toLowerCase();
    const email = m.benutzer?.email?.toLowerCase() || '';
    return name.includes(q) || email.includes(q);
  });

  const handleDeactivateEmployee = async () => {
    if (!selectedMitarbeiter) return;
    setActionLoading(selectedMitarbeiter);
    try {
      const { error } = await supabase.from('mitarbeiter').update({ ist_aktiv: false }).eq('id', selectedMitarbeiter);
      if (error) throw error;
      // Also deactivate benutzer record
      const target = mitarbeiter.find(m => m.id === selectedMitarbeiter);
      if (target?.benutzer_id) {
        await supabase.from('benutzer').update({ status: 'rejected' as any }).eq('id', target.benutzer_id);
      }
      toast({ title: 'Erfolgreich', description: 'Mitarbeiter wurde deaktiviert.' });
      setDeactivateDialogOpen(false);
      setSelectedMitarbeiter(null);
      loadData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Fehler', description: error.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivateEmployee = async (mitarbeiterId: string) => {
    setActionLoading(mitarbeiterId);
    try {
      const { error } = await supabase.from('mitarbeiter').update({ ist_aktiv: true }).eq('id', mitarbeiterId);
      if (error) throw error;
      const target = mitarbeiter.find(m => m.id === mitarbeiterId);
      if (target?.benutzer_id) {
        await supabase.from('benutzer').update({ status: 'approved' as any }).eq('id', target.benutzer_id);
      }
      toast({ title: 'Erfolgreich', description: 'Mitarbeiter wurde reaktiviert.' });
      loadData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Fehler', description: error.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!selectedMitarbeiter) return;
    const targetMa = mitarbeiter.find(m => m.id === selectedMitarbeiter);
    if (targetMa && isProtectedUser(targetMa)) {
      toast({ variant: 'destructive', title: 'Geschützt', description: 'Dieser System-Account kann nicht gelöscht werden.' });
      setDeleteDialogOpen(false);
      return;
    }
    setActionLoading(selectedMitarbeiter);
    try {
      const { data, error } = await supabase.functions.invoke('delete-mitarbeiter', { body: { mitarbeiterId: selectedMitarbeiter } });
      if (error) {
        const errMsg = typeof data === 'object' && data?.error ? data.error : error.message;
        throw new Error(errMsg);
      }
      toast({ title: 'Erfolgreich', description: 'Mitarbeiter wurde endgültig gelöscht.' });
      setDeleteDialogOpen(false);
      setSelectedMitarbeiter(null);
      loadData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Fehler', description: error.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditMitarbeiter = (m: Mitarbeiter) => {
    setEditingMitarbeiter(m);
    setEditDialogOpen(true);
  };

  const handleSaveMitarbeiter = async () => {
    if (!editingMitarbeiter) return;
    setActionLoading(editingMitarbeiter.id);
    try {
      const { error } = await supabase.from('mitarbeiter').update({
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
      }).eq('id', editingMitarbeiter.id);
      if (error) throw error;
      toast({ title: 'Erfolgreich', description: 'Mitarbeiter-Daten wurden aktualisiert.' });
      setEditDialogOpen(false);
      setEditingMitarbeiter(null);
      loadData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Fehler', description: error.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenActivateDialog = (m: Mitarbeiter) => {
    setActivateTarget(m);
    setActivateEmail('');
    setActivateDialogOpen(true);
  };

  const handleActivateFromDialog = async () => {
    if (!activateTarget || !activateEmail) return;

    // Check if email already exists in benutzer table
    const { data: existingBenutzer } = await supabase
      .from('benutzer')
      .select('id, email')
      .eq('email', activateEmail.toLowerCase())
      .maybeSingle();

    if (existingBenutzer) {
      toast({
        variant: 'destructive',
        title: 'E-Mail bereits vergeben',
        description: `Die E-Mail-Adresse "${activateEmail}" ist bereits einem anderen Konto zugeordnet. Bitte verwenden Sie eine andere E-Mail.`,
      });
      return;
    }

    setActionLoading(activateTarget.id);
    try {
      const { data, error } = await supabase.functions.invoke('activate-mitarbeiter', {
        body: { email: activateEmail, mitarbeiter_id: activateTarget.id },
      });
      if (error) {
        const errMsg = typeof data === 'object' && data?.error ? data.error : error.message;
        throw new Error(errMsg);
      }
      toast({ title: 'Konto aktiviert', description: data?.message || 'Konto wurde erstellt und Passwort-E-Mail versendet.' });
      setActivateDialogOpen(false);
      setActivateTarget(null);
      setActivateEmail('');
      loadData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Fehler', description: error.message });
    } finally {
      setActionLoading(null);
    }
  };

  // Bulk activate is only available when each selected employee will be individually activated via dialog
  // Since bulk activate needs an email for each, we show a warning instead
  const handleBulkActivate = async () => {
    // Not used in new unified view
  };

  const handleChangeRole = async (mitarbeiterId: string, newRole: string) => {
    setActionLoading(mitarbeiterId);
    try {
      const { data: mitarbeiterData } = await supabase
        .from('mitarbeiter')
        .select('id, benutzer_id, vorname, nachname')
        .eq('id', mitarbeiterId)
        .maybeSingle();

      if (!mitarbeiterData) throw new Error('Mitarbeiter nicht gefunden.');

      let benutzerId = mitarbeiterData.benutzer_id;

      if (!benutzerId) {
        const { data: existingBenutzer } = await supabase
          .from('benutzer')
          .select('id')
          .eq('email', `pending-${mitarbeiterId}@placeholder.local`)
          .maybeSingle();

        if (existingBenutzer) {
          benutzerId = existingBenutzer.id;
        } else {
          const newId = crypto.randomUUID();
          const { error: createError } = await supabase.from('benutzer').insert({
            id: newId,
            email: `pending-${mitarbeiterId}@placeholder.local`,
            vorname: mitarbeiterData.vorname,
            nachname: mitarbeiterData.nachname,
            rolle: newRole as any,
            status: 'pending' as any,
          });
          if (createError) throw createError;
          await supabase.from('mitarbeiter').update({ benutzer_id: newId }).eq('id', mitarbeiterId);
          benutzerId = newId;
        }
      }

      const { data: existingRole } = await supabase.from('user_roles').select('id').eq('user_id', benutzerId).maybeSingle();

      if (existingRole) {
        const { error: updateError } = await supabase.from('user_roles').update({ role: newRole as any }).eq('user_id', benutzerId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('user_roles').insert({ user_id: benutzerId, role: newRole as any });
        if (insertError) throw insertError;
      }

      if (benutzerId) {
        await supabase.from('benutzer').update({ rolle: newRole as any }).eq('id', benutzerId);
      }

      const roleLabels: Record<string, string> = { globaladmin: 'Admin', geschaeftsfuehrer: 'Geschäftsführer', admin: 'Disponent', buchhaltung: 'Buchhaltung', mitarbeiter: 'Mitarbeiter' };
      toast({
        title: 'Rolle geändert',
        description: `Rolle wurde auf "${roleLabels[newRole] || newRole}" gesetzt.`,
      });
      loadData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Fehler', description: error.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateUserManual = async () => {
    if (!createUserForm.email || !createUserForm.password) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'E-Mail und Passwort sind erforderlich.' });
      return;
    }
    setCreateUserLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user-manual', {
        body: {
          email: createUserForm.email,
          password: createUserForm.password,
          vorname: createUserForm.vorname,
          nachname: createUserForm.nachname,
          rolle: createUserForm.rolle,
        },
      });
      if (error) {
        const errMsg = typeof data === 'object' && data?.error ? data.error : error.message;
        throw new Error(errMsg);
      }
      toast({ title: 'Erfolgreich', description: data?.message || 'Benutzer erstellt.' });
      setCreateUserDialogOpen(false);
      setCreateUserForm({ email: '', password: '', vorname: '', nachname: '', rolle: 'geschaeftsfuehrer' });
      loadData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Fehler', description: error.message });
    } finally {
      setCreateUserLoading(false);
    }
  };

  const toggleUninvitedSelection = (id: string) => {};
  const toggleAllUninvited = () => {};

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const roleLabelMap: Record<string, string> = {
    globaladmin: 'Admin',
    geschaeftsfuehrer: 'Geschäftsführer',
    admin: 'Disponent',
    buchhaltung: 'Buchhaltung',
    mitarbeiter: 'Mitarbeiter',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Team-Verwaltung</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mitarbeiter einpflegen, Rollen zuweisen und Zugänge erstellen
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isGeschaeftsfuehrer && (
            <Button variant="outline" size="sm" onClick={() => setCreateUserDialogOpen(true)} className="gap-2">
              <KeyRound className="h-4 w-4" />
              Benutzer erstellen
            </Button>
          )}
          <Button size="sm" onClick={() => setImportDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Mitarbeiter anlegen
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Team durchsuchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Section: Alle aktiven Mitarbeiter */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Mitarbeiter</CardTitle>
            <Badge variant="secondary">{filteredAllActive.length}</Badge>
          </div>
          <CardDescription>
            Alle aktiven Mitarbeiter – mit und ohne Systemzugang
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredAllActive.length > 0 ? (
            <div className="space-y-2">
              {filteredAllActive.map((m) => {
                const hasRealAccount = m.benutzer_id && !m.benutzer?.email?.includes('@placeholder.local');
                return (
                  <EmployeeRow
                    key={m.id}
                    mitarbeiter={m}
                    hasAccount={!!hasRealAccount}
                    actionLoading={actionLoading}
                    onEdit={handleEditMitarbeiter}
                    onActivate={handleOpenActivateDialog}
                    onDeactivate={(id) => { setSelectedMitarbeiter(id); setDeactivateDialogOpen(true); }}
                    onDelete={(id) => { setSelectedMitarbeiter(id); setDeleteDialogOpen(true); }}
                    isProtected={isProtectedUser(m)}
                    loadData={loadData}
                    currentRole={m.benutzer_id ? (userRolesMap[m.benutzer_id] as UserRole) || null : null}
                    onChangeRole={handleChangeRole}
                    canAssignGF={isGeschaeftsfuehrer}
                    canAssignRoles={isGeschaeftsfuehrer}
                    canDelete={isGeschaeftsfuehrer}
                    roleLabelMap={roleLabelMap}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{searchQuery ? 'Keine Mitarbeiter gefunden' : 'Noch keine Mitarbeiter angelegt'}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section: Deaktivierte Mitarbeiter (collapsed) */}
      {(filteredDeactivated.length > 0 || deactivatedMitarbeiter.length > 0) && (
        <Collapsible open={deactivatedSectionOpen} onOpenChange={setDeactivatedSectionOpen}>
          <Card className="border-muted-foreground/20">
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2">
                  {deactivatedSectionOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <UserX className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg text-muted-foreground">Deaktivierte Mitarbeiter</CardTitle>
                  <Badge variant="outline">{deactivatedMitarbeiter.length}</Badge>
                </div>
                <CardDescription>
                  Diese Mitarbeiter sind deaktiviert und können hier reaktiviert oder endgültig gelöscht werden.
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {filteredDeactivated.length > 0 ? (
                  <div className="space-y-2">
                    {filteredDeactivated.map((m) => (
                      <DeactivatedRow
                        key={m.id}
                        mitarbeiter={m}
                        actionLoading={actionLoading}
                        onReactivate={handleReactivateEmployee}
                        onDelete={(id) => { setSelectedMitarbeiter(id); setDeleteDialogOpen(true); }}
                        isProtected={isProtectedUser(m)}
                        loadData={loadData}
                        currentRole={m.benutzer_id ? (userRolesMap[m.benutzer_id] as UserRole) || 'mitarbeiter' : 'mitarbeiter'}
                        canDelete={isGeschaeftsfuehrer}
                        roleLabelMap={roleLabelMap}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Keine deaktivierten Mitarbeiter gefunden.</p>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Add/Import Mitarbeiter Dialog */}
      <AddMitarbeiterDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} onSuccess={loadData} />

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5" />
              Mitarbeiter deaktivieren
            </AlertDialogTitle>
            <AlertDialogDescription>
              Der Mitarbeiter wird deaktiviert und kann sich nicht mehr anmelden.
              Die Daten bleiben erhalten. Sie können den Mitarbeiter später reaktivieren oder endgültig löschen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivateEmployee} disabled={actionLoading === selectedMitarbeiter}>
              {actionLoading === selectedMitarbeiter && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <UserX className="h-4 w-4 mr-1" />
              Deaktivieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog (permanent) */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Mitarbeiter endgültig löschen
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher? Der Mitarbeiter und alle zugehörigen Daten (Verfügbarkeiten, Abwesenheiten, Zugang) werden unwiderruflich gelöscht.
              Bestehende Termine bleiben erhalten, werden aber als „nicht zugewiesen" markiert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEmployee} className="bg-destructive text-destructive-foreground" disabled={actionLoading === selectedMitarbeiter}>
              {actionLoading === selectedMitarbeiter && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Trash2 className="h-4 w-4 mr-1" />
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activate Dialog */}
      <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Konto aktivieren
            </DialogTitle>
            <DialogDescription>
              {activateTarget
                ? `Erstellt ein Benutzerkonto für ${activateTarget.vorname || ''} ${activateTarget.nachname || ''}. Der Mitarbeiter erhält eine E-Mail mit einem Link zum Passwort-Setzen. Beim ersten Login wird er aufgefordert, sein eigenes Passwort zu vergeben.`
                : 'Erstellt ein Benutzerkonto für den Mitarbeiter.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="activate-email">E-Mail-Adresse *</Label>
              <Input
                id="activate-email"
                type="email"
                value={activateEmail}
                onChange={(e) => setActivateEmail(e.target.value)}
                placeholder="mitarbeiter@beispiel.de"
                onKeyDown={(e) => { if (e.key === 'Enter' && activateEmail) handleActivateFromDialog(); }}
              />
            </div>
            <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Was passiert:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Ein Benutzerkonto wird erstellt</li>
                <li>Eine E-Mail mit Passwort-Link wird versendet</li>
                <li>Der Mitarbeiter setzt sein Passwort über den Link</li>
                <li>Ab dann kann er sich im System anmelden</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleActivateFromDialog} disabled={!activateEmail || actionLoading === activateTarget?.id} className="gap-2">
              {actionLoading === activateTarget?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="h-4 w-4" />
              Konto aktivieren & E-Mail senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mitarbeiter bearbeiten</DialogTitle>
            <DialogDescription>Stammdaten des Mitarbeiters anpassen</DialogDescription>
          </DialogHeader>
          {editingMitarbeiter && (
            <div className="grid gap-4 py-4">
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
                  <p className="text-sm text-muted-foreground mt-2">Hover für Upload-Optionen</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vorname</Label>
                  <Input value={editingMitarbeiter.vorname || ''} onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, vorname: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Nachname</Label>
                  <Input value={editingMitarbeiter.nachname || ''} onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, nachname: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input value={editingMitarbeiter.telefon || ''} onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, telefon: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Straße</Label>
                  <Input value={editingMitarbeiter.strasse || ''} onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, strasse: e.target.value })} placeholder="Straße und Hausnummer" />
                </div>
                <div className="space-y-2">
                  <Label>PLZ</Label>
                  <Input value={editingMitarbeiter.plz || ''} onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, plz: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Stadt</Label>
                  <Input value={editingMitarbeiter.stadt || ''} onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, stadt: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kalenderfarbe</Label>
                  <Input type="color" value={editingMitarbeiter.farbe_kalender || '#3B82F6'} onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, farbe_kalender: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Standort</Label>
                  <Select value={editingMitarbeiter.standort || 'Hannover'} onValueChange={(v: 'Hannover') => setEditingMitarbeiter({ ...editingMitarbeiter, standort: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Hannover">Hannover</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Zuständigkeitsbereich</Label>
                <Input value={editingMitarbeiter.zustaendigkeitsbereich || ''} onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, zustaendigkeitsbereich: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Soll-Wochenstunden</Label>
                  <Input type="number" min="0" step="0.5" value={editingMitarbeiter.soll_wochenstunden || ''} onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, soll_wochenstunden: e.target.value ? parseFloat(e.target.value) : null })} />
                </div>
                <div className="space-y-2">
                  <Label>Max. Termine pro Tag</Label>
                  <Input type="number" min="0" value={editingMitarbeiter.max_termine_pro_tag || ''} onChange={(e) => setEditingMitarbeiter({ ...editingMitarbeiter, max_termine_pro_tag: e.target.value ? parseInt(e.target.value) : null })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSaveMitarbeiter} disabled={actionLoading === editingMitarbeiter?.id}>
              {actionLoading === editingMitarbeiter?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Manual Dialog */}
      <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
        <DialogContent className="z-[201] overflow-visible">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Benutzer manuell erstellen
            </DialogTitle>
            <DialogDescription>
              Erstellt sofort ein vollständiges Konto mit E-Mail und Passwort.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vorname</Label>
                <Input value={createUserForm.vorname} onChange={(e) => setCreateUserForm({ ...createUserForm, vorname: e.target.value })} placeholder="Max" />
              </div>
              <div className="space-y-2">
                <Label>Nachname</Label>
                <Input value={createUserForm.nachname} onChange={(e) => setCreateUserForm({ ...createUserForm, nachname: e.target.value })} placeholder="Mustermann" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>E-Mail-Adresse *</Label>
              <Input type="email" value={createUserForm.email} onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })} placeholder="benutzer@beispiel.de" />
            </div>
            <div className="space-y-2">
              <Label>Passwort *</Label>
              <Input type="text" value={createUserForm.password} onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })} placeholder="Mindestens 6 Zeichen" />
            </div>
            <div className="space-y-2">
              <Label>Rolle</Label>
              <Select value={createUserForm.rolle} onValueChange={(v) => setCreateUserForm({ ...createUserForm, rolle: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-[300] bg-popover">
                  {isGeschaeftsfuehrer && <SelectItem value="geschaeftsfuehrer">Geschäftsführer</SelectItem>}
                  <SelectItem value="admin">Disponent</SelectItem>
                  <SelectItem value="buchhaltung">Buchhaltung</SelectItem>
                  <SelectItem value="mitarbeiter">Mitarbeiter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateUserDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreateUserManual} disabled={createUserLoading}>
              {createUserLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Benutzer erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Unified Employee Row ───
function EmployeeRow({
  mitarbeiter: m, hasAccount, actionLoading, onEdit, onActivate, onDeactivate, onDelete,
  isProtected, loadData, currentRole, onChangeRole, canAssignGF, canAssignRoles, canDelete, roleLabelMap,
}: {
  mitarbeiter: Mitarbeiter; hasAccount: boolean; actionLoading: string | null;
  onEdit: (m: Mitarbeiter) => void; onActivate: (m: Mitarbeiter) => void;
  onDeactivate: (id: string) => void; onDelete: (id: string) => void;
  isProtected?: boolean; loadData: () => void;
  currentRole: UserRole | null; onChangeRole: (id: string, role: string) => void;
  canAssignGF: boolean; canAssignRoles: boolean; canDelete: boolean; roleLabelMap: Record<string, string>;
}) {
  const fullName = `${m.vorname || ''} ${m.nachname || ''}`.trim() || 'Unbekannt';
  const isGlobalAdminUser = currentRole === 'globaladmin';

  const roleBadgeVariant = (role: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (role) {
      case 'globaladmin': return 'destructive';
      case 'geschaeftsfuehrer': return 'default';
      case 'admin': return 'default';
      case 'buchhaltung': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <AvatarUpload
          mitarbeiterId={m.id}
          currentAvatarUrl={m.avatar_url}
          name={fullName}
          color={m.farbe_kalender || '#3B82F6'}
          size="md"
          onUploadComplete={loadData}
          onRemove={loadData}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{fullName}</p>
            {hasAccount ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-300 text-green-700 dark:border-green-700 dark:text-green-400 gap-1 shrink-0">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Registriert
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 gap-1 shrink-0">
                <UserX className="h-2.5 w-2.5" />
                Kein Zugang
              </Badge>
            )}
          </div>
          {hasAccount && m.benutzer?.email && (
            <p className="text-xs text-muted-foreground truncate">{m.benutzer.email}</p>
          )}
          {m.telefon && <p className="text-xs text-muted-foreground">{m.telefon}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap pl-11 sm:pl-0">
        {isGlobalAdminUser ? (
          <Badge variant="destructive">
            <Shield className="h-3 w-3 mr-1" />
            Admin (geschützt)
          </Badge>
        ) : canAssignRoles ? (
          <Select
            value={currentRole || 'mitarbeiter'}
            onValueChange={(v) => onChangeRole(m.id, v)}
            disabled={actionLoading === m.id}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <div className="flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {canAssignGF && <SelectItem value="geschaeftsfuehrer">Geschäftsführer</SelectItem>}
              <SelectItem value="admin">Disponent</SelectItem>
              <SelectItem value="buchhaltung">Buchhaltung</SelectItem>
              <SelectItem value="mitarbeiter">Mitarbeiter</SelectItem>
            </SelectContent>
          </Select>
        ) : currentRole ? (
          <Badge variant={roleBadgeVariant(currentRole)}>
            <Shield className="h-3 w-3 mr-1" />
            {roleLabelMap[currentRole] || currentRole}
          </Badge>
        ) : null}

        {!hasAccount && (
          <Button variant="outline" size="sm" onClick={() => onActivate(m)} disabled={actionLoading === m.id} className="gap-1.5 text-xs">
            {actionLoading === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            Aktivieren
          </Button>
        )}

        {!isGlobalAdminUser && (
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onEdit(m)} disabled={actionLoading === m.id}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}

        {hasAccount && !isGlobalAdminUser && !isProtected && (
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onDeactivate(m.id)} disabled={actionLoading === m.id} title="Mitarbeiter deaktivieren">
            {actionLoading === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
          </Button>
        )}

        {!hasAccount && canDelete && !isProtected && (
          <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(m.id)} disabled={actionLoading === m.id} title="Mitarbeiter löschen">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Deactivated Employee Row ───
function DeactivatedRow({
  mitarbeiter: m, actionLoading, onReactivate, onDelete, isProtected, loadData,
  currentRole, canDelete, roleLabelMap,
}: {
  mitarbeiter: Mitarbeiter; actionLoading: string | null;
  onReactivate: (id: string) => void; onDelete: (id: string) => void;
  isProtected?: boolean; loadData: () => void;
  currentRole: UserRole | null; canDelete: boolean; roleLabelMap: Record<string, string>;
}) {
  const fullName = `${m.vorname || ''} ${m.nachname || ''}`.trim() || 'Unbekannt';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border rounded-lg opacity-60 hover:opacity-80 transition-all">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <AvatarUpload
          mitarbeiterId={m.id}
          currentAvatarUrl={m.avatar_url}
          name={fullName}
          color={m.farbe_kalender || '#3B82F6'}
          size="md"
          onUploadComplete={loadData}
          onRemove={loadData}
        />
        <div className="min-w-0">
          <p className="font-medium truncate">{fullName}</p>
          <p className="text-xs text-muted-foreground truncate">{m.benutzer?.email || 'Keine E-Mail'}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap pl-11 sm:pl-0">
        {currentRole && (
          <Badge variant="outline">
            <Shield className="h-3 w-3 mr-1" />
            {roleLabelMap[currentRole] || currentRole}
          </Badge>
        )}
        <Badge variant="secondary">Deaktiviert</Badge>
        <Button variant="default" size="sm" onClick={() => onReactivate(m.id)} disabled={actionLoading === m.id} className="gap-1.5 text-xs" title="Mitarbeiter reaktivieren">
          {actionLoading === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
          Reaktivieren
        </Button>
        {canDelete && !isProtected && (
          <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(m.id)} disabled={actionLoading === m.id} title="Endgültig löschen">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Add/Import Mitarbeiter Dialog ───
interface ManualRow {
  vorname: string;
  nachname: string;
  telefon: string;
  strasse: string;
  plz: string;
  stadt: string;
}

const emptyRow = (): ManualRow => ({ vorname: '', nachname: '', telefon: '', strasse: '', plz: '', stadt: '' });

function AddMitarbeiterDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (o: boolean) => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<string>('manual');
  const [rows, setRows] = useState<ManualRow[]>([emptyRow()]);
  const [aiText, setAiText] = useState('');
  const [aiParsed, setAiParsed] = useState<ManualRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [aiStep, setAiStep] = useState<'input' | 'preview'>('input');

  const handleClose = () => {
    setRows([emptyRow()]);
    setAiText('');
    setAiParsed([]);
    setAiStep('input');
    onOpenChange(false);
  };

  const updateRow = (index: number, field: keyof ManualRow, value: string) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const addRow = () => setRows(prev => [...prev, emptyRow()]);

  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleManualImport = async () => {
    const valid = rows.filter(r => r.vorname.trim() && r.nachname.trim());
    if (!valid.length) {
      toast({ title: 'Fehler', description: 'Mindestens ein Mitarbeiter mit Vor- und Nachname ist erforderlich.', variant: 'destructive' });
      return;
    }
    setIsImporting(true);
    let success = 0, failed = 0;
    for (const r of valid) {
      try {
        const { error } = await supabase.from('mitarbeiter').insert({
          vorname: r.vorname.trim(),
          nachname: r.nachname.trim(),
          telefon: r.telefon.trim() || null,
          strasse: r.strasse.trim() || null,
          plz: r.plz.trim() || null,
          stadt: r.stadt.trim() || null,
          ist_aktiv: true,
        });
        if (error) throw error;
        success++;
      } catch { failed++; }
    }
    toast({
      title: failed ? 'Teilweiser Import' : 'Erfolgreich',
      description: `${success} Mitarbeiter angelegt${failed ? `, ${failed} fehlgeschlagen` : ''}`,
      variant: failed ? 'destructive' : 'default',
    });
    onSuccess();
    handleClose();
  };

  const handleAiParse = async () => {
    if (!aiText.trim()) return;
    setIsParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-mitarbeiter-text', { body: { text: aiText } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.mitarbeiter?.length) {
        toast({ title: 'Keine Mitarbeiter erkannt', description: 'Die KI konnte keine Mitarbeiter aus dem Text extrahieren.', variant: 'destructive' });
        return;
      }
      setAiParsed(data.mitarbeiter.map((m: any) => ({
        vorname: m.vorname || '',
        nachname: m.nachname || '',
        telefon: m.telefon || '',
        strasse: m.strasse || '',
        plz: m.plz || '',
        stadt: m.stadt || '',
      })));
      setAiStep('preview');
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    } finally {
      setIsParsing(false);
    }
  };

  const handleAiImport = async () => {
    const valid = aiParsed.filter(r => r.vorname.trim() && r.nachname.trim());
    if (!valid.length) {
      toast({ title: 'Fehler', description: 'Keine gültigen Einträge.', variant: 'destructive' });
      return;
    }
    setIsImporting(true);
    let success = 0, failed = 0;
    for (const r of valid) {
      try {
        const { error } = await supabase.from('mitarbeiter').insert({
          vorname: r.vorname.trim(),
          nachname: r.nachname.trim(),
          telefon: r.telefon.trim() || null,
          strasse: r.strasse.trim() || null,
          plz: r.plz.trim() || null,
          stadt: r.stadt.trim() || null,
          ist_aktiv: true,
        });
        if (error) throw error;
        success++;
      } catch { failed++; }
    }
    toast({
      title: failed ? 'Teilweiser Import' : 'Erfolgreich',
      description: `${success} Mitarbeiter angelegt${failed ? `, ${failed} fehlgeschlagen` : ''}`,
      variant: failed ? 'destructive' : 'default',
    });
    onSuccess();
    handleClose();
  };

  const validManualCount = rows.filter(r => r.vorname.trim() && r.nachname.trim()).length;
  const validAiCount = aiParsed.filter(r => r.vorname.trim() && r.nachname.trim()).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Mitarbeiter anlegen
          </DialogTitle>
          <DialogDescription>
            Mitarbeiter direkt in der Tabelle anlegen oder per KI aus Freitext importieren.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual" className="gap-2">
              <Plus className="h-4 w-4" />
              Direkt anlegen
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Sparkles className="h-4 w-4" />
              KI-Import
            </TabsTrigger>
          </TabsList>

          {/* Manual Table Entry */}
          <TabsContent value="manual" className="flex-1 min-h-0 flex flex-col gap-4 mt-4">
            <div className="flex-1 overflow-auto min-h-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-1 font-medium">Vorname *</th>
                    <th className="text-left py-2 px-1 font-medium">Nachname *</th>
                    <th className="text-left py-2 px-1 font-medium">Telefon</th>
                    <th className="text-left py-2 px-1 font-medium">Straße</th>
                    <th className="text-left py-2 px-1 font-medium">PLZ</th>
                    <th className="text-left py-2 px-1 font-medium">Stadt</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1 px-1">
                        <Input
                          value={row.vorname}
                          onChange={(e) => updateRow(i, 'vorname', e.target.value)}
                          placeholder="Vorname"
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="py-1 px-1">
                        <Input
                          value={row.nachname}
                          onChange={(e) => updateRow(i, 'nachname', e.target.value)}
                          placeholder="Nachname"
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="py-1 px-1">
                        <Input
                          value={row.telefon}
                          onChange={(e) => updateRow(i, 'telefon', e.target.value)}
                          placeholder="Telefon"
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="py-1 px-1">
                        <Input
                          value={row.strasse}
                          onChange={(e) => updateRow(i, 'strasse', e.target.value)}
                          placeholder="Straße"
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="py-1 px-1">
                        <Input
                          value={row.plz}
                          onChange={(e) => updateRow(i, 'plz', e.target.value)}
                          placeholder="PLZ"
                          className="h-8 text-sm w-20"
                        />
                      </td>
                      <td className="py-1 px-1">
                        <Input
                          value={row.stadt}
                          onChange={(e) => updateRow(i, 'stadt', e.target.value)}
                          placeholder="Stadt"
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="py-1 px-1">
                        {rows.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRow(i)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="outline" size="sm" onClick={addRow} className="gap-2 self-start">
              <Plus className="h-4 w-4" />
              Zeile hinzufügen
            </Button>
            <Button onClick={handleManualImport} disabled={isImporting || validManualCount === 0} className="w-full">
              {isImporting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Wird angelegt...</>
              ) : (
                <><UserPlus className="h-4 w-4 mr-2" /> {validManualCount} Mitarbeiter anlegen</>
              )}
            </Button>
          </TabsContent>

          {/* AI Text Import */}
          <TabsContent value="ai" className="flex-1 min-h-0 flex flex-col gap-4 mt-4">
            {aiStep === 'input' && (
              <>
                <Textarea
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  placeholder={`Beispiele:\n\nAnna Schmidt, Tel: 0511-12345, 30 Std/Woche\nMarkus Weber, Musterstr. 5, 30159 Hannover\n\nOder als Tabelle:\nVorname;Nachname;Telefon\nLisa;Müller;0511-99999`}
                  className="flex-1 min-h-[200px] font-mono text-sm"
                />
                <Button onClick={handleAiParse} disabled={!aiText.trim() || isParsing} className="w-full">
                  {isParsing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> KI analysiert...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Mit KI analysieren</>
                  )}
                </Button>
              </>
            )}
            {aiStep === 'preview' && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{aiParsed.length} Mitarbeiter erkannt</p>
                  <Button variant="ghost" size="sm" onClick={() => setAiStep('input')}>Zurück zum Text</Button>
                </div>
                <div className="flex-1 overflow-auto space-y-2 min-h-0">
                  {aiParsed.map((m, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{m.vorname} {m.nachname}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {m.telefon && `Tel: ${m.telefon}`}
                        </div>
                        {(m.strasse || m.stadt) && (
                          <div className="text-xs text-muted-foreground truncate">
                            {[m.strasse, m.plz, m.stadt].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 ml-2" onClick={() => setAiParsed(prev => prev.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button onClick={handleAiImport} disabled={isImporting || validAiCount === 0} className="w-full">
                  {isImporting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Wird angelegt...</>
                  ) : (
                    <><UserPlus className="h-4 w-4 mr-2" /> {validAiCount} Mitarbeiter anlegen</>
                  )}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
