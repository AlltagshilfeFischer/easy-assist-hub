import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, FileText, Briefcase, AlertTriangle, FolderOpen } from 'lucide-react';
import { EntityDokumente } from '@/components/dokumente/entity-dokumente';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AvatarUpload } from '@/components/mitarbeiter/AvatarUpload';
import { QualifikationenPicker } from '@/components/mitarbeiter/QualifikationenPicker';
import { VerfuegbarkeitEditor } from '@/components/mitarbeiter/VerfuegbarkeitEditor';
import { useMitarbeiterQualifikationen, useSaveMitarbeiterQualifikationen } from '@/hooks/useQualifikationen';
import { PersonalDataTab } from './PersonalDataTab';
import { TaxSocialTab } from './TaxSocialTab';
import { SideEmploymentTab } from './SideEmploymentTab';
import { mitarbeiterFormSchema, checkStammdatenVollstaendig, type MitarbeiterFormValues } from './mitarbeiterFormSchema';

interface MitarbeiterData {
  id: string;
  vorname: string | null;
  nachname: string | null;
  telefon: string | null;
  strasse: string | null;
  plz: string | null;
  stadt: string | null;
  farbe_kalender: string | null;
  standort: string | null;
  zustaendigkeitsbereich: string | null;
  soll_wochenstunden: number | null;
  max_termine_pro_tag: number | null;
  employment_type: string | null;
  avatar_url: string | null;
  benutzer_id: string | null;
  // Neue Felder
  gehalt_pro_monat: number | null;
  vertragsstunden_pro_monat: number | null;
  geburtsdatum: string | null;
  geburtsname: string | null;
  geburtsort: string | null;
  geburtsland: string | null;
  geschlecht: string | null;
  konfession: string | null;
  email: string | null;
  bank_institut: string | null;
  iban: string | null;
  steuer_id: string | null;
  steuerklasse: number | null;
  kinderfreibetrag: number | null;
  sv_rv_nummer: string | null;
  krankenkasse: string | null;
  weitere_beschaeftigung: boolean | null;
}

interface MitarbeiterEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mitarbeiter: MitarbeiterData | null;
  onSuccess: () => void;
}

