import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, getDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { Clock, User, Phone, Mail, MapPin, Edit, Save, X, AlertTriangle, Trash2, AlertCircle, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CreateRecurringAppointmentDialog } from './CreateRecurringAppointmentDialog';
import { KundenDetailDialog } from '@/components/customers/KundenDetailDialog';
import { useUserRole } from '@/hooks/useUserRole';
import type { Employee, Customer, Appointment, CustomerTimeWindow } from '@/types/domain';

// Types imported from @/types/domain

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

export function AppointmentDetailDialog({ 
  isOpen, 
  onClose, 
  appointment, 
  employees, 
  customers, 
  onUpdate,
  onDelete,
  isConflicting = false,
  customerTimeWindows = []
}: AppointmentDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
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
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [showCustomerFaultDialog, setShowCustomerFaultDialog] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [customerFaultNote, setCustomerFaultNote] = useState('');
  const [showKundenDetail, setShowKundenDetail] = useState(false);
  const { toast } = useToast();
  const { isGeschaeftsfuehrer, isAdmin } = useUserRole();

  React.useEffect(() => {
    if (appointment) {
      setEditedAppointment({ ...appointment });
    }
  }, [appointment]);

  if (!appointment || !editedAppointment) return null;

  // Check if appointment is outside customer time windows
  const isOutsideTimeWindow = () => {
    if (!customerTimeWindows || customerTimeWindows.length === 0) return false;
    
    const appointmentStart = new Date(editedAppointment.start_at);
    const appointmentEnd = new Date(editedAppointment.end_at);
    const dayOfWeek = getDay(appointmentStart); // 0 = Sunday, 1 = Monday, etc.
    const startTime = format(appointmentStart, 'HH:mm');
    const endTime = format(appointmentEnd, 'HH:mm');

    // Check if there's a matching time window for this day
    const matchingWindows = customerTimeWindows.filter(tw => tw.wochentag === dayOfWeek);
    
    if (matchingWindows.length === 0) return true; // No time window defined for this day

    // Check if appointment fits in any of the windows
    const fitsInWindow = matchingWindows.some(tw => {
      return startTime >= tw.von && endTime <= tw.bis;
    });

    return !fitsInWindow;
  };

  const timeWindowWarning = isOutsideTimeWindow();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unassigned':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'scheduled':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'completed':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'cancelled':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'nicht_angetroffen':
        return 'bg-amber-50 border-amber-300 text-amber-900';
      case 'abgesagt_rechtzeitig':
        return 'bg-slate-50 border-slate-200 text-slate-700';
      case 'abgerechnet':
        return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      case 'bezahlt':
        return 'bg-teal-50 border-teal-200 text-teal-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      unassigned: 'Unzugewiesen',
      scheduled: 'Geplant',
      in_progress: 'In Bearbeitung',
      completed: 'Abgeschlossen',
      cancelled: 'Abgesagt',
      nicht_angetroffen: 'Nicht angetroffen',
      abgesagt_rechtzeitig: 'Rechtzeitig abgesagt',
      abgerechnet: 'Abgerechnet',
      bezahlt: 'Bezahlt'
    };
    return variants[status] || 'Unbekannt';
  };

  const handleSave = async () => {
    if (!editedAppointment) return;
    
    // Check if this is part of a recurring series
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
      // If user chose to update only this appointment, mark as exception
      if (seriesAction === 'single' && editedAppointment.vorlage_id) {
        await onUpdate({
          ...editedAppointment,
          ist_ausnahme: true,
          ausnahme_grund: 'Manuelle Änderung durch Benutzer'
        });
      } else {
        await onUpdate(editedAppointment);
      }
      setIsEditing(false);
      setShowSeriesDialog(false);
    } catch (error: any) {
      // Error handling is done in onUpdate callback
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedAppointment({ ...appointment });
    setIsEditing(false);
  };

  const handleDeleteClick = () => {
    // Check if this is part of a recurring series
    if (appointment.vorlage_id && !appointment.ist_ausnahme) {
      setDeleteSeriesAction('single');
      setShowDeleteSeriesDialog(true);
    } else {
      setShowDeleteDialog(true);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete(appointment.id);
      setShowDeleteDialog(false);
      onClose();
    } catch (error: any) {
      // Error handling is done in onDelete callback
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSeries = async () => {
    setLoading(true);
    try {
      if (deleteSeriesAction === 'single') {
        // Delete only this appointment
        await onDelete(appointment.id);
      } else {
        // Delete the entire series (template and all future appointments)
        if (appointment.vorlage_id) {
          // First deactivate the template
          const { error: templateError } = await supabase
            .from('termin_vorlagen')
            .update({ ist_aktiv: false })
            .eq('id', appointment.vorlage_id);

          if (templateError) throw templateError;

          // Delete all future appointments from this series
          const { error: appointmentsError } = await supabase
            .from('termine')
            .delete()
            .eq('vorlage_id', appointment.vorlage_id)
            .gte('start_at', new Date().toISOString());

          if (appointmentsError) throw appointmentsError;

          toast({
            title: 'Erfolg',
            description: 'Die Terminserie wurde gelöscht.',
          });
        }
      }
      setShowDeleteSeriesDialog(false);
      onClose();
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: 'Fehler beim Löschen: ' + error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditTemplate = async () => {
    if (!editedAppointment?.vorlage_id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('termin_vorlagen')
        .select('*')
        .eq('id', editedAppointment.vorlage_id)
        .single();

      if (error) throw error;

      if (data) {
        setTemplateData(data);
        setShowEditTemplateDialog(true);
      }
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: 'Vorlage konnte nicht geladen werden: ' + error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateUpdate = async (template: any) => {
    if (!editedAppointment?.vorlage_id) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('termin_vorlagen')
        .update({
          titel: template.titel,
          kunden_id: template.kunden_id,
          mitarbeiter_id: template.mitarbeiter_id,
          wochentag: template.wochentag,
          start_zeit: template.start_zeit,
          dauer_minuten: template.dauer_minuten,
          intervall: template.intervall,
          gueltig_von: template.gueltig_von,
          gueltig_bis: template.gueltig_bis,
          notizen: template.notizen,
        })
        .eq('id', editedAppointment.vorlage_id);

      if (error) throw error;

      toast({
        title: 'Erfolg',
        description: 'Die Terminvorlage wurde aktualisiert. Zukünftige Termine werden entsprechend angepasst.',
      });

      setShowEditTemplateDialog(false);
      onClose();
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: 'Vorlage konnte nicht aktualisiert werden: ' + error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!editedAppointment) return;
    
    setLoading(true);
    try {
      await onUpdate({
        ...editedAppointment,
        status: 'cancelled'
      });
      
      toast({
        title: 'Erfolg',
        description: 'Der Termin wurde abgesagt.',
      });
      
      setShowCancelDialog(false);
      onClose();
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: 'Termin konnte nicht abgesagt werden.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!editedAppointment || !rescheduleDate || !rescheduleTime) {
      toast({
        title: 'Fehler',
        description: 'Bitte Datum und Uhrzeit angeben.',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    try {
      const currentStart = new Date(editedAppointment.start_at);
      const currentEnd = new Date(editedAppointment.end_at);
      const duration = currentEnd.getTime() - currentStart.getTime();
      
      const [hours, minutes] = rescheduleTime.split(':');
      const newStart = new Date(rescheduleDate);
      newStart.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const newEnd = new Date(newStart.getTime() + duration);
      
      await onUpdate({
        ...editedAppointment,
        start_at: newStart.toISOString(),
        end_at: newEnd.toISOString()
      });
      
      toast({
        title: 'Erfolg',
        description: 'Der Termin wurde verschoben.',
      });
      
      setShowRescheduleDialog(false);
      setRescheduleDate('');
      setRescheduleTime('');
      onClose();
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: 'Termin konnte nicht verschoben werden.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerFault = async () => {
    if (!editedAppointment) return;
    
    setLoading(true);
    try {
      await onUpdate({
        ...editedAppointment,
        status: 'nicht_angetroffen' as any,
        ausnahme_grund: `Nicht angetroffen (eigenverschuldet)${customerFaultNote ? ': ' + customerFaultNote : ''}`
      });
      
      toast({
        title: 'Erfolg',
        description: 'Der Termin wurde als "Nicht angetroffen" markiert (wird abgerechnet).',
      });
      
      setShowCustomerFaultDialog(false);
      setCustomerFaultNote('');
      onClose();
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: 'Aktion konnte nicht durchgeführt werden.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTimelyCancel = async () => {
    if (!editedAppointment) return;
    
    setLoading(true);
    try {
      await onUpdate({
        ...editedAppointment,
        status: 'abgesagt_rechtzeitig' as any,
      });
      
      toast({
        title: 'Erfolg',
        description: 'Der Termin wurde als "Rechtzeitig abgesagt" markiert.',
      });
      
      onClose();
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: 'Aktion konnte nicht durchgeführt werden.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Termindetails
            {editedAppointment.vorlage_id && !editedAppointment.ist_ausnahme && (
              <Badge variant="outline" className="ml-2">
                <Repeat className="h-3 w-3 mr-1" />
                Serie
              </Badge>
            )}
            {isConflicting && (
              <Badge variant="destructive" className="ml-auto">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Konflikt
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">Details eines einzelnen Termins anzeigen und bearbeiten</DialogDescription>
        </DialogHeader>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 pt-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCancelDialog(true)}
            disabled={loading || ['cancelled', 'nicht_angetroffen', 'abgesagt_rechtzeitig'].includes(editedAppointment.status)}
            className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 hover:border-red-300 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60"
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Absagen
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const startDate = new Date(editedAppointment.start_at);
              setRescheduleDate(format(startDate, 'yyyy-MM-dd'));
              setRescheduleTime(format(startDate, 'HH:mm'));
              setShowRescheduleDialog(true);
            }}
            disabled={loading || ['cancelled', 'nicht_angetroffen', 'abgesagt_rechtzeitig'].includes(editedAppointment.status)}
            className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 hover:border-blue-300 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-950/60"
          >
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            Verschieben
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCustomerFaultDialog(true)}
            disabled={loading || ['cancelled', 'nicht_angetroffen', 'abgesagt_rechtzeitig'].includes(editedAppointment.status)}
            className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 hover:border-amber-300 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-950/60"
          >
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
            Nicht angetroffen
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTimelyCancel}
            disabled={loading || ['cancelled', 'nicht_angetroffen', 'abgesagt_rechtzeitig'].includes(editedAppointment.status)}
            className="border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-800 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400 dark:hover:bg-slate-800/60"
          >
            <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
            Rechtzeitig abgesagt
          </Button>
        </div>

        <div className="space-y-6">
          {/* Status and Basic Info */}
          <Card className={cn('border', getStatusColor(editedAppointment.status))}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Badge variant="outline" className="text-sm">
                  {getStatusBadge(editedAppointment.status)}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  disabled={loading}
                  className="flex items-center gap-1"
                >
                  {isEditing ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                  {isEditing ? 'Abbrechen' : 'Bearbeiten'}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  {isEditing ? (
                    <Select
                      value={editedAppointment.status}
                      onValueChange={(value: any) => setEditedAppointment({
                        ...editedAppointment,
                        status: value
                      })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unzugewiesen</SelectItem>
                        <SelectItem value="scheduled">Geplant</SelectItem>
                        <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                        <SelectItem value="completed">Abgeschlossen</SelectItem>
                        <SelectItem value="cancelled">Abgesagt</SelectItem>
                        <SelectItem value="nicht_angetroffen">Nicht angetroffen</SelectItem>
                        <SelectItem value="abgesagt_rechtzeitig">Rechtzeitig abgesagt</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm font-medium mt-1">{getStatusBadge(editedAppointment.status)}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time Information */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Zeitplan
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Startzeit</Label>
                  <p className="text-sm font-medium mt-1">
                    {format(new Date(editedAppointment.start_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Endzeit</Label>
                  <p className="text-sm font-medium mt-1">
                    {format(new Date(editedAppointment.end_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t">
                <Label className="text-sm font-medium text-muted-foreground">Dauer</Label>
                <p className="text-sm font-medium mt-1">
                  {Math.round((new Date(editedAppointment.end_at).getTime() - new Date(editedAppointment.start_at).getTime()) / (1000 * 60))} Minuten
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Customer Information */}
          {editedAppointment.customer && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Kunde
                </h3>
                <div className="space-y-2">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                    {isEditing ? (
                      <Select
                        value={editedAppointment.kunden_id}
                        onValueChange={(value) => setEditedAppointment({
                          ...editedAppointment,
                          kunden_id: value
                        })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm font-medium mt-1">
                        {editedAppointment.customer.name}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">E-Mail</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <p className="text-sm">{editedAppointment.customer.email}</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Telefon</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <p className="text-sm">{editedAppointment.customer.telefonnr}</p>
                      </div>
                    </div>
                  </div>
                  {/* Address with Google Maps link */}
                  {(editedAppointment.customer?.strasse || editedAppointment.customer?.stadt) && (
                    <div className="mt-3">
                      <Label className="text-sm font-medium text-muted-foreground">Adresse</Label>
                      <div className="flex items-start gap-2 mt-1">
                        <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm">
                            {[editedAppointment.customer.strasse, [editedAppointment.customer.plz, editedAppointment.customer.stadt].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                            {editedAppointment.customer.stadtteil && (
                              <span className="text-muted-foreground"> ({editedAppointment.customer.stadtteil})</span>
                            )}
                          </p>
                          <a
                            href={`https://maps.google.com/?q=${encodeURIComponent([editedAppointment.customer.strasse, editedAppointment.customer.plz, editedAppointment.customer.stadt].filter(Boolean).join(' '))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline mt-0.5 inline-block"
                          >
                            In Google Maps öffnen →
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {(isGeschaeftsfuehrer || isAdmin) && (
                  <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setShowKundenDetail(true)}>
                    Kundendetails anzeigen
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Employee Information */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Zugewiesener Mitarbeiter
              </h3>
              {editedAppointment.mitarbeiter_id ? (
                <div>
                  {isEditing ? (
                    <Select
                      value={editedAppointment.mitarbeiter_id || "unassigned"}
                      onValueChange={(value) => setEditedAppointment({
                        ...editedAppointment,
                        mitarbeiter_id: value === "unassigned" ? null : value
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Nicht zugewiesen</SelectItem>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: employee.farbe_kalender }}
                              />
                              {employee.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    editedAppointment.employee && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: editedAppointment.employee.farbe_kalender }}
                          />
                          <p className="text-sm font-medium">{editedAppointment.employee.name}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            {editedAppointment.employee.benutzer?.email || 'Keine E-Mail'}
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            {editedAppointment.employee.telefon}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Kein Mitarbeiter zugewiesen</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Time Window Warning */}
          {timeWindowWarning && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-orange-800">
                  <AlertCircle className="h-4 w-4" />
                  <h3 className="font-medium">Außerhalb Kundenzeitfenster</h3>
                </div>
                <p className="text-sm text-orange-700 mt-2">
                  Dieser Termin liegt außerhalb der bevorzugten Zeitfenster des Kunden. Der Kunde hat möglicherweise zu dieser Zeit keine Verfügbarkeit angegeben.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Conflict Warning */}
          {isConflicting && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertTriangle className="h-4 w-4" />
                  <h3 className="font-medium">Terminkonflikt erkannt</h3>
                </div>
                <p className="text-sm text-red-700 mt-2">
                  Dieser Termin überschneidet sich zeitlich mit anderen Terminen des zugewiesenen Mitarbeiters.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2">
          {!isEditing && (
            <>
              <Button 
                variant="destructive" 
                onClick={handleDeleteClick}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Löschen
              </Button>
              {editedAppointment.vorlage_id && !editedAppointment.ist_ausnahme && (
                <Button 
                  variant="outline"
                  onClick={handleEditTemplate}
                  disabled={loading}
                >
                  <Repeat className="h-4 w-4 mr-2" />
                  Serie bearbeiten
                </Button>
              )}
            </>
          )}
          <Button variant="outline" onClick={onClose}>
            Schließen
          </Button>
          {isEditing && (
            <>
              <Button variant="outline" onClick={handleCancel}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Speichern
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Termin wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Der Termin "{appointment.titel}" 
              am {format(new Date(appointment.start_at), 'dd.MM.yyyy', { locale: de })} 
              wird dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? 'Wird gelöscht...' : 'Termin löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Series Dialog */}
      <AlertDialog open={showDeleteSeriesDialog} onOpenChange={setShowDeleteSeriesDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Serientermin löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Termin ist Teil einer Terminserie. Was möchten Sie löschen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-4">
            <button
              onClick={() => setDeleteSeriesAction('single')}
              className={cn(
                "w-full p-4 text-left rounded-lg border-2 transition-colors",
                deleteSeriesAction === 'single' 
                  ? "border-destructive bg-destructive/5" 
                  : "border-border hover:border-destructive/50"
              )}
            >
              <div className="font-medium">Nur diesen Termin</div>
              <div className="text-sm text-muted-foreground mt-1">
                Nur dieser einzelne Termin wird gelöscht. Die Serie wird normal fortgesetzt.
              </div>
            </button>
            <button
              onClick={() => setDeleteSeriesAction('all')}
              className={cn(
                "w-full p-4 text-left rounded-lg border-2 transition-colors",
                deleteSeriesAction === 'all' 
                  ? "border-destructive bg-destructive/5" 
                  : "border-border hover:border-destructive/50"
              )}
            >
              <div className="font-medium">Gesamte Serie löschen</div>
              <div className="text-sm text-muted-foreground mt-1">
                Die Vorlage wird deaktiviert und alle zukünftigen Termine dieser Serie werden gelöscht.
              </div>
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSeries} 
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
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
            <AlertDialogDescription>
              Dieser Termin ist Teil einer Terminserie. Möchten Sie nur diesen einzelnen Termin oder die gesamte Serie ändern?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-4">
            <button
              onClick={() => setSeriesAction('single')}
              className={cn(
                "w-full p-4 text-left rounded-lg border-2 transition-colors",
                seriesAction === 'single' 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="font-medium">Nur diesen Termin</div>
              <div className="text-sm text-muted-foreground mt-1">
                Die Serie wird normal fortgesetzt. Dieser Termin wird als Ausnahme markiert.
              </div>
            </button>
            <button
              onClick={() => setSeriesAction('all')}
              className={cn(
                "w-full p-4 text-left rounded-lg border-2 transition-colors",
                seriesAction === 'all' 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="font-medium">Alle zukünftigen Termine</div>
              <div className="text-sm text-muted-foreground mt-1">
                Ändert die Vorlage und betrifft alle zukünftigen Termine dieser Serie.
              </div>
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={performSave} disabled={loading}>
              {loading ? 'Wird gespeichert...' : 'Änderungen übernehmen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Template Dialog */}
      {templateData && (
        <CreateRecurringAppointmentDialog
          open={showEditTemplateDialog}
          onOpenChange={setShowEditTemplateDialog}
          customers={customers}
          employees={employees}
          onSubmit={handleTemplateUpdate}
          editingTemplate={templateData}
        />
      )}

      {/* Cancel Appointment Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Termin absagen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie den Termin wirklich absagen? Der Status wird auf "Abgesagt" gesetzt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelAppointment} 
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? 'Wird abgesagt...' : 'Termin absagen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule Appointment Dialog */}
      <AlertDialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Termin verschieben</AlertDialogTitle>
            <AlertDialogDescription>
              Geben Sie das neue Datum und die neue Uhrzeit für den Termin an.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reschedule-date">Neues Datum</Label>
              <Input
                id="reschedule-date"
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reschedule-time">Neue Uhrzeit</Label>
              <Input
                id="reschedule-time"
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReschedule} 
              disabled={loading || !rescheduleDate || !rescheduleTime}
            >
              {loading ? 'Wird verschoben...' : 'Termin verschieben'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Customer Fault Dialog */}
      <AlertDialog open={showCustomerFaultDialog} onOpenChange={setShowCustomerFaultDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nicht geklappt zuschulden des Kunden</AlertDialogTitle>
            <AlertDialogDescription>
              Der Termin wird als abgesagt markiert und mit dem Vermerk "Nicht geklappt zuschulden des Kunden" versehen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customer-fault-note">Optionale Notiz</Label>
              <Textarea
                id="customer-fault-note"
                placeholder="z.B. Kunde war nicht zu Hause, Kunde hat vergessen..."
                value={customerFaultNote}
                onChange={(e) => setCustomerFaultNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCustomerFault} 
              disabled={loading}
            >
              {loading ? 'Wird gespeichert...' : 'Markieren'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>

    <KundenDetailDialog
      isOpen={showKundenDetail}
      onClose={() => setShowKundenDetail(false)}
      kundenId={editedAppointment?.kunden_id || null}
    />
    </>
  );
}