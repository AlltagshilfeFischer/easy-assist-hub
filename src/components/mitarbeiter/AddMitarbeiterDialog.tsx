import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, User, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { mitarbeiterFormSchema, type MitarbeiterFormValues } from './edit-dialog/mitarbeiterFormSchema';

const KALENDER_FARBEN = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
];

interface AddMitarbeiterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddMitarbeiterDialog({ open, onOpenChange, onSuccess }: AddMitarbeiterDialogProps) {
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<MitarbeiterFormValues>({
    resolver: zodResolver(mitarbeiterFormSchema),
    defaultValues: {
      vorname: '',
      nachname: '',
      telefon: '',
      strasse: '',
      plz: '',
      stadt: 'Hannover',
      zustaendigkeitsbereich: '',
      farbe_kalender: '#3B82F6',
      email: '',
      geburtsdatum: '',
      geburtsname: '',
      geburtsort: '',
      geburtsland: '',
      geschlecht: '',
      konfession: '',
      bank_institut: '',
      iban: '',
      gehalt_pro_monat: null,
      vertragsstunden_pro_monat: null,
      employment_type: '',
      soll_wochenstunden: null,
      max_termine_pro_tag: null,
      standort: 'Hannover',
      steuer_id: '',
      steuerklasse: null,
      kinderfreibetrag: null,
      sv_rv_nummer: '',
      krankenkasse: '',
      weitere_beschaeftigung: false,
    },
  });

  const selectedColor = watch('farbe_kalender');

