import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CalendarIcon, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CustomerSearchCombobox } from '../CustomerSearchCombobox';
import { AusweichortSelector } from '../AusweichortSelector';
import { TIME_SLOTS, DURATION_OPTIONS, addMinutesToTime } from '../timeSlots';
import type { CustomerSummary, EmployeeSummary, TerminKategorie } from '@/types/domain';
import { useAllVerfuegbarkeiten } from '@/hooks/useAllVerfuegbarkeiten';
import { checkVerfuegbarkeit } from '@/lib/schedule/checkVerfuegbarkeit';
import { useAllKundenZeitfenster } from '@/hooks/useAllKundenZeitfenster';
import { checkKundenZeitfenster } from '@/lib/schedule/checkKundenZeitfenster';
import { useAllAbwesenheiten } from '@/hooks/useAllAbwesenheiten';
import { checkAbwesenheit } from '@/lib/schedule/checkAbwesenheit';

const KATEGORIE_OPTIONS: { value: TerminKategorie; label: string }[] = [
  { value: 'Kundentermin', label: 'Kundentermin' },
  { value: 'Erstgespräch', label: 'Erstgespräch' },
  { value: 'Regelbesuch', label: 'Regelbesuch' },
  { value: 'Schulung', label: 'Schulung' },
  { value: 'Meeting', label: 'Meeting' },
  { value: 'Bewerbungsgespräch', label: 'Bewerbungsgespräch' },
  { value: 'Blocker', label: 'Blocker (nicht Arbeitszeit)' },
  { value: 'Intern', label: 'Intern' },
  { value: 'Ausfall (abrechenbar)', label: 'Ausfall (kurzfristig, abrechenbar)' },
  { value: 'Ausfall (nicht abrechenbar)', label: 'Ausfall (rechtzeitig, nicht abrechenbar)' },
  { value: 'Sonstiges', label: 'Sonstiges' },
];

interface CreateAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: CustomerSummary[];
  employees: EmployeeSummary[];
  onSubmit: (appointment: {
    titel: string;
    kunden_id: string | null;
    mitarbeiter_id: string | null;
    start_at: string;
    end_at: string;
    notizen?: string | null;
    kategorie?: string | null;
    ausweichort_id?: string | null;
  }) => Promise<void>;
}

