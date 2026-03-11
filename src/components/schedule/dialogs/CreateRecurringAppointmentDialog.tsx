import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock, Repeat } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { CustomerSearchCombobox } from '../CustomerSearchCombobox';
import { TIME_SLOTS, DURATION_OPTIONS } from '../timeSlots';
import type { CustomerSummary, EmployeeSummary, TerminVorlage } from '@/types/domain';

type RecurringTemplate = Partial<Pick<TerminVorlage, 'id' | 'ist_aktiv'>> & Omit<TerminVorlage, 'id' | 'ist_aktiv'>;

interface CreateRecurringAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: CustomerSummary[];
  employees: EmployeeSummary[];
  onSubmit: (template: RecurringTemplate) => Promise<void>;
  editingTemplate?: RecurringTemplate | null;
}

const WEEKDAYS = [
  { value: 1, label: 'Montag' },
  { value: 2, label: 'Dienstag' },
  { value: 3, label: 'Mittwoch' },
  { value: 4, label: 'Donnerstag' },
  { value: 5, label: 'Freitag' },
  { value: 6, label: 'Samstag' },
  { value: 0, label: 'Sonntag' },
];

const INTERVALS = [
  { value: 'weekly', label: 'Wöchentlich' },
  { value: 'biweekly', label: 'Zweiwöchentlich' },
  { value: 'monthly', label: 'Monatlich' },
];

export function CreateRecurringAppointmentDialog({
  open,
  onOpenChange,
  customers,
  employees,
  onSubmit,
  editingTemplate = null,
}: CreateRecurringAppointmentDialogProps) {
  const [kundenId, setKundenId] = useState('');
  const [mitarbeiterId, setMitarbeiterId] = useState<string>('unassigned');
  const [wochentag, setWochentag] = useState<number>(1);
  const [startZeit, setStartZeit] = useState('09:00');
  const [dauerMinuten, setDauerMinuten] = useState(90);
  const [intervall, setIntervall] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [gueltigVon, setGueltigVon] = useState<Date>();
  const [gueltigBis, setGueltigBis] = useState<Date>();
  const [notizen, setNotizen] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (editingTemplate) {
      setKundenId(editingTemplate.kunden_id);
      setMitarbeiterId(editingTemplate.mitarbeiter_id || 'unassigned');
      setWochentag(editingTemplate.wochentag);
      setStartZeit(editingTemplate.start_zeit);
      setDauerMinuten(editingTemplate.dauer_minuten);
      setIntervall(editingTemplate.intervall as 'weekly' | 'biweekly' | 'monthly');
      setGueltigVon(new Date(editingTemplate.gueltig_von));
      setGueltigBis(editingTemplate.gueltig_bis ? new Date(editingTemplate.gueltig_bis) : undefined);
      setNotizen(editingTemplate.notizen || '');
    }
  }, [editingTemplate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gueltigVon || !kundenId) return;

    setLoading(true);
    try {
      let endDate: Date;
      if (gueltigBis) {
        endDate = gueltigBis;
      } else {
        const tenYearsLater = new Date(gueltigVon);
        tenYearsLater.setFullYear(tenYearsLater.getFullYear() + 10);
        const maxDate = new Date('2036-12-31');
        endDate = tenYearsLater > maxDate ? maxDate : tenYearsLater;
      }

      const customerName = customers.find(c => c.id === kundenId)?.name || 'Unbekannt';

      await onSubmit({
        ...(editingTemplate?.id && { id: editingTemplate.id }),
        titel: customerName,
        kunden_id: kundenId,
        mitarbeiter_id: mitarbeiterId === 'unassigned' ? null : mitarbeiterId || null,
        wochentag,
        start_zeit: startZeit,
        dauer_minuten: dauerMinuten,
        intervall,
        gueltig_von: format(gueltigVon, 'yyyy-MM-dd'),
        gueltig_bis: format(endDate, 'yyyy-MM-dd'),
        notizen: notizen || null,
      });

      setKundenId('');
      setMitarbeiterId('unassigned');
      setWochentag(1);
      setStartZeit('09:00');
      setDauerMinuten(90);
      setIntervall('weekly');
      setGueltigVon(undefined);
      setGueltigBis(undefined);
      setNotizen('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating recurring appointment:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto z-[201]" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            {editingTemplate ? 'Regeltermin bearbeiten' : 'Regeltermin erstellen'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {editingTemplate ? 'Wiederkehrende Terminvorlage bearbeiten' : 'Wiederkehrende Terminvorlage erstellen'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kunde">Kunde</Label>
              <CustomerSearchCombobox customers={customers} value={kundenId} onValueChange={setKundenId} placeholder="Kunde suchen..." />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mitarbeiter">Mitarbeiter (optional)</Label>
            <Select value={mitarbeiterId} onValueChange={setMitarbeiterId}>
              <SelectTrigger><SelectValue placeholder="Nicht zugewiesen (später zuweisen)" /></SelectTrigger>
              <SelectContent className="z-[202]">
                <SelectItem value="unassigned">Nicht zugewiesen</SelectItem>
                {employees.filter((emp) => emp).map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>{employee.vorname} {employee.nachname}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wochentag">Wochentag</Label>
              <Select value={wochentag.toString()} onValueChange={(val) => setWochentag(Number(val))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-[202]">
                  {WEEKDAYS.map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>{day.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="intervall">Wiederholung</Label>
              <Select value={intervall} onValueChange={(val: any) => setIntervall(val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-[202]">
                  {INTERVALS.map((int) => (
                    <SelectItem key={int.value} value={int.value}>{int.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Uhrzeit</Label>
              <Select value={startZeit} onValueChange={setStartZeit}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[202] max-h-[300px]">
                  {TIME_SLOTS.map(slot => (
                    <SelectItem key={slot} value={slot}>{slot} Uhr</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dauer</Label>
              <Select value={dauerMinuten.toString()} onValueChange={(v) => setDauerMinuten(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-[202]">
                  {DURATION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Gültig von</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !gueltigVon && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {gueltigVon ? format(gueltigVon, 'PPP', { locale: de }) : 'Datum wählen'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[202]" align="start">
                  <Calendar mode="single" selected={gueltigVon} onSelect={setGueltigVon} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Gültig bis (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !gueltigBis && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {gueltigBis ? format(gueltigBis, 'PPP', { locale: de }) : 'Unbegrenzt'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[202]" align="start">
                  <Calendar mode="single" selected={gueltigBis} onSelect={setGueltigBis} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notizen">Notizen (optional)</Label>
            <Textarea id="notizen" value={notizen} onChange={(e) => setNotizen(e.target.value)} placeholder="Zusätzliche Informationen..." rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" disabled={loading || !gueltigVon || !kundenId}>
              {loading ? (editingTemplate ? 'Speichere...' : 'Erstelle...') : (editingTemplate ? 'Änderungen speichern' : 'Regeltermin erstellen')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
