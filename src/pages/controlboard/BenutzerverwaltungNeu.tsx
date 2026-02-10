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
import { Loader2, CheckCircle, XCircle, Clock, UserPlus, Trash2, UserX, UserCheck, Pencil, Mail, Users, Search, Upload, Send, MailCheck, Shield, KeyRound, Lock, Unlock } from 'lucide-react';
import { AvatarUpload } from '@/components/mitarbeiter/AvatarUpload';
import { MitarbeiterImport } from '@/components/import/MitarbeiterImport';
import { Checkbox } from '@/components/ui/checkbox';
import { useUserRole, type UserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';

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
  benutzer_id: string | null;
  benutzer?: {
    email: string;
  };
}

interface UserRoleEntry {
  user_id: string;
  role: string;
}

export default function BenutzerverwaltungNeu() {
  const [pendingBenutzer, setPendingBenutzer] = useState<PendingRegistration[]>([]);
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [userRolesMap, setUserRolesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
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
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ email: '', password: '', vorname: '', nachname: '', rolle: 'geschaeftsfuehrer' });
  const [createUserLoading, setCreateUserLoading] = useState(false);
  
  // Multi-select states
  const [selectedUninvited, setSelectedUninvited] = useState<Set<string>>(new Set());
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());

  const { toast } = useToast();
  const { isGeschaeftsfuehrer, isAdmin } = useUserRole();
  const { user } = useAuth();
  
  // Masteradmin state
  const isMasterEmail = user?.email === 'info@kitdienstleistungen.de';
  const [masterUnlocked, setMasterUnlocked] = useState(false);
  const [masterPasswordDialog, setMasterPasswordDialog] = useState(false);
  const [masterPasswordInput, setMasterPasswordInput] = useState('');
  const [masterPasswordLoading, setMasterPasswordLoading] = useState(false);

  const handleVerifyMasterPassword = async () => {
    setMasterPasswordLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-master-password', {
        body: { password: masterPasswordInput },
      });
      if (error) throw error;
      if (data?.valid) {
        setMasterUnlocked(true);
        setMasterPasswordDialog(false);
        setMasterPasswordInput('');
        toast({ title: 'Masteradmin freigeschaltet', description: 'Sie haben jetzt vollen Zugriff auf die Rollenverwaltung.' });
      } else {
        toast({ variant: 'destructive', title: 'Falsches Passwort', description: 'Das eingegebene Passwort ist nicht korrekt.' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Fehler', description: error.message });
    } finally {
      setMasterPasswordLoading(false);
    }
  };

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
      const [registrationsResponse, mitarbeiterResponse, rolesResponse] = await Promise.all([
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
          .order('nachname', { ascending: true }),
        supabase
          .from('user_roles')
          .select('user_id, role')
      ]);

      if (registrationsResponse.error) throw registrationsResponse.error;
      if (mitarbeiterResponse.error) throw mitarbeiterResponse.error;

      setPendingBenutzer(registrationsResponse.data || []);
      setMitarbeiter(mitarbeiterResponse.data || []);
      
      // Build a map: user_id -> highest role
      const rolesMap: Record<string, string> = {};
      if (rolesResponse.data) {
        for (const entry of rolesResponse.data) {
          const current = rolesMap[entry.user_id];
          const priority: Record<string, number> = { geschaeftsfuehrer: 3, admin: 2, mitarbeiter: 1 };
          if (!current || (priority[entry.role] || 0) > (priority[current] || 0)) {
            rolesMap[entry.user_id] = entry.role;
          }
        }
      }
      setUserRolesMap(rolesMap);
      
      // Clear selections that no longer exist
      setSelectedUninvited(prev => {
        const newSet = new Set<string>();
        prev.forEach(id => {
          if (mitarbeiterResponse.data?.some(m => m.id === id && !m.benutzer_id)) {
            newSet.add(id);
          }
        });
        return newSet;
      });
      setSelectedPending(prev => {
        const newSet = new Set<string>();
        prev.forEach(id => {
          if (registrationsResponse.data?.some(r => r.id === id)) {
            newSet.add(id);
          }
        });
        return newSet;
      });
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

  // Get employees without active auth account (no benutzer_id or placeholder)
  const uninvitedMitarbeiter = mitarbeiter.filter(m => 
    !m.benutzer_id || m.benutzer?.email?.includes('@placeholder.local')
  );

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

  const handleBulkApprove = async () => {
    if (selectedPending.size === 0) return;
    
    setBulkActionLoading(true);
    const toApprove = pendingBenutzer.filter(p => selectedPending.has(p.id));
    let successCount = 0;
    let errorCount = 0;

    for (const registration of toApprove) {
      try {
        const { data, error } = await supabase.functions.invoke('approve-benutzer', {
          body: {
            registration_id: registration.id,
            email: registration.email,
            vorname: registration.vorname,
            nachname: registration.nachname
          },
        });

        if (error) throw error;
        successCount++;
      } catch (error: any) {
        console.error('Error approving:', error);
        errorCount++;
      }
    }

    toast({
      title: 'Massenfreigabe abgeschlossen',
      description: `${successCount} genehmigt, ${errorCount} fehlgeschlagen`,
      variant: errorCount > 0 ? 'destructive' : 'default',
    });

    setSelectedPending(new Set());
    loadData();
    setBulkActionLoading(false);
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
      const { data, error } = await supabase.functions.invoke('activate-mitarbeiter', {
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

  // Bulk activate uninvited employees
  const handleBulkActivate = async () => {
    if (selectedUninvited.size === 0) return;
    
    setBulkActionLoading(true);
    const toActivate = uninvitedMitarbeiter.filter(m => selectedUninvited.has(m.id));
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const m of toActivate) {
      try {
        if (!m.benutzer?.email || m.benutzer.email.includes('@placeholder.local')) {
          errors.push(`${m.vorname} ${m.nachname}: Keine E-Mail-Adresse`);
          errorCount++;
          continue;
        }

        const { data, error } = await supabase.functions.invoke('activate-mitarbeiter', {
          body: {
            email: m.benutzer.email,
            mitarbeiter_id: m.id
          },
        });

        if (error) throw error;
        successCount++;
      } catch (error: any) {
        console.error('Error activating:', error);
        errors.push(`${m.vorname} ${m.nachname}: ${error.message}`);
        errorCount++;
      }
    }

    if (errorCount > 0 && errors.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Aktivierung teilweise fehlgeschlagen',
        description: `${successCount} erfolgreich, ${errorCount} fehlgeschlagen. ${errors.slice(0, 3).join('; ')}`,
      });
    } else {
      toast({
        title: 'Konten aktiviert',
        description: `${successCount} Konten erfolgreich aktiviert. Passwort-E-Mails versendet.`,
      });
    }

    setSelectedUninvited(new Set());
    loadData();
    setBulkActionLoading(false);
  };

  // Single activate for uninvited employee
  const handleActivateEmployee = async (m: Mitarbeiter, email: string) => {
    setActionLoading(m.id);
    try {
      const { data, error } = await supabase.functions.invoke('activate-mitarbeiter', {
        body: {
          email: email,
          mitarbeiter_id: m.id
        },
      });

      if (error) {
        const serverMsg = (data as any)?.error || (typeof data === 'string' ? data : null);
        throw new Error(serverMsg || error.message);
      }

      toast({
        title: 'Konto aktiviert',
        description: data?.message || 'Konto wurde erstellt und Passwort-E-Mail versendet.',
      });

      loadData();
    } catch (error: any) {
      console.error('Error activating:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error.message || 'Aktivierung fehlgeschlagen.',
      });
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
        const serverMsg = (data as any)?.error || (typeof data === 'string' ? data : null);
        throw new Error(serverMsg || error.message);
      }
      toast({ title: 'Erfolgreich', description: data?.message || 'Benutzer erstellt.' });
      setCreateUserDialogOpen(false);
      setCreateUserForm({ email: '', password: '', vorname: '', nachname: '', rolle: 'geschaeftsfuehrer' });
      loadData();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({ variant: 'destructive', title: 'Fehler', description: error.message || 'Erstellung fehlgeschlagen.' });
    } finally {
      setCreateUserLoading(false);
    }
  };

  const handleChangeRole = async (mitarbeiterId: string, newRole: string) => {
    setActionLoading(mitarbeiterId);
    try {
      // Find the mitarbeiter to get benutzer_id
      const { data: mitarbeiterData } = await supabase
        .from('mitarbeiter')
        .select('id, benutzer_id, vorname, nachname')
        .eq('id', mitarbeiterId)
        .maybeSingle();

      if (!mitarbeiterData) throw new Error('Mitarbeiter nicht gefunden.');

      let benutzerId = mitarbeiterData.benutzer_id;

      // If no benutzer record exists, create one for role pre-assignment
      if (!benutzerId) {
        // Check if benutzer with matching email exists
        const { data: existingBenutzer } = await supabase
          .from('benutzer')
          .select('id')
          .eq('email', `pending-${mitarbeiterId}@placeholder.local`)
          .maybeSingle();

        if (existingBenutzer) {
          benutzerId = existingBenutzer.id;
        } else {
          // Create a placeholder benutzer record
          const newId = crypto.randomUUID();
          const { error: createError } = await supabase
            .from('benutzer')
            .insert({
              id: newId,
              email: `pending-${mitarbeiterId}@placeholder.local`,
              vorname: mitarbeiterData.vorname,
              nachname: mitarbeiterData.nachname,
              rolle: newRole as any,
              status: 'pending' as any,
            });

          if (createError) throw createError;

          // Link mitarbeiter to the new benutzer
          await supabase
            .from('mitarbeiter')
            .update({ benutzer_id: newId })
            .eq('id', mitarbeiterId);

          benutzerId = newId;
        }
      }

      // Check if user already has a role entry
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', benutzerId)
        .maybeSingle();

      if (existingRole) {
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({ role: newRole as any })
          .eq('user_id', benutzerId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({ user_id: benutzerId, role: newRole as any });
        if (insertError) throw insertError;
      }

      // Also update benutzer.rolle for consistency
      if (benutzerId) {
        await supabase
          .from('benutzer')
          .update({ rolle: newRole as any })
          .eq('id', benutzerId);
      }

      toast({
        title: 'Rolle geändert',
        description: `Rolle wurde auf "${newRole === 'geschaeftsfuehrer' ? 'Geschäftsführer' : newRole === 'admin' ? 'Manager' : 'Mitarbeiter'}" gesetzt.`,
      });

      loadData();
    } catch (error: any) {
      console.error('Error changing role:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error.message || 'Rollenänderung fehlgeschlagen.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredMitarbeiter = mitarbeiter.filter(m => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${m.vorname || ''} ${m.nachname || ''}`.toLowerCase();
    const email = m.benutzer?.email?.toLowerCase() || '';
    return fullName.includes(query) || email.includes(query);
  });

  // Show employees with real auth accounts in the main list
  const invitedMitarbeiter = filteredMitarbeiter.filter(m => 
    m.benutzer_id && !m.benutzer?.email?.includes('@placeholder.local')
  );
  const activeMitarbeiter = invitedMitarbeiter.filter(m => m.ist_aktiv);
  const inactiveMitarbeiter = invitedMitarbeiter.filter(m => !m.ist_aktiv);

  // Toggle selection helpers
  const toggleUninvitedSelection = (id: string) => {
    setSelectedUninvited(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleAllUninvited = () => {
    if (selectedUninvited.size === uninvitedMitarbeiter.length) {
      setSelectedUninvited(new Set());
    } else {
      setSelectedUninvited(new Set(uninvitedMitarbeiter.map(m => m.id)));
    }
  };

  const togglePendingSelection = (id: string) => {
    setSelectedPending(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleAllPending = () => {
    if (selectedPending.size === pendingBenutzer.length) {
      setSelectedPending(new Set());
    } else {
      setSelectedPending(new Set(pendingBenutzer.map(p => p.id)));
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
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Benutzerverwaltung</h1>
          <p className="text-muted-foreground">Mitarbeiter verwalten und neue einladen</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Masteradmin Toggle */}
          {isMasterEmail && (
            <Button
              variant={masterUnlocked ? 'default' : 'outline'}
              onClick={() => {
                if (masterUnlocked) {
                  setMasterUnlocked(false);
                } else {
                  setMasterPasswordDialog(true);
                }
              }}
              className="gap-2"
            >
              {masterUnlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              {masterUnlocked ? 'Masteradmin aktiv' : 'Masteradmin'}
            </Button>
          )}
          {masterUnlocked && (
            <Button variant="outline" onClick={() => setCreateUserDialogOpen(true)} className="gap-2">
              <KeyRound className="h-4 w-4" />
              Benutzer erstellen
            </Button>
          )}
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

      {/* Uninvited Employees Section */}
      {uninvitedMitarbeiter.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-xl">Noch nicht aktiviert</CardTitle>
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                  {uninvitedMitarbeiter.length}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAllUninvited}
                  className="gap-2"
                >
                  {selectedUninvited.size === uninvitedMitarbeiter.length ? 'Keine' : 'Alle'} auswählen
                </Button>
                <Button
                  onClick={handleBulkActivate}
                  disabled={selectedUninvited.size === 0 || bulkActionLoading}
                  className="gap-2"
                >
                  {bulkActionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {selectedUninvited.size > 0 ? `${selectedUninvited.size} aktivieren` : 'Ausgewählte aktivieren'}
                </Button>
              </div>
            </div>
            <CardDescription>
              Diese Mitarbeiter wurden angelegt, haben aber noch kein aktives Benutzerkonto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uninvitedMitarbeiter.map((m) => (
                <UninvitedMitarbeiterRow
                  key={m.id}
                  mitarbeiter={m}
                  isSelected={selectedUninvited.has(m.id)}
                  onToggleSelect={() => toggleUninvitedSelection(m.id)}
                  actionLoading={actionLoading}
                  onInvite={handleActivateEmployee}
                  onEdit={handleEditMitarbeiter}
                  onDelete={(id) => {
                    setSelectedMitarbeiter(id);
                    setDeleteDialogOpen(true);
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                  <Badge variant="secondary">{invitedMitarbeiter.length}</Badge>
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
                        currentRole={m.benutzer_id ? (userRolesMap[m.benutzer_id] as UserRole) || 'mitarbeiter' : 'mitarbeiter'}
                        onChangeRole={handleChangeRole}
                        canAssignGF={masterUnlocked}
                        canAssignRoles={masterUnlocked}
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
                        currentRole={m.benutzer_id ? (userRolesMap[m.benutzer_id] as UserRole) || 'mitarbeiter' : 'mitarbeiter'}
                        onChangeRole={handleChangeRole}
                        canAssignGF={masterUnlocked}
                        canAssignRoles={masterUnlocked}
                      />
                    ))}
                  </div>
                )}

                {invitedMitarbeiter.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    {searchQuery ? 'Keine Mitarbeiter gefunden' : 'Keine eingeladenen Mitarbeiter vorhanden'}
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
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-500" />
                    <CardTitle className="text-xl">Ausstehend</CardTitle>
                    {pendingBenutzer.length > 0 && (
                      <Badge variant="destructive">{pendingBenutzer.length}</Badge>
                    )}
                  </div>
                </div>
                {pendingBenutzer.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleAllPending}
                      className="gap-2"
                    >
                      {selectedPending.size === pendingBenutzer.length ? 'Keine' : 'Alle'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleBulkApprove}
                      disabled={selectedPending.size === 0 || bulkActionLoading}
                      className="gap-2"
                    >
                      {bulkActionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MailCheck className="h-4 w-4" />
                      )}
                      {selectedPending.size > 0 ? `${selectedPending.size} genehmigen` : 'Genehmigen'}
                    </Button>
                  </div>
                )}
              </div>
              <CardDescription>
                Registrierungsanfragen prüfen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-420px)]">
                {pendingBenutzer.length > 0 ? (
                  <div className="space-y-3">
                    {pendingBenutzer.map((benutzer) => (
                      <Card key={benutzer.id} className="bg-muted/50">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={selectedPending.has(benutzer.id)}
                                onCheckedChange={() => togglePendingSelection(benutzer.id)}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
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

      {/* Create User Manual Dialog */}
      <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Benutzer manuell erstellen
            </DialogTitle>
            <DialogDescription>
              Erstellt sofort ein vollständiges Konto mit E-Mail und Passwort. Der Benutzer kann das Passwort später über "Passwort vergessen" ändern.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-vorname">Vorname</Label>
                <Input
                  id="create-vorname"
                  value={createUserForm.vorname}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, vorname: e.target.value })}
                  placeholder="Max"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-nachname">Nachname</Label>
                <Input
                  id="create-nachname"
                  value={createUserForm.nachname}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, nachname: e.target.value })}
                  placeholder="Mustermann"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">E-Mail-Adresse *</Label>
              <Input
                id="create-email"
                type="email"
                value={createUserForm.email}
                onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })}
                placeholder="benutzer@beispiel.de"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Passwort *</Label>
              <Input
                id="create-password"
                type="text"
                value={createUserForm.password}
                onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })}
                placeholder="Mindestens 6 Zeichen"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-rolle">Rolle</Label>
              <Select
                value={createUserForm.rolle}
                onValueChange={(value) => setCreateUserForm({ ...createUserForm, rolle: value })}
              >
                <SelectTrigger id="create-rolle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {masterUnlocked && (
                    <SelectItem value="geschaeftsfuehrer">Geschäftsführer</SelectItem>
                  )}
                   <SelectItem value="admin">Manager</SelectItem>
                  <SelectItem value="mitarbeiter">Mitarbeiter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateUserDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateUserManual} disabled={createUserLoading}>
              {createUserLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Benutzer erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Masteradmin Password Dialog */}
      <Dialog open={masterPasswordDialog} onOpenChange={setMasterPasswordDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Masteradmin-Zugang
            </DialogTitle>
            <DialogDescription>
              Geben Sie das Master-Passwort ein, um die Rollenverwaltung freizuschalten.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="master-password">Passwort</Label>
              <Input
                id="master-password"
                type="password"
                value={masterPasswordInput}
                onChange={(e) => setMasterPasswordInput(e.target.value)}
                placeholder="Master-Passwort eingeben"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleVerifyMasterPassword();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMasterPasswordDialog(false); setMasterPasswordInput(''); }}>
              Abbrechen
            </Button>
            <Button onClick={handleVerifyMasterPassword} disabled={masterPasswordLoading || !masterPasswordInput}>
              {masterPasswordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Freischalten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Component for uninvited employees
function UninvitedMitarbeiterRow({ 
  mitarbeiter: m, 
  isSelected,
  onToggleSelect,
  actionLoading, 
  onInvite,
  onEdit, 
  onDelete,
}: {
  mitarbeiter: Mitarbeiter;
  isSelected: boolean;
  onToggleSelect: () => void;
  actionLoading: string | null;
  onInvite: (m: Mitarbeiter, email: string) => void;
  onEdit: (m: Mitarbeiter) => void;
  onDelete: (id: string) => void;
}) {
  const [emailInput, setEmailInput] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  
  const fullName = m.vorname || m.nachname
    ? `${m.vorname || ''} ${m.nachname || ''}`.trim()
    : 'Unbekannt';

  const handleInviteClick = () => {
    if (showEmailInput && emailInput) {
      onInvite(m, emailInput);
      setShowEmailInput(false);
      setEmailInput('');
    } else {
      setShowEmailInput(true);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 border rounded-lg bg-background">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
          />
          <div>
            <p className="font-medium">{fullName}</p>
            {m.telefon && (
              <p className="text-sm text-muted-foreground">{m.telefon}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
            Nicht aktiviert
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
            variant="destructive"
            size="sm"
            onClick={() => onDelete(m.id)}
            disabled={actionLoading === m.id}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Email input for invitation */}
      <div className="flex gap-2 items-center pl-8">
        {showEmailInput ? (
          <>
            <Input
              type="email"
              placeholder="E-Mail-Adresse eingeben..."
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && emailInput) {
                  handleInviteClick();
                }
              }}
            />
            <Button
              size="sm"
              onClick={handleInviteClick}
              disabled={!emailInput || actionLoading === m.id}
            >
              {actionLoading === m.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowEmailInput(false);
                setEmailInput('');
              }}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleInviteClick}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Konto aktivieren
          </Button>
        )}
      </div>
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
  loadData,
  currentRole,
  onChangeRole,
  canAssignGF,
  canAssignRoles,
}: {
  mitarbeiter: Mitarbeiter;
  actionLoading: string | null;
  onEdit: (m: Mitarbeiter) => void;
  onToggleActive: (id: string, status: boolean) => void;
  onDelete: (id: string) => void;
  loadData: () => void;
  currentRole: UserRole | null;
  onChangeRole: (userId: string, newRole: string) => void;
  canAssignGF: boolean;
  canAssignRoles: boolean;
}) {
  const fullName = m.vorname || m.nachname
    ? `${m.vorname || ''} ${m.nachname || ''}`.trim()
    : 'Unbekannt';

  const roleLabelMap: Record<string, string> = {
    geschaeftsfuehrer: 'Geschäftsführer',
    admin: 'Manager',
    mitarbeiter: 'Mitarbeiter',
  };

  const roleBadgeVariant = (role: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (role) {
      case 'geschaeftsfuehrer': return 'destructive';
      case 'admin': return 'default';
      default: return 'secondary';
    }
  };

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
        {/* Role selector */}
        {currentRole && canAssignRoles ? (
          <Select
            value={currentRole}
            onValueChange={(value) => onChangeRole(m.id, value)}
            disabled={actionLoading === m.id}
          >
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <div className="flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {canAssignGF && (
                <SelectItem value="geschaeftsfuehrer">Geschäftsführer</SelectItem>
              )}
              <SelectItem value="admin">Manager</SelectItem>
              <SelectItem value="mitarbeiter">Mitarbeiter</SelectItem>
            </SelectContent>
          </Select>
        ) : currentRole ? (
          <Badge variant={roleBadgeVariant(currentRole)}>
            <Shield className="h-3 w-3 mr-1" />
            {roleLabelMap[currentRole] || currentRole}
          </Badge>
        ) : null}

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
