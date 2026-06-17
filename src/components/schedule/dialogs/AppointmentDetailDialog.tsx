import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { TimeInput } from '@/components/ui/time-input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { format, getDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { Clock, User, Phone, Mail, MapPin, Save, X, AlertTriangle, Trash2, AlertCircle, Repeat, Calendar, Users, Home, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CreateRecurringAppointmentDialog } from './CreateRecurringAppointmentDialog';
import { AusweichortSelector } from '@/components/schedule/AusweichortSelector';
import { AppointmentAttachments } from '@/components/schedule/AppointmentAttachments';
import { AppointmentHistorySection } from '@/components/schedule/AppointmentHistorySection';
import { KundenDetailDialog } from '@/components/customers/KundenDetailDialog';
import { useUserRole } from '@/hooks/useUserRole';
import { CustomerSearchCombobox } from '@/components/schedule/CustomerSearchCombobox';
import type { Employee, Customer, Appointment } from '@/types/domain';
import { useAllVerfuegbarkeiten } from '@/hooks/useAllVerfuegbarkeiten';
import { checkVerfuegbarkeit } from '@/lib/schedule/checkVerfuegbarkeit';
import { useAllKundenZeitfenster } from '@/hooks/useAllKundenZeitfenster';
import { checkKundenZeitfenster } from '@/lib/schedule/checkKundenZeitfenster';
import { useAllAbwesenheiten } from '@/hooks/useAllAbwesenheiten';
import { checkAbwesenheit } from '@/lib/schedule/checkAbwesenheit';

interface AppointmentDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  employees: Employee[];
  customers: Customer[];
  onUpdate: (appointment: Appointment) => Promise<void>;
  onDelete: (appointmentId: string) => Promise<void>;
  onDeleteSeries?: (vorlageId: string, mode: 'single' | 'all', appointmentId?: string) => Promise<void>;
  onDuplicate?: (appointment: Appointment) => Promise<void>;
  isConflicting?: boolean;
}

