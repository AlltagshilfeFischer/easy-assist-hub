import { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { MitarbeiterFormValues } from './mitarbeiterFormSchema';

interface TaxSocialTabProps {
  form: UseFormReturn<MitarbeiterFormValues>;
}

export function TaxSocialTab({ form }: TaxSocialTabProps) {
  const { register, formState: { errors }, setValue, watch } = form;
  const isMinijob = watch('employment_type') === 'Minijob';

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Angaben zur Vorbereitung der Lohnabrechnung und steuerlichen Einordnung.
      </p>

      {/* ─── Steuer ──────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Steuer</legend>
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
      </fieldset>

      {/* ─── Sozialversicherung ──────────────────────── */}
      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-semibold text-foreground">Sozialversicherung</legend>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>SV/RV-Nummer</Label>
            <Input {...register('sv_rv_nummer')} placeholder="12 180872 H 001" />
          </div>
          <div className="space-y-1.5">
            <Label>Krankenkasse</Label>
            <Input {...register('krankenkasse')} placeholder="AOK Niedersachsen" />
          </div>
        </div>

        {isMinijob && (
          <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2.5">
            <Switch
              id="rv_befreiung"
              checked={watch('rv_befreiung') ?? false}
              onCheckedChange={(checked) => setValue('rv_befreiung', checked)}
            />
            <div>
              <Label htmlFor="rv_befreiung" className="cursor-pointer text-sm">
                Befreiung von der RV-Pflicht
              </Label>
              <p className="text-xs text-muted-foreground">§ 6 Abs. 1b SGB VI — Antrag beim Arbeitgeber gestellt</p>
            </div>
          </div>
        )}
      </fieldset>
    </div>
  );
}