export function MitarbeiterEditDialog({ open, onOpenChange, mitarbeiter, onSuccess }: MitarbeiterEditDialogProps) {
  const { data: currentQualifikationIds = [] } = useMitarbeiterQualifikationen(mitarbeiter?.id ?? null);
  const saveQualifikationen = useSaveMitarbeiterQualifikationen();

  const form = useForm<MitarbeiterFormValues>({
    resolver: zodResolver(mitarbeiterFormSchema),
    defaultValues: getDefaults(mitarbeiter),
  });

  // Qualifikation IDs separat tracken (nicht Teil des Hauptformulars)
  const qualifikationState = useQualifikationState(currentQualifikationIds, open);

  // Reset form wenn anderer MA geoeffnet wird
  useEffect(() => {
    if (open && mitarbeiter) {
      form.reset(getDefaults(mitarbeiter));
    }
  }, [open, mitarbeiter?.id]);

  const isSubmitting = form.formState.isSubmitting;
  const stammdatenOk = checkStammdatenVollstaendig(form.watch());

  const handleSave = async (values: MitarbeiterFormValues) => {
    if (!mitarbeiter) return;
    try {
      const { error } = await supabase.from('mitarbeiter').update({
        vorname: values.vorname,
        nachname: values.nachname,
        telefon: values.telefon || null,
        strasse: values.strasse || null,
        plz: values.plz || null,
        stadt: values.stadt || null,
        farbe_kalender: values.farbe_kalender,
        standort: (values.standort || 'Hannover') as 'Hannover',
        zustaendigkeitsbereich: values.zustaendigkeitsbereich || null,
        soll_wochenstunden: values.soll_wochenstunden ?? null,
        max_termine_pro_tag: values.max_termine_pro_tag ?? null,
        employment_type: values.employment_type || null,
        // Neue Felder — Reiter 1
        gehalt_pro_monat: values.gehalt_pro_monat ?? null,
        vertragsstunden_pro_monat: values.vertragsstunden_pro_monat ?? null,
        geburtsdatum: values.geburtsdatum || null,
        geburtsname: values.geburtsname || null,
        geburtsort: values.geburtsort || null,
        geburtsland: values.geburtsland || null,
        geschlecht: values.geschlecht || null,
        konfession: values.konfession || null,
        email: values.email || null,
        bank_institut: values.bank_institut || null,
        iban: values.iban || null,
        // Neue Felder — Reiter 2
        steuer_id: values.steuer_id || null,
        steuerklasse: values.steuerklasse ?? null,
        kinderfreibetrag: values.kinderfreibetrag ?? null,
        sv_rv_nummer: values.sv_rv_nummer || null,
        krankenkasse: values.krankenkasse || null,
        // Neue Felder — Reiter 3
        weitere_beschaeftigung: values.weitere_beschaeftigung,
      }).eq('id', mitarbeiter.id);

      if (error) throw error;

      // Qualifikationen separat speichern
      await saveQualifikationen.mutateAsync({
        mitarbeiterId: mitarbeiter.id,
        qualifikationIds: qualifikationState.ids,
      });

      toast.success('Mitarbeiter-Daten wurden aktualisiert');
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
      toast.error('Fehler beim Speichern', { description: message });
    }
  };

  if (!mitarbeiter) return null;

  const name = `${mitarbeiter.vorname || ''} ${mitarbeiter.nachname || ''}`.trim() || 'Mitarbeiter';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Mitarbeiter bearbeiten
            {!stammdatenOk && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1">
                <AlertTriangle className="h-3 w-3" />
                Stammdaten unvollständig
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>Stammdaten, Steuer und Beschäftigungsverhältnisse verwalten</DialogDescription>
        </DialogHeader>

        {/* Avatar — immer sichtbar */}
        <div className="flex justify-center pb-2 border-b">
          <div className="text-center">
            <AvatarUpload
              mitarbeiterId={mitarbeiter.id}
              currentAvatarUrl={mitarbeiter.avatar_url}
              name={name}
              color={form.watch('farbe_kalender') || '#3B82F6'}
              size="lg"
              onUploadComplete={onSuccess}
              onRemove={onSuccess}
            />
            <p className="text-xs text-muted-foreground mt-1">Hover für Upload-Optionen</p>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(handleSave)}>
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="personal" className="gap-1.5">
                <User className="h-3.5 w-3.5" />
                Persönliche Daten
              </TabsTrigger>
              <TabsTrigger value="tax" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Steuer & SV
              </TabsTrigger>
              <TabsTrigger value="side" className="gap-1.5">
                <Briefcase className="h-3.5 w-3.5" />
                Nebenbeschäftigung
              </TabsTrigger>
              <TabsTrigger value="dokumente" className="gap-1.5">
                <FolderOpen className="h-3.5 w-3.5" />
                Dokumente
              </TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="mt-4 space-y-6">
              <PersonalDataTab form={form} />

              {/* Qualifikationen */}
              <div className="border-t pt-4">
                <QualifikationenPicker
                  selectedIds={qualifikationState.ids}
                  onChange={qualifikationState.setIds}
                />
              </div>

              {/* Verfuegbarkeit */}
              <div className="border-t pt-4">
                <VerfuegbarkeitEditor mitarbeiterId={mitarbeiter.id} />
              </div>
            </TabsContent>

            <TabsContent value="tax" className="mt-4">
              <TaxSocialTab form={form} />
            </TabsContent>

            <TabsContent value="side" className="mt-4">
              <SideEmploymentTab form={form} mitarbeiterId={mitarbeiter.id} />
            </TabsContent>

            <TabsContent value="dokumente" className="mt-4">
              <EntityDokumente kategorie="mitarbeiter" entityId={mitarbeiter.id} />
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ────────────────────────────────────────────────

function getDefaults(m: MitarbeiterData | null): MitarbeiterFormValues {
  return {
    vorname: m?.vorname || '',
    nachname: m?.nachname || '',
    telefon: m?.telefon || '',
    strasse: m?.strasse || '',
    plz: m?.plz || '',
    stadt: m?.stadt || '',
    email: m?.email || '',
    geburtsdatum: m?.geburtsdatum || '',
    geburtsname: m?.geburtsname || '',
    geburtsort: m?.geburtsort || '',
    geburtsland: m?.geburtsland || '',
    geschlecht: (m?.geschlecht as 'm' | 'w' | 'd' | '') || '',
    konfession: m?.konfession || '',
    bank_institut: m?.bank_institut || '',
    iban: m?.iban || '',
    gehalt_pro_monat: m?.gehalt_pro_monat ?? null,
    vertragsstunden_pro_monat: m?.vertragsstunden_pro_monat ?? null,
    employment_type: m?.employment_type || '',
    soll_wochenstunden: m?.soll_wochenstunden ?? null,
    max_termine_pro_tag: m?.max_termine_pro_tag ?? null,
    farbe_kalender: m?.farbe_kalender || '#3B82F6',
    standort: m?.standort || 'Hannover',
    zustaendigkeitsbereich: m?.zustaendigkeitsbereich || '',
    steuer_id: m?.steuer_id || '',
    steuerklasse: m?.steuerklasse ?? null,
    kinderfreibetrag: m?.kinderfreibetrag ?? null,
    sv_rv_nummer: m?.sv_rv_nummer || '',
    krankenkasse: m?.krankenkasse || '',
    weitere_beschaeftigung: m?.weitere_beschaeftigung ?? false,
  };
}

function useQualifikationState(currentIds: string[], dialogOpen: boolean) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    if (dialogOpen) {
      setIds(currentIds);
    }
  }, [dialogOpen, currentIds]);

  return { ids, setIds };
}
