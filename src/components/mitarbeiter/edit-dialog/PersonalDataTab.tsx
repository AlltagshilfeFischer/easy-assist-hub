import { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MitarbeiterFormValues } from './mitarbeiterFormSchema';

const KALENDER_FARBEN = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
];

interface PersonalDataTabProps {
  form: UseFormReturn<MitarbeiterFormValues>;
}

export function PersonalDataTab({ form }: PersonalDataTabProps) {
  const { register, formState: { errors }, setValue, watch } = form;
  const selectedColor = watch('farbe_kalender');
  const lohnart = watch('lohnart');

  return (
    <div className="space-y-6">
      {/* ─── Name (einzige Pflichtfelder) ────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Name <span className="text-xs font-normal text-muted-foreground">(Pflichtfelder)</span></legend>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Vorname *</Label>
            <Input {...register('vorname')} />
            {errors.vorname && <p className="text-xs text-destructive">{errors.vorname.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Nachname *</Label>
            <Input {...register('nachname')} />
            {errors.nachname && <p className="text-xs text-destructive">{errors.nachname.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_100px_1fr] gap-4">
          <div className="space-y-1.5">
            <Label>Straße + Hausnr.</Label>
            <Input {...register('strasse')} placeholder="Musterstraße 1" />
            {errors.strasse && <p className="text-xs text-destructive">{errors.strasse.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>PLZ</Label>
            <Input {...register('plz')} placeholder="30159" maxLength={5} />
            {errors.plz && <p className="text-xs text-destructive">{errors.plz.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Ort</Label>
            <Input {...register('stadt')} placeholder="Hannover" />
            {errors.stadt && <p className="text-xs text-destructive">{errors.stadt.message}</p>}
          </div>
        </div>

      </fieldset>

      {/* ─── Kontakt ─────────────────────────────────── */}
      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-semibold text-foreground">Kontakt</legend>
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
      </fieldset>

      {/* ─── Persoenliche Daten ──────────────────────── */}
      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-semibold text-foreground">Persönliche Daten</legend>
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
        <div className="space-y-1.5 max-w-xs">
          <Label>Staatsangehörigkeit</Label>
          <Input {...register('staatsangehoerigkeit')} placeholder="Deutsch" />
        </div>
        <div className="space-y-1.5">
          <Label>Konfession</Label>
          <Input {...register('konfession')} placeholder="z.B. evangelisch" />
        </div>
      </fieldset>

      {/* ─── Bankverbindung ──────────────────────────── */}
      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-semibold text-foreground">Bankverbindung</legend>
        <div className="grid grid-cols-2 gap-4">
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
      </fieldset>

      {/* ─── Vertrag & Einsatz ───────────────────────── */}
      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-semibold text-foreground">Vertrag & Einsatz</legend>
        <div className="grid grid-cols-3 gap-4">
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
            <Label>Max. Termine/Tag</Label>
            <Input type="number" min="0" {...register('max_termine_pro_tag')} />
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Lohnart</Label>
            <div className="flex rounded-md border overflow-hidden w-fit text-sm">
              <button
                type="button"
                className={`px-4 py-1.5 ${lohnart === 'stundenlohn' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                onClick={() => { setValue('lohnart', 'stundenlohn'); setValue('gehalt_pro_monat', null); }}
              >
                Stundenlohn
              </button>
              <button
                type="button"
                className={`px-4 py-1.5 border-l ${lohnart === 'festgehalt' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                onClick={() => { setValue('lohnart', 'festgehalt'); setValue('hourly_rate', null); }}
              >
                Festgehalt
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              {lohnart === 'stundenlohn' ? (
                <>
                  <Label>Stundenlohn (€)</Label>
                  <Input type="number" step="0.01" min="0" {...register('hourly_rate')} placeholder="0.00" />
                  {errors.hourly_rate && <p className="text-xs text-destructive">{errors.hourly_rate.message}</p>}
                </>
              ) : (
                <>
                  <Label>Gehalt / Monat (€)</Label>
                  <Input type="number" step="0.01" min="0" {...register('gehalt_pro_monat')} placeholder="0.00" />
                  {errors.gehalt_pro_monat && <p className="text-xs text-destructive">{errors.gehalt_pro_monat.message}</p>}
                </>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Vertragsstunden / Monat</Label>
              <Input type="number" step="0.5" min="0" {...register('vertragsstunden_pro_monat')} placeholder="0" />
              {errors.vertragsstunden_pro_monat && <p className="text-xs text-destructive">{errors.vertragsstunden_pro_monat.message}</p>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Standort</Label>
            <Select value={watch('standort') || 'Hannover'} onValueChange={(v) => setValue('standort', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Hannover">Hannover</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Zuständigkeitsbereich</Label>
            <Input {...register('zustaendigkeitsbereich')} placeholder="z.B. Linden-Süd" />
          </div>
        </div>
      </fieldset>

      {/* ─── Kalenderfarbe ───────────────────────────── */}
      <fieldset className="space-y-2 border-t pt-4">
        <legend className="text-sm font-semibold text-foreground">Kalenderfarbe</legend>
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
      </fieldset>
    </div>
  );
}
