import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Loader2, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import {
  useNebenbeschaeftigungen,
  useCreateNebenbeschaeftigung,
  useUpdateNebenbeschaeftigung,
  useDeleteNebenbeschaeftigung,
} from '@/hooks/useNebenbeschaeftigung';
import type { MitarbeiterNebenbeschaeftigung } from '@/types/domain';

const ART_LABELS: Record<string, string> = {
  minijob: 'Minijob',
  sv_pflichtig: 'SV-pflichtig',
  kurzfristig: 'Kurzfristig',
  ehrenamt: 'Ehrenamt',
};

type Gehaltsart = 'monatlich' | 'stuendlich';

function deriveGehaltsart(entry: MitarbeiterNebenbeschaeftigung): Gehaltsart {
  return entry.gehalt_pro_stunde != null ? 'stuendlich' : 'monatlich';
}

interface SideEmploymentTabProps {
  mitarbeiterId: string;
}

export function SideEmploymentTab({ mitarbeiterId }: SideEmploymentTabProps) {
  const { data: nebenbeschaeftigungen = [], isLoading } = useNebenbeschaeftigungen(mitarbeiterId);
  const createMutation = useCreateNebenbeschaeftigung();
  const updateMutation = useUpdateNebenbeschaeftigung();
  const deleteMutation = useDeleteNebenbeschaeftigung();

  const [addingNew, setAddingNew] = useState(false);
  const [newEntry, setNewEntry] = useState({
    arbeitgeber: '',
    art_beschaeftigung: '',
    arbeitszeit_stunden_woche: '',
    gehaltsart: 'monatlich' as Gehaltsart,
    gehalt_monatlich: '',
    gehalt_pro_stunde: '',
    sv_pflicht: false,
    rv_pflicht: true,
  });

  const [editGehaltsart, setEditGehaltsart] = useState<Record<string, Gehaltsart>>({});

  const getGehaltsartForEntry = (entry: MitarbeiterNebenbeschaeftigung): Gehaltsart =>
    editGehaltsart[entry.id] ?? deriveGehaltsart(entry);

  const handleAddEntry = async () => {
    if (!newEntry.arbeitgeber.trim()) {
      toast.error('Arbeitgeber ist erforderlich');
      return;
    }
    try {
      const isMinijob = newEntry.art_beschaeftigung === 'minijob';
      await createMutation.mutateAsync({
        mitarbeiter_id: mitarbeiterId,
        arbeitgeber: newEntry.arbeitgeber.trim(),
        art_beschaeftigung: newEntry.art_beschaeftigung || null,
        arbeitszeit_stunden_woche: newEntry.arbeitszeit_stunden_woche ? parseFloat(newEntry.arbeitszeit_stunden_woche) : null,
        gehalt_monatlich: newEntry.gehaltsart === 'monatlich' && newEntry.gehalt_monatlich ? parseFloat(newEntry.gehalt_monatlich) : null,
        gehalt_pro_stunde: newEntry.gehaltsart === 'stuendlich' && newEntry.gehalt_pro_stunde ? parseFloat(newEntry.gehalt_pro_stunde) : null,
        sv_pflicht: newEntry.sv_pflicht,
        rv_pflicht: isMinijob ? newEntry.rv_pflicht : null,
      });
      toast.success('Nebenbeschäftigung hinzugefügt');
      setNewEntry({ arbeitgeber: '', art_beschaeftigung: '', arbeitszeit_stunden_woche: '', gehaltsart: 'monatlich', gehalt_monatlich: '', gehalt_pro_stunde: '', sv_pflicht: false, rv_pflicht: true });
      setAddingNew(false);
    } catch (error: unknown) {
      toast.error('Fehler', { description: error instanceof Error ? error.message : 'Unbekannter Fehler' });
    }
  };

  const handleDeleteEntry = async (entry: MitarbeiterNebenbeschaeftigung) => {
    try {
      await deleteMutation.mutateAsync({ id: entry.id, mitarbeiter_id: mitarbeiterId });
      toast.success('Nebenbeschäftigung entfernt');
    } catch (error: unknown) {
      toast.error('Fehler', { description: error instanceof Error ? error.message : 'Unbekannter Fehler' });
    }
  };

  const handleUpdateField = async (
    entry: MitarbeiterNebenbeschaeftigung,
    field: keyof Omit<MitarbeiterNebenbeschaeftigung, 'id' | 'mitarbeiter_id'>,
    value: string | number | boolean | null
  ) => {
    try {
      await updateMutation.mutateAsync({ id: entry.id, mitarbeiter_id: mitarbeiterId, [field]: value });
    } catch (error: unknown) {
      toast.error('Fehler beim Speichern', { description: error instanceof Error ? error.message : 'Unbekannter Fehler' });
    }
  };

  const handleGehaltsartSwitch = async (entry: MitarbeiterNebenbeschaeftigung, newArt: Gehaltsart) => {
    setEditGehaltsart((prev) => ({ ...prev, [entry.id]: newArt }));
    await handleUpdateField(entry, newArt === 'monatlich' ? 'gehalt_pro_stunde' : 'gehalt_monatlich', null);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Beschäftigungen bei <strong>anderen Arbeitgebern</strong> — unabhängig von der Beschäftigungsart bei Alltagshilfe Fischer.
        Relevant für Arbeitszeitgesetz und Pauschalversteuerung.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Lade Nebenbeschäftigungen...
        </div>
      ) : (
        <div className="space-y-4">
          {nebenbeschaeftigungen.map((entry) => {
            const gehaltsart = getGehaltsartForEntry(entry);
            const isMinijob = entry.art_beschaeftigung === 'minijob';
            return (
              <Card key={entry.id} className="relative">
                <CardContent className="pt-4 pb-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{entry.arbeitgeber}</span>
                      {entry.art_beschaeftigung && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {ART_LABELS[entry.art_beschaeftigung] || entry.art_beschaeftigung}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteEntry(entry)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Arbeitgeber</Label>
                      <Input
                        defaultValue={entry.arbeitgeber}
                        onBlur={(e) => {
                          if (e.target.value !== entry.arbeitgeber)
                            handleUpdateField(entry, 'arbeitgeber', e.target.value);
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Art (beim anderen AG)</Label>
                      <Select
                        defaultValue={entry.art_beschaeftigung || ''}
                        onValueChange={(v) => handleUpdateField(entry, 'art_beschaeftigung', v || null)}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minijob">Minijob</SelectItem>
                          <SelectItem value="sv_pflichtig">SV-pflichtig</SelectItem>
                          <SelectItem value="kurzfristig">Kurzfristig</SelectItem>
                          <SelectItem value="ehrenamt">Ehrenamt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Std./Woche</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        defaultValue={entry.arbeitszeit_stunden_woche ?? ''}
                        onBlur={(e) => {
                          const val = e.target.value ? parseFloat(e.target.value) : null;
                          if (val !== entry.arbeitszeit_stunden_woche)
                            handleUpdateField(entry, 'arbeitszeit_stunden_woche', val);
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-end gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Gehaltsart</Label>
                      <Select
                        value={gehaltsart}
                        onValueChange={(v) => handleGehaltsartSwitch(entry, v as Gehaltsart)}
                      >
                        <SelectTrigger className="h-8 text-sm w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monatlich">Monatsgehalt</SelectItem>
                          <SelectItem value="stuendlich">Stundenlohn</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 flex-1">
                      <Label className="text-xs">
                        {gehaltsart === 'monatlich' ? 'Gehalt/Monat (€)' : 'Gehalt/Stunde (€)'}
                      </Label>
                      {gehaltsart === 'monatlich' ? (
                        <Input
                          key={`${entry.id}-monatlich`}
                          type="number" min="0" step="0.01"
                          defaultValue={entry.gehalt_monatlich ?? ''}
                          onBlur={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : null;
                            if (val !== entry.gehalt_monatlich)
                              handleUpdateField(entry, 'gehalt_monatlich', val);
                          }}
                          className="h-8 text-sm"
                        />
                      ) : (
                        <Input
                          key={`${entry.id}-stuendlich`}
                          type="number" min="0" step="0.01"
                          defaultValue={entry.gehalt_pro_stunde ?? ''}
                          onBlur={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : null;
                            if (val !== entry.gehalt_pro_stunde)
                              handleUpdateField(entry, 'gehalt_pro_stunde', val);
                          }}
                          className="h-8 text-sm"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 pt-1">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={entry.sv_pflicht ?? false}
                        onCheckedChange={(checked) => handleUpdateField(entry, 'sv_pflicht', checked)}
                      />
                      <Label className="text-xs">SV-Pflicht (beim anderen AG)</Label>
                    </div>
                    {isMinijob && (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={entry.rv_pflicht ?? true}
                          onCheckedChange={(checked) => handleUpdateField(entry, 'rv_pflicht', checked)}
                        />
                        <Label className="text-xs">RV-Pflicht (beim anderen AG)</Label>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {nebenbeschaeftigungen.length === 0 && !addingNew && (
            <p className="text-sm text-muted-foreground italic">Keine Nebenbeschäftigungen eingetragen.</p>
          )}

          {addingNew ? (
            <Card className="border-dashed">
              <CardContent className="pt-4 pb-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Arbeitgeber *</Label>
                    <Input
                      value={newEntry.arbeitgeber}
                      onChange={(e) => setNewEntry({ ...newEntry, arbeitgeber: e.target.value })}
                      placeholder="Firmenname"
                      className="h-8 text-sm"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Art (beim anderen AG)</Label>
                    <Select
                      value={newEntry.art_beschaeftigung}
                      onValueChange={(v) => setNewEntry({ ...newEntry, art_beschaeftigung: v })}
                    >
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Auswählen" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minijob">Minijob</SelectItem>
                        <SelectItem value="sv_pflichtig">SV-pflichtig</SelectItem>
                        <SelectItem value="kurzfristig">Kurzfristig</SelectItem>
                        <SelectItem value="ehrenamt">Ehrenamt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Arbeitszeit (Std./Woche)</Label>
                  <Input
                    type="number" min="0" step="0.5"
                    value={newEntry.arbeitszeit_stunden_woche}
                    onChange={(e) => setNewEntry({ ...newEntry, arbeitszeit_stunden_woche: e.target.value })}
                    className="h-8 text-sm max-w-xs"
                  />
                </div>

                <div className="flex items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Gehaltsart</Label>
                    <Select
                      value={newEntry.gehaltsart}
                      onValueChange={(v) => setNewEntry({ ...newEntry, gehaltsart: v as Gehaltsart })}
                    >
                      <SelectTrigger className="h-8 text-sm w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monatlich">Monatsgehalt</SelectItem>
                        <SelectItem value="stuendlich">Stundenlohn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">
                      {newEntry.gehaltsart === 'monatlich' ? 'Gehalt/Monat (€)' : 'Gehalt/Stunde (€)'}
                    </Label>
                    {newEntry.gehaltsart === 'monatlich' ? (
                      <Input
                        type="number" min="0" step="0.01"
                        value={newEntry.gehalt_monatlich}
                        onChange={(e) => setNewEntry({ ...newEntry, gehalt_monatlich: e.target.value })}
                        className="h-8 text-sm"
                      />
                    ) : (
                      <Input
                        type="number" min="0" step="0.01"
                        value={newEntry.gehalt_pro_stunde}
                        onChange={(e) => setNewEntry({ ...newEntry, gehalt_pro_stunde: e.target.value })}
                        className="h-8 text-sm"
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={newEntry.sv_pflicht}
                      onCheckedChange={(checked) => setNewEntry({ ...newEntry, sv_pflicht: checked })}
                    />
                    <Label className="text-xs">SV-Pflicht (beim anderen AG)</Label>
                  </div>
                  {newEntry.art_beschaeftigung === 'minijob' && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={newEntry.rv_pflicht}
                        onCheckedChange={(checked) => setNewEntry({ ...newEntry, rv_pflicht: checked })}
                      />
                      <Label className="text-xs">RV-Pflicht (beim anderen AG)</Label>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleAddEntry} disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    Hinzufügen
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingNew(false)}>Abbrechen</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setAddingNew(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nebenbeschäftigung hinzufügen
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