  const onSubmit = async (values: MitarbeiterFormValues) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('mitarbeiter').insert([{
        vorname: values.vorname,
        nachname: values.nachname,
        telefon: values.telefon || null,
        strasse: values.strasse || null,
        plz: values.plz || null,
        stadt: values.stadt || null,
        zustaendigkeitsbereich: values.zustaendigkeitsbereich || null,
        farbe_kalender: values.farbe_kalender,
        standort: values.standort || 'Hannover',
        ist_aktiv: true,
        // Reiter 1
        email: values.email || null,
        geburtsdatum: values.geburtsdatum || null,
        geburtsname: values.geburtsname || null,
        geburtsort: values.geburtsort || null,
        geburtsland: values.geburtsland || null,
        geschlecht: values.geschlecht || null,
        konfession: values.konfession || null,
        bank_institut: values.bank_institut || null,
        iban: values.iban || null,
        gehalt_pro_monat: values.gehalt_pro_monat ?? null,
        vertragsstunden_pro_monat: values.vertragsstunden_pro_monat ?? null,
        employment_type: values.employment_type || null,
        soll_wochenstunden: values.soll_wochenstunden ?? null,
        max_termine_pro_tag: values.max_termine_pro_tag ?? null,
        // Reiter 2
        steuer_id: values.steuer_id || null,
        steuerklasse: values.steuerklasse ?? null,
        kinderfreibetrag: values.kinderfreibetrag ?? null,
        sv_rv_nummer: values.sv_rv_nummer || null,
        krankenkasse: values.krankenkasse || null,
        // Reiter 3
        weitere_beschaeftigung: values.weitere_beschaeftigung,
      });

      if (error) throw error;

      toast.success('Mitarbeiter erfolgreich angelegt', {
        description: `${values.vorname} ${values.nachname} wurde hinzugefügt.`,
      });
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
      toast.error('Fehler beim Anlegen', { description: message });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mitarbeiter anlegen</DialogTitle>
          <DialogDescription>
            Neuen Mitarbeiter zum Team hinzufügen. Kein Login-Zugang &mdash; dafür &quot;Benutzer erstellen&quot; nutzen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="personal" className="gap-1.5">
                <User className="h-3.5 w-3.5" />
                Persönliche Daten
              </TabsTrigger>
              <TabsTrigger value="tax" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Steuer & SV
              </TabsTrigger>
            </TabsList>

            {/* ─── Reiter 1: Persoenliche Daten & Vertrag ─── */}
            <TabsContent value="personal" className="mt-4 space-y-5">
              {/* Name */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Vorname *</Label>
                  <Input {...register('vorname')} placeholder="Max" />
                  {errors.vorname && <p className="text-xs text-destructive">{errors.vorname.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Nachname *</Label>
                  <Input {...register('nachname')} placeholder="Mustermann" />
                  {errors.nachname && <p className="text-xs text-destructive">{errors.nachname.message}</p>}
                </div>
              </div>

              {/* Adresse */}
              <div className="grid grid-cols-[1fr_100px_1fr] gap-4">
                <div className="space-y-1.5">
                  <Label>Straße + Hausnr. *</Label>
                  <Input {...register('strasse')} placeholder="Musterstraße 1" />
                </div>
                <div className="space-y-1.5">
                  <Label>PLZ *</Label>
                  <Input {...register('plz')} placeholder="30159" />
                  {errors.plz && <p className="text-xs text-destructive">{errors.plz.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Ort *</Label>
                  <Input {...register('stadt')} placeholder="Hannover" />
                </div>
              </div>

              {/* Vertragsdaten (Pflicht) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Gehalt / Monat (€) *</Label>
                  <Input type="number" step="0.01" min="0" {...register('gehalt_pro_monat')} placeholder="0.00" />
                  {errors.gehalt_pro_monat && <p className="text-xs text-destructive">{errors.gehalt_pro_monat.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Vertragsstunden / Monat *</Label>
                  <Input type="number" step="0.5" min="0" {...register('vertragsstunden_pro_monat')} placeholder="0" />
                  {errors.vertragsstunden_pro_monat && <p className="text-xs text-destructive">{errors.vertragsstunden_pro_monat.message}</p>}
                </div>
              </div>

              {/* Kontakt */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>E-Mail</Label>
                  <Input type="email" {...register('email')} placeholder="mitarbeiter@beispiel.de" />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Telefon</Label>
                  <Input {...register('telefon')} placeholder="0511 1234567" />
                </div>
              </div>

              {/* Persoenliche Daten */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Geburtsdatum</Label>
                  <Input type="date" {...register('geburtsdatum')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Geschlecht</Label>
                  <Select value={watch('geschlecht') || ''} onValueChange={(v) => setValue('geschlecht', v as 'm' | 'w' | 'd' | '')}>
                    <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="m">Männlich</SelectItem>
                      <SelectItem value="w">Weiblich</SelectItem>
                      <SelectItem value="d">Divers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Geburtsname</Label>
                  <Input {...register('geburtsname')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Geburtsort</Label>
                  <Input {...register('geburtsort')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Geburtsland</Label>
                  <Input {...register('geburtsland')} placeholder="Deutschland" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Konfession</Label>
                <Input {...register('konfession')} placeholder="z.B. evangelisch" />
              </div>

              {/* Bankverbindung */}
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-1.5">
                  <Label>Bank / Institut</Label>
                  <Input {...register('bank_institut')} placeholder="Sparkasse Hannover" />
                </div>
                <div className="space-y-1.5">
                  <Label>IBAN</Label>
                  <Input {...register('iban')} placeholder="DE89370400440532013000" />
                  {errors.iban && <p className="text-xs text-destructive">{errors.iban.message}</p>}
                </div>
              </div>

              {/* Vertrag & Einsatz */}
              <div className="grid grid-cols-3 gap-4 border-t pt-4">
                <div className="space-y-1.5">
                  <Label>Beschäftigungsart</Label>
                  <Select value={watch('employment_type') || ''} onValueChange={(v) => setValue('employment_type', v)}>
                    <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Vollzeit">Vollzeit</SelectItem>
                      <SelectItem value="Teilzeit">Teilzeit</SelectItem>
                      <SelectItem value="Minijob">Minijob</SelectItem>
                      <SelectItem value="Werkstudent">Werkstudent</SelectItem>
                      <SelectItem value="Praktikant">Praktikant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Soll-Wochenstunden</Label>
                  <Input type="number" min="0" step="0.5" {...register('soll_wochenstunden')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Max. Termine/Tag</Label>
                  <Input type="number" min="0" {...register('max_termine_pro_tag')} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Zuständigkeitsbereich</Label>
                  <Input {...register('zustaendigkeitsbereich')} placeholder="z.B. Linden-Süd" />
                </div>
                <div className="space-y-1.5">
                  <Label>Standort</Label>
                  <Select value={watch('standort') || 'Hannover'} onValueChange={(v) => setValue('standort', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hannover">Hannover</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Kalenderfarbe */}
              <div className="space-y-1.5 border-t pt-4">
                <Label>Kalenderfarbe</Label>
                <div className="flex gap-2 flex-wrap">
                  {KALENDER_FARBEN.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: color,
                        borderColor: selectedColor === color ? 'hsl(var(--foreground))' : 'transparent',
                        transform: selectedColor === color ? 'scale(1.15)' : 'scale(1)',
                      }}
                      onClick={() => setValue('farbe_kalender', color)}
                    />
                  ))}
                  <Input
                    type="color"
                    value={selectedColor || '#3B82F6'}
                    onChange={(e) => setValue('farbe_kalender', e.target.value)}
                    className="w-7 h-7 p-0 border-0 cursor-pointer"
                    title="Eigene Farbe wählen"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ─── Reiter 2: Steuer & Sozialversicherung ─── */}
            <TabsContent value="tax" className="mt-4 space-y-5">
              <p className="text-sm text-muted-foreground">
                Angaben zur Vorbereitung der Lohnabrechnung und steuerlichen Einordnung.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Steuer-ID</Label>
                  <Input {...register('steuer_id')} placeholder="12345678901" maxLength={11} />
                  {errors.steuer_id && <p className="text-xs text-destructive">{errors.steuer_id.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Steuerklasse</Label>
                  <Select
                    value={watch('steuerklasse')?.toString() || ''}
                    onValueChange={(v) => setValue('steuerklasse', v ? parseInt(v) : null)}
                  >
                    <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="6">6</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5 max-w-xs">
                <Label>Kinderfreibetrag</Label>
                <Input type="number" step="0.5" min="0" {...register('kinderfreibetrag')} placeholder="0" />
              </div>
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-1.5">
                  <Label>SV/RV-Nummer</Label>
                  <Input {...register('sv_rv_nummer')} placeholder="12 180872 H 001" />
                </div>
                <div className="space-y-1.5">
                  <Label>Krankenkasse</Label>
                  <Input {...register('krankenkasse')} placeholder="AOK Niedersachsen" />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mitarbeiter anlegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