export function CreateAppointmentDialog({
  open,
  onOpenChange,
  customers,
  employees,
  onSubmit,
}: CreateAppointmentDialogProps) {
  const [kundenId, setKundenId] = useState('');
  const [mitarbeiterId, setMitarbeiterId] = useState<string>('unassigned');
  const [date, setDate] = useState<Date>();
  const [startTime, setStartTime] = useState('09:00');
  const [dauerMinuten, setDauerMinuten] = useState(90);
  const [loading, setLoading] = useState(false);
  const [isNewInteressent, setIsNewInteressent] = useState(false);
  const [newInteressentName, setNewInteressentName] = useState('');
  const [isInternTermin, setIsInternTermin] = useState(false);
  const [kategorie, setKategorie] = useState<string>('');
  const [notizen, setNotizen] = useState('');
  const [ausweichortId, setAusweichortId] = useState<string | null>(null);
  const [showVerfuegbarkeitConfirm, setShowVerfuegbarkeitConfirm] = useState(false);

  const { data: allVerfuegbarkeiten = [] } = useAllVerfuegbarkeiten();
  const { data: allKundenZeitfenster = [] } = useAllKundenZeitfenster();
  const { data: allAbwesenheiten = [] } = useAllAbwesenheiten();

  const erstgespraechRoleConflict =
    kategorie === 'Erstgespräch' &&
    employees.find((e) => e.id === mitarbeiterId)?.rolle === 'mitarbeiter';

  const abwesenheitBlocked = useMemo(() => {
    if (!date || mitarbeiterId === 'unassigned' || !mitarbeiterId) return false;
    const [h, m] = startTime.split(':').map(Number);
    const startAt = new Date(date);
    startAt.setHours(h, m, 0, 0);
    return checkAbwesenheit(mitarbeiterId, startAt.toISOString(), allAbwesenheiten);
  }, [date, startTime, mitarbeiterId, allAbwesenheiten]);

  const verfuegbarkeitWarning = useMemo(() => {
    if (!date || mitarbeiterId === 'unassigned' || !mitarbeiterId) return null;
    const [startHours, startMins] = startTime.split(':').map(Number);
    const startAt = new Date(date);
    startAt.setHours(startHours, startMins, 0, 0);
    const endAt = new Date(startAt.getTime() + dauerMinuten * 60000);
    return checkVerfuegbarkeit(mitarbeiterId, startAt.toISOString(), endAt.toISOString(), allVerfuegbarkeiten);
  }, [date, startTime, dauerMinuten, mitarbeiterId, allVerfuegbarkeiten]);

  const kundenZeitfensterCheck = useMemo(() => {
    if (!kundenId || !date) return null;
    const [startHours, startMins] = startTime.split(':').map(Number);
    const startAt = new Date(date);
    startAt.setHours(startHours, startMins, 0, 0);
    const endAt = new Date(startAt.getTime() + dauerMinuten * 60000);
    return checkKundenZeitfenster(kundenId, startAt.toISOString(), endAt.toISOString(), allKundenZeitfenster);
  }, [kundenId, date, startTime, dauerMinuten, allKundenZeitfenster]);

  const doSubmit = async () => {
    if (!date) return;
    setLoading(true);
    try {
      let finalKundenId: string | null = isInternTermin ? null : (kundenId || null);

      if (!isInternTermin && isNewInteressent && newInteressentName.trim()) {
        const { supabase } = await import('@/integrations/supabase/client');

        const nameParts = newInteressentName.trim().split(' ');
        const vorname = nameParts[0];
        const nachname = nameParts.slice(1).join(' ') || '';

        const { data: newKunde, error: kundeError } = await supabase
          .from('kunden')
          .insert([{ vorname, nachname, kategorie: 'Interessent', aktiv: true }])
          .select()
          .single();

        if (kundeError) throw kundeError;
        finalKundenId = newKunde.id;
      }

      const startAt = new Date(date);
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      startAt.setHours(startHours, startMinutes, 0, 0);

      const endTime = addMinutesToTime(startTime, dauerMinuten);
      const endAt = new Date(date);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      endAt.setHours(endHours, endMinutes, 0, 0);

      const titel = isInternTermin
        ? (kategorie || 'Interner Termin')
        : isNewInteressent
          ? newInteressentName.trim()
          : customers.find(c => c.id === finalKundenId)?.name || kategorie || 'Einzeltermin';

      await onSubmit({
        titel,
        kunden_id: finalKundenId,
        mitarbeiter_id: mitarbeiterId === 'unassigned' ? null : mitarbeiterId || null,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        notizen: notizen.trim() || null,
        kategorie: kategorie || null,
        ausweichort_id: ausweichortId || null,
      });

      setKundenId('');
      setMitarbeiterId('unassigned');
      setDate(undefined);
      setStartTime('09:00');
      setDauerMinuten(90);
      setIsNewInteressent(false);
      setNewInteressentName('');
      setIsInternTermin(false);
      setKategorie('');
      setNotizen('');
      setAusweichortId(null);
      onOpenChange(false);
    } catch (error: unknown) {
      console.error('Error creating appointment:', error);
      const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
      toast.error(`Fehler beim Erstellen: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    if (isNewInteressent && !newInteressentName.trim()) return;

    if (abwesenheitBlocked) return;

    if (verfuegbarkeitWarning?.outsideWindow) {
      setShowVerfuegbarkeitConfirm(true);
      return;
    }

    await doSubmit();
  };

  const verfuegbarkeitHinweis = !verfuegbarkeitWarning?.hasEntries
    ? 'Für diesen Mitarbeiter sind keine Verfügbarkeiten hinterlegt.'
    : verfuegbarkeitWarning?.noEntryForDay
      ? 'Der Mitarbeiter ist an diesem Wochentag laut Verfügbarkeit nicht verfügbar.'
      : 'Der Termin liegt außerhalb der eingetragenen Verfügbarkeitszeit des Mitarbeiters.';

  return (
    <>
    <AlertDialog open={showVerfuegbarkeitConfirm} onOpenChange={setShowVerfuegbarkeitConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Außerhalb der Verfügbarkeit</AlertDialogTitle>
          <AlertDialogDescription>
            {verfuegbarkeitHinweis} Trotzdem speichern?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={() => { setShowVerfuegbarkeitConfirm(false); doSubmit(); }}>
            Trotzdem speichern
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl z-[201]" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Neuen Termin erstellen</DialogTitle>
          <p className="sr-only" id="create-appointment-desc">Einzeltermin mit Datum und Uhrzeit anlegen</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Kategorie */}
          <div className="space-y-2">
            <Label>Kategorie</Label>
            <Select value={kategorie} onValueChange={(val) => {
              setKategorie(val);
              setIsInternTermin(val === 'Schulung' || val === 'Intern');
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Kategorie wählen (optional)" />
              </SelectTrigger>
              <SelectContent className="z-[202]">
                {KATEGORIE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Intern-Toggle */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant={!isInternTermin ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsInternTermin(false)}
            >
              Mit Kunde
            </Button>
            <Button
              type="button"
              variant={isInternTermin ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsInternTermin(true)}
            >
              Interner Termin (ohne Kunde)
            </Button>
          </div>

          {/* Kunde — nur wenn kein interner Termin */}
          {!isInternTermin && (
            <div className="space-y-2">
              <Label htmlFor="kunde">Kunde / Interessent (optional)</Label>
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
          )}

            <div className="space-y-2">
              <Label htmlFor="mitarbeiter">Mitarbeiter (optional)</Label>
              <Select value={mitarbeiterId} onValueChange={setMitarbeiterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nicht zugewiesen (später zuweisen)" />
                </SelectTrigger>
                <SelectContent className="z-[202]">
                  <SelectItem value="unassigned">Nicht zugewiesen</SelectItem>
                  {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.vorname} {employee.nachname}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {abwesenheitBlocked && (
                <p className="text-sm text-destructive flex items-center gap-1.5 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Dieser Mitarbeiter ist an diesem Tag abwesend. Bitte wähle einen anderen Mitarbeiter oder ein anderes Datum.
                </p>
              )}
              {erstgespraechRoleConflict && (
                <p className="text-sm text-destructive flex items-center gap-1.5 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Erstgespräche können nur von der Geschäftsführung durchgeführt werden. Bitte wähle eine andere Kategorie oder einen anderen Mitarbeiter.
                </p>
              )}
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
              <PopoverContent className="w-auto p-0 z-[202]" align="start">
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
              <Label>Startzeit</Label>
              <Select value={startTime} onValueChange={setStartTime}>
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[202]">
                  {DURATION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {kundenZeitfensterCheck?.outsideWindow && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {kundenZeitfensterCheck.noEntryForDay
                ? 'Dieser Wochentag liegt außerhalb der Kundenpräferenz.'
                : 'Die Uhrzeit liegt außerhalb des bevorzugten Zeitfensters des Kunden.'}
            </div>
          )}

          {/* Ort */}
          <div className="space-y-2">
            <Label>Einsatzort</Label>
            <AusweichortSelector
              value={ausweichortId}
              onChange={setAusweichortId}
              zIndex={202}
            />
          </div>

          {/* Notizen */}
          <div className="space-y-2">
            <Label>Notizen (optional)</Label>
            <Textarea
              value={notizen}
              onChange={(e) => setNotizen(e.target.value)}
              placeholder="Notizen zum Termin..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={loading || !date || (isNewInteressent && !newInteressentName.trim()) || erstgespraechRoleConflict || abwesenheitBlocked}
            >
              {loading ? 'Erstelle...' : isInternTermin ? 'Internen Termin erstellen' : isNewInteressent ? 'Interessent & Termin erstellen' : 'Termin erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
