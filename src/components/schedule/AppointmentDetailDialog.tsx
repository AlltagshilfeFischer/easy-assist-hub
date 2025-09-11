import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Clock, User, Phone, Mail, MapPin, Edit, Save, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Employee {
  id: string;
  vorname: string;
  nachname: string;
  name: string;
  email: string;
  telefon: string;
  farbe_kalender: string;
}

interface Customer {
  id: string;
  vorname: string;
  nachname: string;
  email: string;
  telefon: string;
}

interface Appointment {
  id: string;
  titel: string;
  kunden_id: string;
  mitarbeiter_id: string | null;
  start_at: string;
  end_at: string;
  status: 'unassigned' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  customer?: Customer;
  employee?: Employee;
}

interface AppointmentDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  employees: Employee[];
  customers: Customer[];
  onUpdate: (appointment: Appointment) => Promise<void>;
  isConflicting?: boolean;
}

export function AppointmentDetailDialog({ 
  isOpen, 
  onClose, 
  appointment, 
  employees, 
  customers, 
  onUpdate,
  isConflicting = false
}: AppointmentDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedAppointment, setEditedAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (appointment) {
      setEditedAppointment({ ...appointment });
    }
  }, [appointment]);

  if (!appointment || !editedAppointment) return null;

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
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      unassigned: 'Unzugewiesen',
      scheduled: 'Geplant',
      in_progress: 'In Bearbeitung',
      completed: 'Abgeschlossen',
      cancelled: 'Abgesagt'
    };
    return variants[status as keyof typeof variants] || 'Unbekannt';
  };

  const handleSave = async () => {
    if (!editedAppointment) return;
    
    setLoading(true);
    try {
      await onUpdate(editedAppointment);
      setIsEditing(false);
      toast({
        title: 'Erfolg',
        description: 'Termin wurde erfolgreich aktualisiert.',
      });
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Termin konnte nicht aktualisiert werden.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedAppointment({ ...appointment });
    setIsEditing(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Termindetails
            {isConflicting && (
              <Badge variant="destructive" className="ml-auto">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Konflikt
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

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
                  <Label className="text-sm font-medium text-muted-foreground">Titel</Label>
                  {isEditing ? (
                    <Input
                      value={editedAppointment.titel}
                      onChange={(e) => setEditedAppointment({
                        ...editedAppointment,
                        titel: e.target.value
                      })}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-sm font-medium mt-1">{editedAppointment.titel}</p>
                  )}
                </div>

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
                    <p className="text-sm font-medium mt-1">
                      {editedAppointment.customer.vorname} {editedAppointment.customer.nachname}
                    </p>
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
                        <p className="text-sm">{editedAppointment.customer.telefon}</p>
                      </div>
                    </div>
                  </div>
                </div>
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
                      value={editedAppointment.mitarbeiter_id}
                      onValueChange={(value) => setEditedAppointment({
                        ...editedAppointment,
                        mitarbeiter_id: value
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nicht zugewiesen</SelectItem>
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
                            {editedAppointment.employee.email}
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
    </Dialog>
  );
}