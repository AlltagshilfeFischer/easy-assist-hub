import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { format, getDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { Clock, User, Phone, Mail, MapPin, Save, X, AlertTriangle, Trash2, AlertCircle, Repeat, Calendar, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CreateRecurringAppointmentDialog } from './CreateRecurringAppointmentDialog';
import { AppointmentAttachments } from '@/components/schedule/AppointmentAttachments';
import { KundenDetailDialog } from '@/components/customers/KundenDetailDialog';
import { useUserRole } from '@/hooks/useUserRole';
import type { Employee, Customer, Appointment, CustomerTimeWindow } from '@/types/domain';

interface AppointmentDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  employees: Employee[];
  customers: Customer[];
  onUpdate: (appointment: Appointment) => Promise<void>;
  onDelete: (appointmentId: string) => Promise<void>;
  isConflicting?: boolean;
  customerTimeWindows?: CustomerTimeWindow[];
}

const KATEGORIE_OPTIONS = [
  'Erstgespräch', 'Schulung', 'Meeting', 'Bewerbungsgespräch',
  'Blocker', 'Intern', 'Regelbesuch', 'Sonstiges',
] as const;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  unassigned: { label: 'Offen', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  scheduled: { label: 'Geplant', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  in_progress: { label: 'In Bearbeitung', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  completed: { label: 'Abgeschlossen', color: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label: 'Abgesagt (kurzfr.)', color: 'bg-red-100 text-red-800 border-red-200' },
  nicht_angetroffen: { label: 'Nicht angetroffen', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  abgesagt_rechtzeitig: { label: 'Rechtzeitig abgesagt', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  abgerechnet: { label: 'Abgerechnet', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  bezahlt: { label: 'Bezahlt', color: 'bg-teal-100 text-teal-800 border-teal-200' },
};

export function AppointmentDetailDialog({
  isOpen, onClose, appointment, employees, customers,
  onUpdate, onDelete, isConflicting = false, customerTimeWindows = []
}: AppointmentDetailDialogProps) {
  const [editedAppointment, setEditedAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteSeriesDialog, setShowDeleteSeriesDialog] = useState(false);
  const [deleteSeriesAction, setDeleteSeriesAction] = useState<'single' | 'all'>('single');
  const [showSeriesDialog, setShowSeriesDialog] = useState(false);
  const [seriesAction, setSeriesAction] = useState<'single' | 'all'>('single');
  const [showEditTemplateDialog, setShowEditTemplateDialog] = useState(false);
  const [templateData, setTemplateData] = useState<any>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelAbsageDatum, setCancelAbsageDatum] = useState('');
  const [cancelAbsageKanal, setCancelAbsageKanal] = useState('');
  const [cancelGrund, setCancelGrund] = useState('');
  const [showCustomerFaultDialog, setShowCustomerFaultDialog] = useState(false);
  const [customerFaultNote, setCustomerFaultNote] = useState('');
  const [showKundenDetail, setShowKundenDetail] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();
  const { isGeschaeftsfuehrer, isAdmin } = useUserRole();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (appointment) {
      setEditedAppointment({ ...appointment });
      setHasChanges(false);
    }
  }, [appointment]);

  if (!appointment || !editedAppointment) return null;

  const updateField = (updates: Partial<Appointment>) => {
    setEditedAppointment((prev) => prev ? { ...prev, ...updates } : prev);
    setHasChanges(true);
  };

  const startDate = new Date(editedAppointment.start_at);
  const endDate = new Date(editedAppointment.end_at);
  const durationMin = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
  const status = STATUS_MAP[editedAppointment.status] ?? { label: editedAppointment.status, color: '' };
  const isTerminated = ['cancelled', 'nicht_angetroffen', 'abgesagt_rechtzeitig'].includes(editedAppointment.status);

  // Time editing helpers
  const editDate = format(startDate, 'yyyy-MM-dd');
  const editStartTime = format(startDate, 'HH:mm');
  const editEndTime = format(endDate, 'HH:mm');

  const handleTimeChange = (field: 'date' | 'startTime' | 'endTime', value: string) => {
    const curStart = new Date(editedAppointment.start_at);
    const curEnd = new Date(editedAppointment.end_at);

    if (field === 'date') {
      const [y, m, d] = value.split('-').map(Number);
      const newStart = new Date(y, m - 1, d, curStart.getHours(), curStart.getMinutes());
      const newEnd = new Date(y, m - 1, d, curEnd.getHours(), curEnd.getMinutes());
      updateField({ start_at: newStart.toISOString(), end_at: newEnd.toISOString() });
    } else if (field === 'startTime') {
      const [h, min] = value.split(':').map(Number);
      const newStart = new Date(curStart);
      newStart.setHours(h, min, 0, 0);
      // Keep duration
      const dur = curEnd.getTime() - curStart.getTime();
      const newEnd = new Date(newStart.getTime() + dur);
      updateField({ start_at: newStart.toISOString(), end_at: newEnd.toISOString() });
    } else {
      const [h, min] = value.split(':').map(Number);
      const newEnd = new Date(curStart);
      newEnd.setHours(h, min, 0, 0);
      if (newEnd <= curStart) newEnd.setDate(newEnd.getDate() + 1);
      updateField({ end_at: newEnd.toISOString() });
    }
  };

  // Save
  const handleSave = async () => {
    if (!editedAppointment) return;
    if (editedAppointment.vorlage_id && !editedAppointment.ist_ausnahme) {
      setShowSeriesDialog(true);
      return;
    }
    await performSave();
  };

  const performSave = async () => {
    if (!editedAppointment) return;
    setLoading(true);
    try {
      if (seriesAction === 'single' && editedAppointment.vorlage_id) {
        await onUpdate({ ...editedAppointment, ist_ausnahme: true, ausnahme_grund: 'Manuelle Änderung' });
      } else {
        await onUpdate(editedAppointment);
      }
      setHasChanges(false);
      setShowSeriesDialog(false);
      toast({ title: 'Gespeichert' });
    } catch { /* handled in parent */ }
    finally { setLoading(false); }
  };

  // Delete
  const handleDeleteClick = () => {
    if (appointment.vorlage_id && !appointment.ist_ausnahme) {
      setDeleteSeriesAction('single');
      setShowDeleteSeriesDialog(true);
    } else {
      setShowDeleteDialog(true);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try { await onDelete(appointment.id); setShowDeleteDialog(false); onClose(); }
    catch { /* handled */ }
    finally { setLoading(false); }
  };

  const handleDeleteSeries = async () => {
    setLoading(true);
    try {
      if (deleteSeriesAction === 'single') {
        await onDelete(appointment.id);
      } else if (appointment.vorlage_id) {
        await supabase.from('termin_vorlagen').update({ ist_aktiv: false }).eq('id', appointment.vorlage_id);
        await supabase.from('termine').delete().eq('vorlage_id', appointment.vorlage_id).gte('start_at', new Date().toISOString());
        toast({ title: 'Terminserie gelöscht' });
      }
      setShowDeleteSeriesDialog(false);
      onClose();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  // Cancel
  const handleCancelAppointment = async () => {
    if (!editedAppointment) return;
    setLoading(true);
    try {
      let cancelStatus: string = 'cancelled';
      if (cancelAbsageDatum && editedAppointment.start_at) {
        const diffDays = (new Date(editedAppointment.start_at).getTime() - new Date(cancelAbsageDatum).getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays >= 2) cancelStatus = 'abgesagt_rechtzeitig';
      }
      await onUpdate({ ...editedAppointment, status: cancelStatus, absage_datum: cancelAbsageDatum || null, absage_kanal: cancelAbsageKanal || null, ausnahme_grund: cancelGrund || null } as any);
      toast({ title: cancelStatus === 'abgesagt_rechtzeitig' ? 'Rechtzeitig abgesagt (nicht abrechenbar)' : 'Kurzfristig abgesagt (abrechenbar)' });
      setShowCancelDialog(false);
      setCancelAbsageDatum(''); setCancelAbsageKanal(''); setCancelGrund('');
      onClose();
    } catch { toast({ title: 'Fehler', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const handleCustomerFault = async () => {
    if (!editedAppointment) return;
    setLoading(true);
    try {
      await onUpdate({ ...editedAppointment, status: 'nicht_angetroffen' as any, ausnahme_grund: `Nicht angetroffen${customerFaultNote ? ': ' + customerFaultNote : ''}` });
      toast({ title: 'Als "Nicht angetroffen" markiert (wird abgerechnet)' });
      setShowCustomerFaultDialog(false); setCustomerFaultNote(''); onClose();
    } catch { toast({ title: 'Fehler', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const handleTimelyCancel = async () => {
    if (!editedAppointment) return;
    setLoading(true);
    try {
      await onUpdate({ ...editedAppointment, status: 'abgesagt_rechtzeitig' as any });
      toast({ title: 'Rechtzeitig abgesagt' }); onClose();
    } catch { toast({ title: 'Fehler', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const handleEditTemplate = async () => {
    if (!editedAppointment?.vorlage_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('termin_vorlagen').select('*').eq('id', editedAppointment.vorlage_id).single();
      if (error) throw error;
      setTemplateData(data);
      setShowEditTemplateDialog(true);
    } catch (e: any) { toast({ title: 'Fehler', description: e.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const handleTemplateUpdate = async (template: any) => {
    if (!editedAppointment?.vorlage_id) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('termin_vorlagen').update({
        titel: template.titel, kunden_id: template.kunden_id, mitarbeiter_id: template.mitarbeiter_id,
        wochentag: template.wochentag, start_zeit: template.start_zeit, dauer_minuten: template.dauer_minuten,
        intervall: template.intervall, gueltig_von: template.gueltig_von, gueltig_bis: template.gueltig_bis, notizen: template.notizen,
      }).eq('id', editedAppointment.vorlage_id);
      if (error) throw error;
      toast({ title: 'Terminvorlage aktualisiert' });
      setShowEditTemplateDialog(false); onClose();
    } catch (e: any) { toast({ title: 'Fehler', description: e.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const customer = editedAppointment.customer;
  const employee = editedAppointment.employee;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold">
                {customer?.name || editedAppointment.titel || 'Termin'}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {editedAppointment.vorlage_id && !editedAppointment.ist_ausnahme && (
                  <Badge variant="outline" className="text-xs"><Repeat className="h-3 w-3 mr-1" />Serie</Badge>
                )}
                <Badge className={cn('text-xs border', status.color)}>{status.label}</Badge>
              </div>
            </div>
            <DialogDescription className="sr-only">Termindetails bearbeiten</DialogDescription>
          </DialogHeader>

          {/* Warnungen */}
          {isConflicting && (
            <div className="flex items-center gap-2 mt-3 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Zeitliche Überschneidung mit anderem Termin
            </div>
          )}
        </div>

        <Separator />

        {/* Editierbare Felder */}
        <div className="px-6 py-4 space-y-5">

          {/* Datum & Zeit — DIREKT EDITIERBAR */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Datum & Zeit</Label>
            <div className="grid grid-cols-[1fr,auto,auto] gap-2 mt-2 items-center">
              <Input type="date" value={editDate} onChange={(e) => handleTimeChange('date', e.target.value)} className="h-9" />
              <Input type="time" value={editStartTime} onChange={(e) => handleTimeChange('startTime', e.target.value)} className="h-9 w-28" />
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-sm">–</span>
                <Input type="time" value={editEndTime} onChange={(e) => handleTimeChange('endTime', e.target.value)} className="h-9 w-28" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {format(startDate, 'EEEE', { locale: de })} · {durationMin} Min ({(durationMin / 60).toFixed(1)} Std.)
            </p>
          </div>

          {/* Mitarbeiter */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mitarbeiter</Label>
            <Select
              value={editedAppointment.mitarbeiter_id || 'unassigned'}
              onValueChange={(v) => updateField({ mitarbeiter_id: v === 'unassigned' ? null : v })}
            >
              <SelectTrigger className="mt-1.5 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Nicht zugewiesen</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: emp.farbe_kalender }} />
                      {emp.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {employee && (
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                {employee.telefon && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{employee.telefon}</span>}
                {employee.benutzer?.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{employee.benutzer.email}</span>}
              </div>
            )}
          </div>

          {/* Status + Label */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</Label>
              <Select value={editedAppointment.status} onValueChange={(v: any) => {
                const updates: any = { status: v };
                if (v === 'unassigned') updates.mitarbeiter_id = null;
                updateField(updates);
              }}>
                <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Offen</SelectItem>
                  <SelectItem value="scheduled">Geplant</SelectItem>
                  <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                  <SelectItem value="completed">Abgeschlossen</SelectItem>
                  <SelectItem value="cancelled">Abgesagt (kurzfr.)</SelectItem>
                  <SelectItem value="nicht_angetroffen">Nicht angetroffen</SelectItem>
                  <SelectItem value="abgesagt_rechtzeitig">Rechtzeitig abgesagt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Label</Label>
              <Select value={editedAppointment.kategorie ?? '__none__'} onValueChange={(v) => updateField({ kategorie: v === '__none__' ? null : v as any })}>
                <SelectTrigger className="mt-1.5 h-9"><SelectValue placeholder="Kein Label" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Kein Label</SelectItem>
                  {KATEGORIE_OPTIONS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Kunde */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Kunde</Label>
            <Select value={editedAppointment.kunden_id ?? '__none__'} onValueChange={(v) => updateField({ kunden_id: v === '__none__' ? null : v })}>
              <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Kein Kunde</SelectItem>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {customer && (
              <div className="mt-2 p-2.5 rounded-md bg-muted/50 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{customer.name}</span>
                  {(isGeschaeftsfuehrer || isAdmin) && (
                    <button onClick={() => setShowKundenDetail(true)} className="text-primary text-[11px] hover:underline">Details</button>
                  )}
                </div>
                {customer.telefonnr && <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3" />{customer.telefonnr}</div>}
                {(customer.strasse || customer.stadt) && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>
                      {[customer.strasse, [customer.plz, customer.stadt].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                      {customer.stadtteil && <span className="opacity-60"> ({customer.stadtteil})</span>}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notizen */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notizen</Label>
            <Textarea
              value={editedAppointment.notizen || ''}
              onChange={(e) => updateField({ notizen: e.target.value })}
              placeholder="Notizen zum Termin..."
              className="mt-1.5 min-h-[60px] resize-y text-sm"
            />
          </div>

          {/* Anhänge */}
          <AppointmentAttachments terminId={editedAppointment.id} />
        </div>

        <Separator />

        {/* Quick Actions */}
        <div className="px-6 py-3">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Schnellaktionen</Label>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setShowCancelDialog(true)} disabled={loading || isTerminated}
              className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50">
              <X className="h-3 w-3 mr-1" />Absagen
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCustomerFaultDialog(true)} disabled={loading || isTerminated}
              className="h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50">
              <AlertTriangle className="h-3 w-3 mr-1" />Nicht angetroffen
            </Button>
            <Button size="sm" variant="outline" onClick={handleTimelyCancel} disabled={loading || isTerminated}
              className="h-7 text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />Rechtzeitig abgesagt
            </Button>
            {editedAppointment.vorlage_id && !editedAppointment.ist_ausnahme && (
              <Button size="sm" variant="outline" onClick={handleEditTemplate} disabled={loading}
                className="h-7 text-xs">
                <Repeat className="h-3 w-3 mr-1" />Serie bearbeiten
              </Button>
            )}
          </div>
        </div>

        <Separator />

        {/* Footer */}
        <div className="px-6 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleDeleteClick} className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 text-xs">
            <Trash2 className="h-3.5 w-3.5 mr-1" />Löschen
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="h-8">Schließen</Button>
            {hasChanges && (
              <Button size="sm" onClick={handleSave} disabled={loading} className="h-8">
                <Save className="h-3.5 w-3.5 mr-1.5" />{loading ? 'Speichert...' : 'Speichern'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Termin löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              "{appointment.titel}" am {format(new Date(appointment.start_at), 'dd.MM.yyyy', { locale: de })} wird dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {loading ? 'Wird gelöscht...' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Series Dialog */}
      <AlertDialog open={showDeleteSeriesDialog} onOpenChange={setShowDeleteSeriesDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Serientermin löschen</AlertDialogTitle>
            <AlertDialogDescription>Was möchten Sie löschen?</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-3">
            {(['single', 'all'] as const).map((action) => (
              <button key={action} onClick={() => setDeleteSeriesAction(action)}
                className={cn("w-full p-3 text-left rounded-lg border-2 transition-colors", deleteSeriesAction === action ? "border-destructive bg-destructive/5" : "border-border hover:border-destructive/50")}>
                <div className="font-medium text-sm">{action === 'single' ? 'Nur diesen Termin' : 'Gesamte Serie'}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{action === 'single' ? 'Serie wird fortgesetzt' : 'Vorlage deaktiviert + zukünftige Termine gelöscht'}</div>
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSeries} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {loading ? 'Wird gelöscht...' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Series Edit Dialog */}
      <AlertDialog open={showSeriesDialog} onOpenChange={setShowSeriesDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Serientermin bearbeiten</AlertDialogTitle>
            <AlertDialogDescription>Nur diesen Termin oder die gesamte Serie ändern?</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-3">
            {(['single', 'all'] as const).map((action) => (
              <button key={action} onClick={() => setSeriesAction(action)}
                className={cn("w-full p-3 text-left rounded-lg border-2 transition-colors", seriesAction === action ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}>
                <div className="font-medium text-sm">{action === 'single' ? 'Nur diesen Termin' : 'Alle zukünftigen Termine'}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{action === 'single' ? 'Wird als Ausnahme markiert' : 'Vorlage wird angepasst'}</div>
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={performSave} disabled={loading}>
              {loading ? 'Speichert...' : 'Übernehmen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Template */}
      {templateData && (
        <CreateRecurringAppointmentDialog open={showEditTemplateDialog} onOpenChange={setShowEditTemplateDialog}
          customers={customers} employees={employees} onSubmit={handleTemplateUpdate} editingTemplate={templateData} />
      )}

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Termin absagen</AlertDialogTitle>
            <AlertDialogDescription>Absage dokumentieren (2-Tage-Regel wird automatisch geprüft).</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Absagedatum</Label><Input type="date" value={cancelAbsageDatum} onChange={(e) => setCancelAbsageDatum(e.target.value)} className="mt-1" /></div>
              <div>
                <Label className="text-xs">Absagekanal</Label>
                <Select value={cancelAbsageKanal} onValueChange={setCancelAbsageKanal}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                  <SelectContent>
                    {['Telefonisch', 'E-Mail', 'Persönlich', 'WhatsApp', 'Sonstiges'].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs">Grund (optional)</Label><Textarea value={cancelGrund} onChange={(e) => setCancelGrund(e.target.value)} placeholder="Grund..." rows={2} className="mt-1" /></div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelAppointment} disabled={loading} className="bg-destructive text-destructive-foreground">
              {loading ? 'Wird abgesagt...' : 'Absagen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Customer Fault Dialog */}
      <AlertDialog open={showCustomerFaultDialog} onOpenChange={setShowCustomerFaultDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nicht angetroffen</AlertDialogTitle>
            <AlertDialogDescription>Wird als abrechenbar markiert.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-3">
            <Label className="text-xs">Optionale Notiz</Label>
            <Textarea value={customerFaultNote} onChange={(e) => setCustomerFaultNote(e.target.value)}
              placeholder="z.B. Kunde war nicht zu Hause..." rows={2} className="mt-1" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleCustomerFault} disabled={loading}>
              {loading ? 'Speichert...' : 'Markieren'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>

    <KundenDetailDialog isOpen={showKundenDetail} onClose={() => setShowKundenDetail(false)} kundenId={editedAppointment?.kunden_id || null} />
    </>
  );
}
