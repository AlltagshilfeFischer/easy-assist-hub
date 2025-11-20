import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarIcon, Clock, Repeat, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CustomerSearchCombobox } from './CustomerSearchCombobox';

interface Customer {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  name: string;
}

interface CreateAppointmentFromSlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefilledData: {
    employeeId: string;
    date: Date;
  };
  customers: Customer[];
  employees: Employee[];
  onSubmitSingle: (data: any) => Promise<void>;
  onSubmitRecurring: (data: any) => Promise<void>;
}

const WEEKDAYS = [
  { value: 0, label: 'Sonntag' },
  { value: 1, label: 'Montag' },
  { value: 2, label: 'Dienstag' },
  { value: 3, label: 'Mittwoch' },
  { value: 4, label: 'Donnerstag' },
  { value: 5, label: 'Freitag' },
  { value: 6, label: 'Samstag' },
];

const INTERVALS = [
  { value: 'weekly', label: 'Wöchentlich' },
  { value: 'biweekly', label: '2-wöchentlich' },
  { value: 'monthly', label: 'Monatlich' },
];

export function CreateAppointmentFromSlotDialog({
  open,
  onOpenChange,
  prefilledData,
  customers,
  employees,
  onSubmitSingle,
  onSubmitRecurring,
}: CreateAppointmentFromSlotDialogProps) {
  const [mode, setMode] = useState<'single' | 'recurring'>('single');
  const [loading, setLoading] = useState(false);

  // Single appointment state
  const [titel, setTitel] = useState('');
  const [kundenId, setKundenId] = useState('');
  const [isNewInteressent, setIsNewInteressent] = useState(false);
  const [newInteressentName, setNewInteressentName] = useState('');
  const [mitarbeiterId, setMitarbeiterId] = useState(prefilledData.employeeId);
  const [date, setDate] = useState<Date>(prefilledData.date);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');

  // Recurring appointment state
  const [recurringTitel, setRecurringTitel] = useState('');
  const [recurringKundenId, setRecurringKundenId] = useState('');
  const [recurringMitarbeiterId, setRecurringMitarbeiterId] = useState(prefilledData.employeeId);
  const [wochentag, setWochentag] = useState(prefilledData.date.getDay());
  const [intervall, setIntervall] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [recurringStartTime, setRecurringStartTime] = useState('09:00');
  const [dauerMinuten, setDauerMinuten] = useState(60);
  const [gueltigVon, setGueltigVon] = useState<Date>(prefilledData.date);
  const [gueltigBis, setGueltigBis] = useState<Date | undefined>();
  const [notizen, setNotizen] = useState('');

  // Update prefilled data when slot changes
  useEffect(() => {
    setMitarbeiterId(prefilledData.employeeId);
    setRecurringMitarbeiterId(prefilledData.employeeId);
    setDate(prefilledData.date);
    setGueltigVon(prefilledData.date);
    setWochentag(prefilledData.date.getDay());
  }, [prefilledData.employeeId, prefilledData.date]);

  const resetForm = () => {
    setTitel('');
    setKundenId('');
    setIsNewInteressent(false);
    setNewInteressentName('');
    setMitarbeiterId(prefilledData.employeeId);
    setDate(prefilledData.date);
    setStartTime('09:00');
    setEndTime('10:00');
    
    setRecurringTitel('');
    setRecurringKundenId('');
    setRecurringMitarbeiterId(prefilledData.employeeId);
    setWochentag(prefilledData.date.getDay());
    setIntervall('weekly');
    setRecurringStartTime('09:00');
    setDauerMinuten(60);
    setGueltigVon(prefilledData.date);
    setGueltigBis(undefined);
    setNotizen('');
    setLoading(false);
  };

  const handleSubmitSingle = async () => {
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

      const startDateTime = new Date(date);
      const [startHour, startMinute] = startTime.split(':');
      startDateTime.setHours(parseInt(startHour), parseInt(startMinute), 0);

      const endDateTime = new Date(date);
      const [endHour, endMinute] = endTime.split(':');
      endDateTime.setHours(parseInt(endHour), parseInt(endMinute), 0);

      await onSubmitSingle({
        titel,
        kunden_id: finalKundenId,
        mitarbeiter_id: mitarbeiterId,
        start_at: startDateTime.toISOString(),
        end_at: endDateTime.toISOString(),
      });

      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating single appointment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRecurring = async () => {
    if (!gueltigVon || !recurringKundenId) return;

    setLoading(true);
    try {
      await onSubmitRecurring({
        titel: recurringTitel,
        kunden_id: recurringKundenId,
        mitarbeiter_id: recurringMitarbeiterId,
        wochentag,
        intervall,
        start_zeit: recurringStartTime,
        dauer_minuten: dauerMinuten,
        gueltig_von: format(gueltigVon, 'yyyy-MM-dd'),
        gueltig_bis: gueltigBis ? format(gueltigBis, 'yyyy-MM-dd') : null,
        notizen,
      });

      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating recurring appointment:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neuen Termin erstellen</DialogTitle>
          <DialogDescription>
            Erstellen Sie einen Einzeltermin oder eine wiederkehrende Terminserie
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'recurring')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Einzeltermin
            </TabsTrigger>
            <TabsTrigger value="recurring" className="flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              Regeltermin
            </TabsTrigger>
          </TabsList>

          {/* Single Appointment Tab */}
          <TabsContent value="single" className="space-y-4 mt-4">
            {date && (date.getDay() === 0 || date.getDay() === 6) && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Hinweis:</strong> Sie erstellen einen Termin am Wochenende ({format(date, 'EEEE', { locale: de })}).
                </AlertDescription>
              </Alert>
            )}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Ein Einzeltermin wird nur einmalig am gewählten Datum erstellt.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="single-titel">Titel</Label>
              <Input
                id="single-titel"
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
                placeholder="z.B. Pflege, Betreuung..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="single-kunde">Kunde / Interessent *</Label>
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

            <div className="space-y-2">
              <Label htmlFor="single-mitarbeiter">Mitarbeiter</Label>
              <Select value={mitarbeiterId} onValueChange={setMitarbeiterId}>
                <SelectTrigger id="single-mitarbeiter">
                  <SelectValue placeholder="Mitarbeiter auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Datum *</Label>
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
                    {date ? format(date, 'PPP', { locale: de }) : <span>Datum wählen</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="single-start">Startzeit</Label>
                <Input
                  id="single-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="single-end">Endzeit</Label>
                <Input
                  id="single-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSubmitSingle} disabled={loading || !date || !kundenId}>
                {loading ? 'Erstelle...' : 'Einzeltermin erstellen'}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* Recurring Appointment Tab */}
          <TabsContent value="recurring" className="space-y-4 mt-4">
            {(wochentag === 0 || wochentag === 6) && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Hinweis:</strong> Sie erstellen wiederkehrende Termine am Wochenende ({WEEKDAYS.find(d => d.value === wochentag)?.label}).
                </AlertDescription>
              </Alert>
            )}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Wichtig:</strong> Regeltermine erstellen eine Serie von Terminen. Einzelne Termine können später
                individuell verschoben oder angepasst werden, ohne die Serie zu beeinflussen.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="recurring-titel">Titel</Label>
              <Input
                id="recurring-titel"
                value={recurringTitel}
                onChange={(e) => setRecurringTitel(e.target.value)}
                placeholder="z.B. Wöchentliche Pflege"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recurring-kunde">Kunde *</Label>
              <CustomerSearchCombobox
                customers={customers}
                value={recurringKundenId}
                onValueChange={setRecurringKundenId}
                placeholder="Kunde suchen..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recurring-mitarbeiter">Mitarbeiter</Label>
              <Select value={recurringMitarbeiterId} onValueChange={setRecurringMitarbeiterId}>
                <SelectTrigger id="recurring-mitarbeiter">
                  <SelectValue placeholder="Mitarbeiter auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wochentag">Wochentag</Label>
                <Select value={wochentag.toString()} onValueChange={(v) => setWochentag(parseInt(v))}>
                  <SelectTrigger id="wochentag">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((day) => (
                      <SelectItem key={day.value} value={day.value.toString()}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="intervall">Intervall</Label>
                <Select value={intervall} onValueChange={(v: any) => setIntervall(v)}>
                  <SelectTrigger id="intervall">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVALS.map((int) => (
                      <SelectItem key={int.value} value={int.value}>
                        {int.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recurring-time">Startzeit</Label>
                <Input
                  id="recurring-time"
                  type="time"
                  value={recurringStartTime}
                  onChange={(e) => setRecurringStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dauer">Dauer (Minuten)</Label>
                <Input
                  id="dauer"
                  type="number"
                  value={dauerMinuten}
                  onChange={(e) => setDauerMinuten(parseInt(e.target.value))}
                  min="15"
                  step="15"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gültig ab *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !gueltigVon && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {gueltigVon ? format(gueltigVon, 'PPP', { locale: de }) : <span>Datum wählen</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={gueltigVon}
                      onSelect={(d) => d && setGueltigVon(d)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Gültig bis (optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !gueltigBis && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {gueltigBis ? format(gueltigBis, 'PPP', { locale: de }) : <span>Unbegrenzt</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={gueltigBis}
                      onSelect={setGueltigBis}
                      initialFocus
                      className="pointer-events-auto"
                      disabled={(date) => gueltigVon && date < gueltigVon}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notizen">Notizen</Label>
              <Textarea
                id="notizen"
                value={notizen}
                onChange={(e) => setNotizen(e.target.value)}
                placeholder="Zusätzliche Informationen..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSubmitRecurring} disabled={loading || !gueltigVon || !recurringKundenId}>
                {loading ? 'Erstelle...' : 'Terminserie erstellen'}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
