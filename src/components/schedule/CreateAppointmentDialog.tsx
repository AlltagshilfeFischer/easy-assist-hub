import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CustomerSearchCombobox } from './CustomerSearchCombobox';

interface Customer {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  vorname?: string;
  nachname?: string;
}

interface CreateAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  employees: Employee[];
  onSubmit: (appointment: {
    titel: string;
    kunden_id: string;
    mitarbeiter_id: string | null;
    start_at: string;
    end_at: string;
  }) => Promise<void>;
}

export function CreateAppointmentDialog({
  open,
  onOpenChange,
  customers,
  employees,
  onSubmit,
}: CreateAppointmentDialogProps) {
  const [titel, setTitel] = useState('');
  const [kundenId, setKundenId] = useState('');
  const [mitarbeiterId, setMitarbeiterId] = useState<string>('unassigned');
  const [date, setDate] = useState<Date>();
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [loading, setLoading] = useState(false);
  const [isNewInteressent, setIsNewInteressent] = useState(false);
  const [newInteressentName, setNewInteressentName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || (!kundenId && !isNewInteressent) || (isNewInteressent && !newInteressentName.trim())) return;

    setLoading(true);
    try {
      let finalKundenId = kundenId;

      // If creating new Interessent, create them first
      if (isNewInteressent && newInteressentName.trim()) {
        const { supabase } = await import('@/integrations/supabase/client');
        
        // Split name into vorname and nachname (first word = vorname, rest = nachname)
        const nameParts = newInteressentName.trim().split(' ');
        const vorname = nameParts[0];
        const nachname = nameParts.slice(1).join(' ') || '';
        
        const { data: newKunde, error: kundeError } = await supabase
          .from('kunden')
          .insert([{
            vorname: vorname,
            nachname: nachname,
            kategorie: 'Interessent',
            aktiv: true
          }])
          .select()
          .single();

        if (kundeError) throw kundeError;
        finalKundenId = newKunde.id;
      }

      const startAt = new Date(date);
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      startAt.setHours(startHours, startMinutes, 0, 0);

      const endAt = new Date(date);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      endAt.setHours(endHours, endMinutes, 0, 0);

      await onSubmit({
        titel,
        kunden_id: finalKundenId,
        mitarbeiter_id: mitarbeiterId === 'unassigned' ? null : mitarbeiterId || null,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
      });

      // Reset form
      setTitel('');
      setKundenId('');
      setMitarbeiterId('unassigned');
      setDate(undefined);
      setStartTime('09:00');
      setEndTime('10:00');
      setIsNewInteressent(false);
      setNewInteressentName('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating appointment:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Neuen Termin erstellen</DialogTitle>
          <p className="sr-only" id="create-appointment-desc">Einzeltermin mit Datum und Uhrzeit anlegen</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="titel">Titel</Label>
              <Input
                id="titel"
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
                placeholder="z.B. Hausbesuch"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kunde">Kunde / Interessent</Label>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant={!isNewInteressent ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsNewInteressent(false)}
                >
                  Bestandskunde
                </Button>
                <Button
                  type="button"
                  variant={isNewInteressent ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsNewInteressent(true)}
                >
                  Neuer Interessent
                </Button>
              </div>
              {!isNewInteressent ? (
                <CustomerSearchCombobox
                  customers={customers}
                  value={kundenId}
                  onValueChange={setKundenId}
                  placeholder="Kunde suchen..."
                />
              ) : (
                <Input
                  value={newInteressentName}
                  onChange={(e) => setNewInteressentName(e.target.value)}
                  placeholder="Name des Interessenten eingeben..."
                  required
                />
              )}
            </div>
          </div>

            <div className="space-y-2">
              <Label htmlFor="mitarbeiter">Mitarbeiter (optional)</Label>
              <Select value={mitarbeiterId} onValueChange={setMitarbeiterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nicht zugewiesen (später zuweisen)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Nicht zugewiesen</SelectItem>
                  {employees
                    .filter((emp) => emp)
                    .map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.vorname} {employee.nachname}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

          <div className="space-y-2">
            <Label>Datum</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP', { locale: de }) : 'Datum wählen'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start-Zeit</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End-Zeit</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !date || (!kundenId && !isNewInteressent) || (isNewInteressent && !newInteressentName.trim())}
            >
              {loading ? 'Erstelle...' : isNewInteressent ? 'Interessent & Termin erstellen' : 'Termin erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
