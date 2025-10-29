import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface ConflictingAppointment {
  id: string;
  titel: string;
  start_at: string;
  end_at: string;
  customer?: {
    vorname: string;
    nachname: string;
  };
}

interface ConflictWarningDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  employeeName: string;
  appointmentTitle: string;
  conflictingAppointments: ConflictingAppointment[];
  newAppointmentTime: {
    start: string;
    end: string;
  };
}

export function ConflictWarningDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  employeeName, 
  appointmentTitle,
  conflictingAppointments,
  newAppointmentTime
}: ConflictWarningDialogProps) {
  // Validate that we have valid date strings
  const isValidTimeData = newAppointmentTime.start && 
                         newAppointmentTime.end && 
                         !isNaN(new Date(newAppointmentTime.start).getTime()) &&
                         !isNaN(new Date(newAppointmentTime.end).getTime());

  if (!isValidTimeData) {
    return null; // Don't render if we don't have valid time data
  }
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-5 w-5" />
            Terminkonflikt erkannt
          </DialogTitle>
          <DialogDescription className="sr-only">Konfliktwarnung beim Zuweisen eines Termins</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-sm font-medium text-orange-900 mb-2">
              Der Termin überschneidet sich mit {conflictingAppointments.length} anderen Termin(en):
            </p>
            
            <div className="space-y-2">
              <div className="bg-white rounded border p-2">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    Neuer Termin
                  </Badge>
                </div>
                <p className="text-sm font-medium">{appointmentTitle}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {format(new Date(newAppointmentTime.start), 'dd.MM.yyyy HH:mm', { locale: de })} - 
                  {format(new Date(newAppointmentTime.end), 'HH:mm', { locale: de })}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  {employeeName}
                </div>
              </div>

              {conflictingAppointments
                .filter(conflict => conflict.start_at && conflict.end_at && 
                        !isNaN(new Date(conflict.start_at).getTime()) && 
                        !isNaN(new Date(conflict.end_at).getTime()))
                .map((conflict) => (
                <div key={conflict.id} className="bg-white rounded border border-red-200 p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="destructive" className="text-xs">
                      Konflikt
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">{conflict.titel}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(conflict.start_at), 'dd.MM.yyyy HH:mm', { locale: de })} - 
                    {format(new Date(conflict.end_at), 'HH:mm', { locale: de })}
                  </div>
                  {conflict.customer && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      {conflict.customer.vorname} {conflict.customer.nachname}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>Warnung:</strong> Die Zuweisung dieses Termins würde zu einem Terminkonflikt führen. 
              Möchten Sie den Termin trotzdem zuweisen?
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="default" onClick={onConfirm} className="bg-orange-600 hover:bg-orange-700">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Trotzdem zuweisen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}