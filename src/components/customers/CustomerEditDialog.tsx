import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import AITimeWindowsCreator from '@/components/schedule/AITimeWindowsCreator';

interface CustomerEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCustomer: any;
  setEditingCustomer: (c: any) => void;
  employees: any[] | undefined;
  onSave: (e: React.FormEvent) => void;
}

const getWeekdayName = (day: number): string => {
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return days[day] || '';
};

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const dateToMonth = (dateString: string | null) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export function CustomerEditDialog({
  open,
  onOpenChange,
  editingCustomer,
  setEditingCustomer,
  employees,
  onSave,
}: CustomerEditDialogProps) {
  const [showAITimeWindows, setShowAITimeWindows] = useState(false);

  if (!editingCustomer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kundendaten bearbeiten</DialogTitle>
          <DialogDescription>
            Bearbeiten Sie alle Informationen für {editingCustomer?.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSave} className="space-y-6">
          {/* Persönliche Daten */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Persönliche Daten</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="kategorie">Kategorie</Label>
                <Select value={editingCustomer.kategorie || 'Kunde'} onValueChange={(value) => setEditingCustomer({ ...editingCustomer, kategorie: value })}>
                  <SelectTrigger id="kategorie"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Interessent">Interessent</SelectItem>
                    <SelectItem value="Kunde">Kunde</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="vorname">Vorname</Label>
                <Input id="vorname" value={editingCustomer.vorname || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, vorname: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="nachname">Nachname</Label>
                <Input id="nachname" value={editingCustomer.nachname || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, nachname: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="geburtsdatum">Geburtsdatum</Label>
                <Input id="geburtsdatum" type="date" value={editingCustomer.geburtsdatum || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, geburtsdatum: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hauptbetreuer">Hauptbetreuer</Label>
                <Select value={editingCustomer.mitarbeiter || '__none__'} onValueChange={(value) => setEditingCustomer({ ...editingCustomer, mitarbeiter: value === '__none__' ? null : value })}>
                  <SelectTrigger id="hauptbetreuer"><SelectValue placeholder="Hauptbetreuer auswählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Kein Hauptbetreuer</SelectItem>
                    {employees?.filter((e: any) => e.ist_aktiv).map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>
                        {`${m.vorname || ''} ${m.nachname || ''}`.trim() || m.email || 'Unbenannter Mitarbeiter'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-strasse">Straße</Label>
                <Input id="edit-strasse" value={editingCustomer.strasse || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, strasse: e.target.value })} placeholder="Straße und Hausnummer" />
              </div>
              <div>
                <Label htmlFor="edit-plz">PLZ</Label>
                <Input id="edit-plz" value={editingCustomer.plz || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, plz: e.target.value })} placeholder="PLZ" />
              </div>
              <div>
                <Label htmlFor="edit-stadt">Stadt</Label>
                <Input id="edit-stadt" value={editingCustomer.stadt || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, stadt: e.target.value })} placeholder="Stadt" />
              </div>
              <div>
                <Label htmlFor="stadtteil">Stadtteil</Label>
                <Input id="stadtteil" value={editingCustomer.stadtteil || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, stadtteil: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Kontaktdaten */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold">Kontaktdaten</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><Label htmlFor="telefonnr">Telefon</Label><Input id="telefonnr" value={editingCustomer.telefonnr || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, telefonnr: e.target.value })} /></div>
              <div><Label htmlFor="email">E-Mail</Label><Input id="email" type="email" value={editingCustomer.email || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })} /></div>
            </div>
          </div>

          {/* Pflegedaten */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold">Pflegedaten</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><Label htmlFor="pflegegrad">Pflegegrad</Label><Input id="pflegegrad" type="number" min="0" max="5" value={editingCustomer.pflegegrad || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, pflegegrad: e.target.value ? parseInt(e.target.value) : null })} /></div>
              <div><Label htmlFor="stunden_kontingent_monat">Stunden</Label><Input id="stunden_kontingent_monat" type="number" step="0.5" value={editingCustomer.stunden_kontingent_monat || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, stunden_kontingent_monat: e.target.value ? parseFloat(e.target.value) : null })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label htmlFor="versichertennummer">Versichertennummer</Label><Input id="versichertennummer" value={editingCustomer.versichertennummer || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, versichertennummer: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kasse_privat">Pflegekasse</Label>
                <Select value={editingCustomer.kasse_privat || '__none__'} onValueChange={(value) => setEditingCustomer({ ...editingCustomer, kasse_privat: value === '__none__' ? null : value })}>
                  <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Auswählen</SelectItem>
                    <SelectItem value="Kasse">Kasse</SelectItem>
                    <SelectItem value="Privat">Privat</SelectItem>
                    <SelectItem value="Verordnung">Verordnung</SelectItem>
                    <SelectItem value="Abweichende Rechnungsadresse">Abweichende Rechnungsadresse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="verhinderungspflege_status">Verhinderungspflege Status</Label><Input id="verhinderungspflege_status" value={editingCustomer.verhinderungspflege_status || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, verhinderungspflege_status: e.target.value })} /></div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold">Status</h3>
            <div>
              <Label htmlFor="aktiv" className="text-base font-medium">Status</Label>
              <Select value={editingCustomer.aktiv ? 'true' : 'false'} onValueChange={(value) => setEditingCustomer({ ...editingCustomer, aktiv: value === 'true' })}>
                <SelectTrigger id="aktiv"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Aktiv</SelectItem>
                  <SelectItem value="false">Nicht aktiv</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="begruendung">Begründung für Austritt/Deaktivierung</Label>
              <Textarea id="begruendung" value={editingCustomer.begruendung || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, begruendung: e.target.value })} placeholder="Begründung eingeben..." rows={3} />
            </div>
          </div>

          {/* Ein- und Austrittsdaten */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold">Ein- und Austrittsdaten</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><Label htmlFor="eintritt">Eintrittsmonat</Label><Input id="eintritt" type="month" value={dateToMonth(editingCustomer.eintritt) || getCurrentMonth()} onChange={(e) => setEditingCustomer({ ...editingCustomer, eintritt: e.target.value })} /></div>
              <div><Label htmlFor="austritt">Austrittsmonat</Label><Input id="austritt" type="month" value={dateToMonth(editingCustomer.austritt) || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, austritt: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kopie_lw">Kopie LW</Label>
                <Select value={editingCustomer.kopie_lw || '__none__'} onValueChange={(value) => setEditingCustomer({ ...editingCustomer, kopie_lw: value === '__none__' ? null : value })}>
                  <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Auswählen</SelectItem>
                    <SelectItem value="Ja">Ja</SelectItem>
                    <SelectItem value="Nein">Nein</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label htmlFor="angehoerige_ansprechpartner">Angehörige/Ansprechpartner</Label><Input id="angehoerige_ansprechpartner" value={editingCustomer.angehoerige_ansprechpartner || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, angehoerige_ansprechpartner: e.target.value })} /></div>
            <div><Label htmlFor="sonstiges">Sonstiges</Label><Textarea id="sonstiges" value={editingCustomer.sonstiges || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, sonstiges: e.target.value })} rows={3} /></div>
          </div>

          {/* Zeitfenster Section */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">Zeitfenster</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAITimeWindows(true)}>
                  <Sparkles className="h-4 w-4 mr-1" />KI-Zeitfenster
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  const zeitfenster = editingCustomer.zeitfenster || [];
                  setEditingCustomer({ ...editingCustomer, zeitfenster: [...zeitfenster, { wochentag: 1, von: '08:00', bis: '12:00' }] });
                }}>
                  <Plus className="h-4 w-4 mr-1" />Manuell hinzufügen
                </Button>
              </div>
            </div>

            {(editingCustomer.zeitfenster || []).map((zeitfenster: any, index: number) => (
              <div key={index} className="grid grid-cols-[1fr,1fr,1fr,auto] gap-2 items-end p-3 border rounded-lg">
                <div>
                  <Label className="text-xs">Wochentag</Label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors" value={zeitfenster.wochentag}
                    onChange={(e) => {
                      const updated = [...(editingCustomer.zeitfenster || [])];
                      updated[index] = { ...updated[index], wochentag: parseInt(e.target.value) };
                      setEditingCustomer({ ...editingCustomer, zeitfenster: updated });
                    }}>
                    <option value="0">Sonntag</option><option value="1">Montag</option><option value="2">Dienstag</option>
                    <option value="3">Mittwoch</option><option value="4">Donnerstag</option><option value="5">Freitag</option><option value="6">Samstag</option>
                  </select>
                </div>
                <div><Label className="text-xs">Von</Label><Input type="time" value={zeitfenster.von || ''} onChange={(e) => { const updated = [...(editingCustomer.zeitfenster || [])]; updated[index] = { ...updated[index], von: e.target.value }; setEditingCustomer({ ...editingCustomer, zeitfenster: updated }); }} /></div>
                <div><Label className="text-xs">Bis</Label><Input type="time" value={zeitfenster.bis || ''} onChange={(e) => { const updated = [...(editingCustomer.zeitfenster || [])]; updated[index] = { ...updated[index], bis: e.target.value }; setEditingCustomer({ ...editingCustomer, zeitfenster: updated }); }} /></div>
                <Button type="button" variant="ghost" size="icon" onClick={() => {
                  const updated = (editingCustomer.zeitfenster || []).filter((_: any, i: number) => i !== index);
                  setEditingCustomer({ ...editingCustomer, zeitfenster: updated });
                }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}

            {(editingCustomer.zeitfenster || []).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(() => {
                  const grouped = (editingCustomer.zeitfenster || []).reduce((acc: any, slot: any) => {
                    if (!acc[slot.wochentag]) acc[slot.wochentag] = [];
                    acc[slot.wochentag].push(slot);
                    return acc;
                  }, {});
                  const sortedDays = Object.keys(grouped).map(Number).sort((a, b) => { const aD = a === 0 ? 7 : a; const bD = b === 0 ? 7 : b; return aD - bD; });
                  return sortedDays.map((day) => (
                    <Badge key={day} variant="outline" className="text-xs">
                      <span className="font-semibold">{getWeekdayName(day)}</span>
                      <span className="mx-1">·</span>
                      <span className="text-muted-foreground">
                        {grouped[day].map((slot: any, idx: number) => (
                          <span key={idx}>{slot.von?.substring(0, 5)}-{slot.bis?.substring(0, 5)}{idx < grouped[day].length - 1 && ', '}</span>
                        ))}
                      </span>
                    </Badge>
                  ));
                })()}
              </div>
            )}

            {showAITimeWindows && (
              <AITimeWindowsCreator
                onConfirm={(windows: any[]) => {
                  setEditingCustomer({
                    ...editingCustomer,
                    zeitfenster: [...(editingCustomer.zeitfenster || []), ...windows],
                  });
                  setShowAITimeWindows(false);
                }}
                onCancel={() => setShowAITimeWindows(false)}
              />
            )}
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit">Speichern</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