const KATEGORIE_OPTIONS = [
  'Kundentermin', 'Erstgespräch', 'Regelbesuch', 'Schulung', 'Meeting',
  'Bewerbungsgespräch', 'Blocker', 'Intern', 'Sonstiges',
] as const;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  unassigned: { label: 'Offen', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  scheduled: { label: 'Geplant', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  in_progress: { label: 'In Bearbeitung', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  completed: { label: 'Durchgeführt', color: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label: 'Abgesagt', color: 'bg-red-100 text-red-800 border-red-200' },
  nicht_angetroffen: { label: 'Nicht angetroffen', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  abgesagt_rechtzeitig: { label: 'Abgesagt', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  abgerechnet: { label: 'Abgerechnet', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  bezahlt: { label: 'Bezahlt', color: 'bg-teal-100 text-teal-800 border-teal-200' },
};

export function AppointmentDetailDialog({
  isOpen, onClose, appointment, employees, customers,
  onUpdate, onDelete, onDeleteSeries, onDuplicate, isConflicting = false,
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
  const [showVerfuegbarkeitConfirm, setShowVerfuegbarkeitConfirm] = useState(false);
  const { toast } = useToast();
  const { isGeschaeftsfuehrer, isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const { data: allVerfuegbarkeiten = [] } = useAllVerfuegbarkeiten();
  const { data: allKundenZeitfenster = [] } = useAllKundenZeitfenster();
  const { data: allAbwesenheiten = [] } = useAllAbwesenheiten();

  React.useEffect(() => {
    if (appointment) {
      setEditedAppointment({ ...appointment });
      setHasChanges(false);
    }
  }, [appointment]);

  const kundenZeitfensterCheck = React.useMemo(() => {
    if (!editedAppointment) return null;
    return checkKundenZeitfenster(
      editedAppointment.kunden_id ?? null,
      editedAppointment.start_at,
      editedAppointment.end_at,
      allKundenZeitfenster,
    );
  }, [editedAppointment?.kunden_id, editedAppointment?.start_at, editedAppointment?.end_at, allKundenZeitfenster]);

  if (!appointment || !editedAppointment) return null;

  const updateField = (updates: Partial<Appointment>) => {
    setEditedAppointment((prev) => prev ? { ...prev, ...updates } : prev);
    setHasChanges(true);
  };

  const erstgespraechRoleConflict =
    editedAppointment.kategorie === 'Erstgespräch' &&
    employees.find((e) => e.id === editedAppointment.mitarbeiter_id)?.rolle === 'mitarbeiter';

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
  const proceedWithSave = async () => {
    if (!editedAppointment) return;
    if (editedAppointment.vorlage_id && !editedAppointment.ist_ausnahme) {
      setShowSeriesDialog(true);
      return;
    }
    await performSave();
  };

  const handleSave = async () => {
    if (!editedAppointment) return;

    if (editedAppointment.mitarbeiter_id) {
      const isAbsent = checkAbwesenheit(
        editedAppointment.mitarbeiter_id,
        editedAppointment.start_at,
        allAbwesenheiten,
      );
      if (isAbsent) {
        const emp = employees.find(e => e.id === editedAppointment.mitarbeiter_id);
        const name = emp?.name || 'Der Mitarbeiter';
        toast({ title: 'Mitarbeiter abwesend', description: `${name} ist an diesem Tag abwesend. Bitte wähle einen anderen Mitarbeiter.`, variant: 'destructive' });
        return;
      }
    }

    const check = checkVerfuegbarkeit(
      editedAppointment.mitarbeiter_id ?? null,
      editedAppointment.start_at,
      editedAppointment.end_at,
      allVerfuegbarkeiten,
    );
    if (check.outsideWindow) {
      setShowVerfuegbarkeitConfirm(true);
      return;
    }
    await proceedWithSave();
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
      } else if (appointment.vorlage_id && onDeleteSeries) {
        await onDeleteSeries(appointment.vorlage_id, 'all', appointment.id);
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
      if (!cancelAbsageDatum) {
        toast({ title: 'Bitte Absagezeitpunkt angeben', variant: 'destructive' });
        return;
      }
      if (!cancelAbsageKanal) {
        toast({ title: 'Bitte Absagekanal angeben', variant: 'destructive' });
        return;
      }
      const diffDays = (new Date(editedAppointment.start_at).getTime() - new Date(cancelAbsageDatum).getTime()) / (1000 * 60 * 60 * 24);
      const cancelStatus: string = diffDays >= 2 ? 'abgesagt_rechtzeitig' : 'cancelled';
      await onUpdate({ ...editedAppointment, status: cancelStatus, absage_datum: cancelAbsageDatum, absage_kanal: cancelAbsageKanal || null, ausnahme_grund: cancelGrund || null } as any);
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
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 sticky top-0 bg-background z-10">
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
              <TimeInput value={editStartTime} onChange={(v) => handleTimeChange('startTime', v)} className="h-9 w-28" />
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-sm">–</span>
                <TimeInput value={editEndTime} onChange={(v) => handleTimeChange('endTime', v)} className="h-9 w-28" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {format(startDate, 'EEEE', { locale: de })} · {durationMin} Min ({(durationMin / 60).toFixed(1)} Std.)
            </p>
            {kundenZeitfensterCheck?.outsideWindow && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {kundenZeitfensterCheck.noEntryForDay
                  ? 'Dieser Wochentag liegt außerhalb der Kundenpräferenz.'
                  : 'Die Uhrzeit liegt außerhalb des bevorzugten Zeitfensters des Kunden.'}
              </div>
            )}
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
            {erstgespraechRoleConflict && (
              <p className="text-sm text-destructive flex items-center gap-1.5 mt-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Erstgespräche können nur von der Geschäftsführung durchgeführt werden. Bitte wähle eine andere Kategorie oder einen anderen Mitarbeiter.
              </p>
            )}
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
              <Select
                value={editedAppointment.status}
                disabled={['abgerechnet', 'bezahlt', 'cancelled', 'abgesagt_rechtzeitig'].includes(editedAppointment.status)}
                onValueChange={(v: any) => {
                  const updates: any = { status: v };
                  if (v === 'unassigned') updates.mitarbeiter_id = null;
                  updateField(updates);
                }}
              >
                <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Offen</SelectItem>
                  <SelectItem value="scheduled">Geplant</SelectItem>
                  <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                  <SelectItem value="completed">Durchgeführt</SelectItem>
                  <SelectItem value="nicht_angetroffen">Nicht angetroffen</SelectItem>
                  {/* Absage-Statuse nur zur Anzeige — werden ausschließlich über den Absagen-Dialog gesetzt */}
                  <SelectItem value="cancelled" disabled>Abgesagt (kurzfristig)</SelectItem>
                  <SelectItem value="abgesagt_rechtzeitig" disabled>Abgesagt (rechtzeitig)</SelectItem>
                  <SelectItem value="abgerechnet" disabled>Abgerechnet</SelectItem>
                  <SelectItem value="bezahlt" disabled>Bezahlt</SelectItem>
                </SelectContent>
              </Select>
              {['abgerechnet', 'bezahlt'].includes(editedAppointment.status) && (
                <p className="text-xs text-muted-foreground mt-1">Status gesperrt — Termin ist bereits abgerechnet.</p>
              )}
              {['cancelled', 'abgesagt_rechtzeitig'].includes(editedAppointment.status) && (
                <p className="text-xs text-muted-foreground mt-1">Absage über „Absagen"-Button setzen.</p>
              )}
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
            <div className="mt-1.5">
              <CustomerSearchCombobox
                customers={customers.map((c) => ({ id: c.id, name: c.name || [c.vorname, c.nachname].filter(Boolean).join(' ') || 'Unbekannt', vorname: c.vorname ?? null, nachname: c.nachname ?? null, farbe_kalender: c.farbe_kalender ?? '#10B981' }))}
                value={editedAppointment.kunden_id || ''}
                onValueChange={(v) => updateField({ kunden_id: v || null })}
                placeholder="Kunde suchen..."
              />
            </div>
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

          {/* Einsatzort */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Einsatzort</Label>
            <div className="mt-1.5">
              <AusweichortSelector
                value={editedAppointment.ausweichort_id ?? null}
                onChange={(v) => updateField({ ausweichort_id: v })}
                zIndex={210}
              />
            </div>
            {!editedAppointment.ausweichort_id && customer && (customer.strasse || customer.stadt) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 ml-0.5">
                <Home className="h-3 w-3 shrink-0" />
                <span>Kundenwohnung: {[customer.strasse, [customer.plz, customer.stadt].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>
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

          {/* Absage-Details (read-only, nur bei abgesagten Terminen) */}
          {['cancelled', 'abgesagt_rechtzeitig'].includes(editedAppointment.status) && (
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Absage-Details</Label>
              <div className="mt-1.5 p-2.5 rounded-md bg-muted/50 text-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span>
                    {editedAppointment.absage_datum
                      ? format(new Date(editedAppointment.absage_datum), 'dd.MM.yyyy HH:mm') + ' Uhr'
                      : 'Zeitpunkt nicht dokumentiert'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span>{editedAppointment.absage_kanal || 'Kanal nicht dokumentiert'}</span>
                </div>
                <div className={`font-medium ${editedAppointment.status === 'cancelled' ? 'text-red-700' : 'text-slate-600'}`}>
                  {editedAppointment.status === 'cancelled'
                    ? 'Kurzfristige Absage — abrechenbar'
                    : 'Rechtzeitige Absage — nicht abrechenbar'}
                </div>
              </div>
            </div>
          )}

          {/* MA-Kommentar (read-only, nur sichtbar wenn vorhanden) */}
          {editedAppointment.ma_kommentar && (
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Kommentar Mitarbeiter</Label>
              <p className="mt-1.5 text-sm p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200 whitespace-pre-wrap">
                {editedAppointment.ma_kommentar}
              </p>
            </div>
          )}

          {/* Anhänge */}
          <AppointmentAttachments terminId={editedAppointment.id} />

          {/* Verlauf */}
          <div>
            <AppointmentHistorySection terminId={editedAppointment.id} />
          </div>
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
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleDeleteClick} className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 text-xs">
              <Trash2 className="h-3.5 w-3.5 mr-1" />Löschen
            </Button>
            {onDuplicate && (
              <Button variant="ghost" size="sm" onClick={async () => { await onDuplicate(appointment); onClose(); }} disabled={loading} className="h-8 text-xs text-muted-foreground hover:text-foreground">
                <Copy className="h-3.5 w-3.5 mr-1" />Duplizieren (+7 Tage)
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="h-8">Schließen</Button>
            {hasChanges && (
              <Button size="sm" onClick={handleSave} disabled={loading || erstgespraechRoleConflict} className="h-8">
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
              <div>
                <Label className="text-xs">Absagezeitpunkt <span className="text-destructive">*</span></Label>
                <Input type="datetime-local" value={cancelAbsageDatum} onChange={(e) => setCancelAbsageDatum(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Absagekanal <span className="text-destructive">*</span></Label>
                <Select value={cancelAbsageKanal} onValueChange={setCancelAbsageKanal}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                  <SelectContent>
                    {['Anruf MA', 'Anruf Büro', 'Email', 'WhatsApp', 'Sonstiges'].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
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

    {/* Verfügbarkeits-Bestätigung */}
    <AlertDialog open={showVerfuegbarkeitConfirm} onOpenChange={setShowVerfuegbarkeitConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Außerhalb der Verfügbarkeit</AlertDialogTitle>
          <AlertDialogDescription>
            {(() => {
              const check = checkVerfuegbarkeit(
                editedAppointment?.mitarbeiter_id ?? null,
                editedAppointment?.start_at ?? '',
                editedAppointment?.end_at ?? '',
                allVerfuegbarkeiten,
              );
              if (!check.hasEntries) return 'Für diesen Mitarbeiter sind keine Verfügbarkeiten hinterlegt.';
              return check.noEntryForDay
                ? 'Der Mitarbeiter ist an diesem Wochentag laut Verfügbarkeit nicht verfügbar.'
                : 'Der Termin liegt außerhalb der eingetragenen Verfügbarkeitszeit des Mitarbeiters.';
            })()} Trotzdem speichern?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={() => { setShowVerfuegbarkeitConfirm(false); proceedWithSave(); }}>
            Trotzdem speichern
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <KundenDetailDialog isOpen={showKundenDetail} onClose={() => setShowKundenDetail(false)} kundenId={editedAppointment?.kunden_id || null} />
    </>
  );
}
