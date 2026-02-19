import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import AITimeWindowsCreator from '@/components/schedule/AITimeWindowsCreator';
import { useState } from 'react';

interface TimeWindow {
  wochentag: number;
  von: string;
  bis: string;
}

interface NotfallKontakt {
  name: string;
  bezug: string;
  telefon: string;
}

const WEEKDAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const SHIFT_BLOCKS = [
  { label: 'Vormittag', key: 'vormittag', von: '08:00', bis: '12:00' },
  { label: 'Mittag', key: 'mittag', von: '12:00', bis: '15:00' },
  { label: 'Nachmittag', key: 'nachmittag', von: '15:00', bis: '18:00' },
];

interface StepStammdatenProps {
  customerData: any;
  setCustomerData: (fn: (prev: any) => any) => void;
  weekMatrix: Record<number, Record<string, boolean>>;
  setWeekMatrix: (fn: (prev: Record<number, Record<string, boolean>>) => Record<number, Record<string, boolean>>) => void;
  employees: any[];
}

export function StepStammdaten({ customerData, setCustomerData, weekMatrix, setWeekMatrix, employees }: StepStammdatenProps) {
  const [showAITimeWindows, setShowAITimeWindows] = useState(false);

  const toggleMatrixCell = (day: number, shiftKey: string) => {
    setWeekMatrix((prev) => {
      const updated = { ...prev };
      if (!updated[day]) updated[day] = {};
      updated[day] = { ...updated[day], [shiftKey]: !updated[day][shiftKey] };
      return updated;
    });

    const shift = SHIFT_BLOCKS.find((s) => s.key === shiftKey)!;
    const isCurrentlyActive = weekMatrix[day]?.[shiftKey];

    if (isCurrentlyActive) {
      setCustomerData((prev: any) => ({
        ...prev,
        zeitfenster: prev.zeitfenster.filter((z: TimeWindow) => !(z.wochentag === day && z.von === shift.von && z.bis === shift.bis)),
      }));
    } else {
      setCustomerData((prev: any) => ({
        ...prev,
        zeitfenster: [...prev.zeitfenster, { wochentag: day, von: shift.von, bis: shift.bis }],
      }));
    }
  };

  const addNotfallkontakt = () => {
    setCustomerData((prev: any) => ({
      ...prev,
      notfallkontakte: [...prev.notfallkontakte, { name: '', bezug: '', telefon: '' }],
    }));
  };

  const removeNotfallkontakt = (index: number) => {
    setCustomerData((prev: any) => ({
      ...prev,
      notfallkontakte: prev.notfallkontakte.filter((_: any, i: number) => i !== index),
    }));
  };

  const updateNotfallkontakt = (index: number, field: keyof NotfallKontakt, value: string) => {
    setCustomerData((prev: any) => {
      const updated = [...prev.notfallkontakte];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, notfallkontakte: updated };
    });
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Kategorie-Auswahl */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Was möchten Sie anlegen?</h3>
        <div className="grid grid-cols-2 gap-4">
          {(['Interessent', 'Kunde'] as const).map((kat) => (
            <button
              key={kat}
              type="button"
              onClick={() => setCustomerData((prev: any) => ({ ...prev, kategorie: kat }))}
              className={`p-6 border-2 rounded-lg transition-all hover:scale-105 ${
                customerData.kategorie === kat ? 'border-primary bg-primary/10 shadow-lg' : 'border-muted bg-background hover:border-primary/50'
              }`}
            >
              <div className="text-center space-y-2">
                <div className={`text-2xl font-bold ${customerData.kategorie === kat ? 'text-primary' : 'text-foreground'}`}>{kat}</div>
                <p className="text-sm text-muted-foreground">{kat === 'Interessent' ? 'Für potenzielle neue Kunden' : 'Für bestehende Kunden'}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Basis-Informationen */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Basis-Informationen</h3>
        <div className="grid grid-cols-4 gap-4">
          <div><Label htmlFor="vorname">Vorname *</Label><Input id="vorname" value={customerData.vorname} onChange={(e) => setCustomerData((p: any) => ({ ...p, vorname: e.target.value }))} placeholder="Max" required /></div>
          <div><Label htmlFor="nachname">Nachname *</Label><Input id="nachname" value={customerData.nachname} onChange={(e) => setCustomerData((p: any) => ({ ...p, nachname: e.target.value }))} placeholder="Mustermann" required /></div>
          <div><Label htmlFor="geburtsdatum">Geburtsdatum</Label><Input id="geburtsdatum" type="date" value={customerData.geburtsdatum} onChange={(e) => setCustomerData((p: any) => ({ ...p, geburtsdatum: e.target.value }))} /></div>
          <div>
            <Label>Geschlecht</Label>
            <Select value={customerData.geschlecht} onValueChange={(v) => setCustomerData((p: any) => ({ ...p, geschlecht: v }))}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="maennlich">Männlich</SelectItem><SelectItem value="weiblich">Weiblich</SelectItem>
                <SelectItem value="divers">Divers</SelectItem><SelectItem value="keine_angabe">Keine Angabe</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Kontaktdaten */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Kontaktdaten</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2 col-span-3"><Label htmlFor="strasse">Straße und Hausnummer *</Label><Input id="strasse" value={customerData.strasse} onChange={(e) => setCustomerData((p: any) => ({ ...p, strasse: e.target.value }))} placeholder="Straße und Hausnummer" required /></div>
          <div className="space-y-2"><Label htmlFor="plz">PLZ *</Label><Input id="plz" value={customerData.plz} onChange={(e) => { const val = e.target.value.replace(/\D/g, '').slice(0, 5); setCustomerData((p: any) => ({ ...p, plz: val })); }} placeholder="30159" maxLength={5} inputMode="numeric" required /></div>
          <div className="space-y-2 col-span-2"><Label htmlFor="stadt">Stadt</Label><Input id="stadt" value={customerData.stadt} onChange={(e) => setCustomerData((p: any) => ({ ...p, stadt: e.target.value }))} placeholder="Stadt" /></div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div><Label htmlFor="stadtteil">Stadtteil</Label><Input id="stadtteil" value={customerData.stadtteil} onChange={(e) => setCustomerData((p: any) => ({ ...p, stadtteil: e.target.value }))} placeholder="z.B. Linden, Mitte" /></div>
          <div><Label htmlFor="telefonnr">Telefon *</Label><Input id="telefonnr" value={customerData.telefonnr} onChange={(e) => setCustomerData((p: any) => ({ ...p, telefonnr: e.target.value }))} placeholder="0511 123456" required /></div>
          <div><Label htmlFor="email">E-Mail</Label><Input id="email" type="email" value={customerData.email} onChange={(e) => setCustomerData((p: any) => ({ ...p, email: e.target.value }))} placeholder="kunde@email.de" /></div>
          <div>
            <Label>Bevorzugter Kontaktweg</Label>
            <Select value={customerData.kontaktweg} onValueChange={(v) => setCustomerData((p: any) => ({ ...p, kontaktweg: v }))}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent><SelectItem value="telefon">Telefon</SelectItem><SelectItem value="email">E-Mail</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Pflege-Informationen */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Pflege-Informationen</h3>
        <div className="grid grid-cols-3 gap-4">
          <div><Label htmlFor="pflegekasse">Pflegekasse</Label><Input id="pflegekasse" value={customerData.pflegekasse} onChange={(e) => setCustomerData((p: any) => ({ ...p, pflegekasse: e.target.value }))} placeholder="AOK, Barmer, etc." /></div>
          <div><Label htmlFor="versichertennummer">Versichertennummer</Label><Input id="versichertennummer" value={customerData.versichertennummer} onChange={(e) => setCustomerData((p: any) => ({ ...p, versichertennummer: e.target.value }))} /></div>
          <div>
            <Label htmlFor="pflegegrad">Pflegegrad</Label>
            <Select value={customerData.pflegegrad} onValueChange={(v) => setCustomerData((p: any) => ({ ...p, pflegegrad: v }))}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nicht_vorhanden">Nicht vorhanden</SelectItem>
                {[0,1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Kasse/Privat</Label>
            <Select value={customerData.kasse_privat} onValueChange={(v) => setCustomerData((p: any) => ({ ...p, kasse_privat: v }))}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent><SelectItem value="Kasse">Kasse</SelectItem><SelectItem value="Privat">Privat</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label htmlFor="verhinderungspflege_status">Verhinderungspflege</Label><Input id="verhinderungspflege_status" value={customerData.verhinderungspflege_status} onChange={(e) => setCustomerData((p: any) => ({ ...p, verhinderungspflege_status: e.target.value }))} /></div>
          <div>
            <Label>Kopie LW</Label>
            <Select value={customerData.kopie_lw} onValueChange={(v) => setCustomerData((p: any) => ({ ...p, kopie_lw: v }))}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent><SelectItem value="Ja">Ja</SelectItem><SelectItem value="Nein">Nein</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Rechnungskopie */}
      <div className="space-y-3 border-t pt-4">
        <h3 className="text-lg font-semibold">Rechnungskopie</h3>
        <div className="space-y-2">
          {['email', 'kunde', 'abweichende_adresse'].map((val) => (
            <div key={val} className="flex items-center space-x-2">
              <Checkbox id={`rechnungskopie_${val}`} checked={customerData.rechnungskopie.includes(val)} onCheckedChange={() => setCustomerData((prev: any) => ({
                ...prev, rechnungskopie: prev.rechnungskopie.includes(val) ? prev.rechnungskopie.filter((v: string) => v !== val) : [...prev.rechnungskopie, val]
              }))} />
              <Label htmlFor={`rechnungskopie_${val}`} className="cursor-pointer">
                {val === 'email' ? 'Per E-Mail' : val === 'kunde' ? 'An Kunde' : 'Abweichende Adresse'}
              </Label>
            </div>
          ))}
        </div>
        {customerData.rechnungskopie.includes('abweichende_adresse') && (
          <div className="grid grid-cols-2 gap-3 pl-6 border-l-2 border-primary/20">
            <div><Label className="text-xs">Name</Label><Input value={customerData.rechnungskopie_adresse_name} onChange={(e) => setCustomerData((p: any) => ({ ...p, rechnungskopie_adresse_name: e.target.value }))} placeholder="Name des Empfängers" /></div>
            <div><Label className="text-xs">Straße</Label><Input value={customerData.rechnungskopie_adresse_strasse} onChange={(e) => setCustomerData((p: any) => ({ ...p, rechnungskopie_adresse_strasse: e.target.value }))} /></div>
            <div><Label className="text-xs">PLZ</Label><Input value={customerData.rechnungskopie_adresse_plz} onChange={(e) => setCustomerData((p: any) => ({ ...p, rechnungskopie_adresse_plz: e.target.value }))} /></div>
            <div><Label className="text-xs">Stadt</Label><Input value={customerData.rechnungskopie_adresse_stadt} onChange={(e) => setCustomerData((p: any) => ({ ...p, rechnungskopie_adresse_stadt: e.target.value }))} /></div>
          </div>
        )}
      </div>

      {/* Terminplanung */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-lg font-semibold">Terminplanung</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Terminfrequenz</Label>
            <Select value={customerData.terminfrequenz} onValueChange={(v) => setCustomerData((p: any) => ({ ...p, terminfrequenz: v }))}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="14_taegig">14-tägig</SelectItem><SelectItem value="woechentlich">Wöchentlich</SelectItem>
                <SelectItem value="2x_woechentlich">2x wöchentlich</SelectItem><SelectItem value="3x_woechentlich">3x wöchentlich</SelectItem>
                <SelectItem value="4x_woechentlich">4x wöchentlich</SelectItem><SelectItem value="5x_woechentlich">5x wöchentlich</SelectItem>
                <SelectItem value="nach_bedarf">Nach Bedarf</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Termindauer (Std.)</Label><Input type="number" step="0.5" value={customerData.termindauer_stunden} onChange={(e) => setCustomerData((p: any) => ({ ...p, termindauer_stunden: e.target.value }))} /></div>
          <div><Label>Stundenkontingent/Monat</Label><Input type="number" step="0.5" value={customerData.stunden_kontingent_monat} onChange={(e) => setCustomerData((p: any) => ({ ...p, stunden_kontingent_monat: e.target.value }))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Eintrittsmonat</Label><Input type="month" value={customerData.eintritt} onChange={(e) => setCustomerData((p: any) => ({ ...p, eintritt: e.target.value }))} /></div>
          <div><Label>Startdatum</Label><Input type="date" value={customerData.startdatum} onChange={(e) => setCustomerData((p: any) => ({ ...p, startdatum: e.target.value }))} /></div>
        </div>
      </div>

      {/* Zeitfenster */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Zeitfenster</h3>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAITimeWindows(true)}>
              <Sparkles className="h-4 w-4 mr-1" />KI-Zeitfenster
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setCustomerData((p: any) => ({ ...p, zeitfenster: [...p.zeitfenster, { wochentag: 1, von: '08:00', bis: '12:00' }] }))}>
              <Plus className="h-4 w-4 mr-1" />Manuell hinzufügen
            </Button>
          </div>
        </div>

        {customerData.zeitfenster.map((zeitfenster: TimeWindow, index: number) => (
          <div key={index} className="grid grid-cols-[1fr,1fr,1fr,auto] gap-2 items-end p-3 border rounded-lg">
            <div>
              <Label className="text-xs">Wochentag</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm" value={zeitfenster.wochentag}
                onChange={(e) => { const updated = [...customerData.zeitfenster]; updated[index] = { ...updated[index], wochentag: parseInt(e.target.value) }; setCustomerData((p: any) => ({ ...p, zeitfenster: updated })); }}>
                {[1,2,3,4,5,6,0].map(d => <option key={d} value={d}>{WEEKDAY_NAMES[d]}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">Von</Label><Input type="time" value={zeitfenster.von || ''} onChange={(e) => { const updated = [...customerData.zeitfenster]; updated[index] = { ...updated[index], von: e.target.value }; setCustomerData((p: any) => ({ ...p, zeitfenster: updated })); }} /></div>
            <div><Label className="text-xs">Bis</Label><Input type="time" value={zeitfenster.bis || ''} onChange={(e) => { const updated = [...customerData.zeitfenster]; updated[index] = { ...updated[index], bis: e.target.value }; setCustomerData((p: any) => ({ ...p, zeitfenster: updated })); }} /></div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setCustomerData((p: any) => ({ ...p, zeitfenster: p.zeitfenster.filter((_: any, i: number) => i !== index) }))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}

        {customerData.zeitfenster.length > 0 && <div className="text-xs text-muted-foreground">{customerData.zeitfenster.length} Zeitfenster ausgewählt</div>}

        {showAITimeWindows && (
          <AITimeWindowsCreator
            onConfirm={(windows: TimeWindow[]) => {
              setWeekMatrix((prev) => {
                const newMatrix = { ...prev };
                windows.forEach(w => {
                  const matchingShift = SHIFT_BLOCKS.find(s => s.von === w.von && s.bis === w.bis);
                  if (matchingShift) { if (!newMatrix[w.wochentag]) newMatrix[w.wochentag] = {}; newMatrix[w.wochentag][matchingShift.key] = true; }
                });
                return newMatrix;
              });
              setCustomerData((prev: any) => ({ ...prev, zeitfenster: [...prev.zeitfenster, ...windows] }));
              setShowAITimeWindows(false);
            }}
            onCancel={() => setShowAITimeWindows(false)}
          />
        )}
      </div>

      {/* Notfallkontakte */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Notfallkontakte</h3>
          <Button type="button" variant="outline" size="sm" onClick={addNotfallkontakt}><Plus className="h-4 w-4 mr-1" />Kontakt hinzufügen</Button>
        </div>
        {customerData.notfallkontakte.map((kontakt: NotfallKontakt, index: number) => (
          <div key={index} className="grid grid-cols-[1fr,1fr,1fr,auto] gap-2 items-end p-3 border rounded-lg">
            <div><Label className="text-xs">Name</Label><Input value={kontakt.name} onChange={(e) => updateNotfallkontakt(index, 'name', e.target.value)} placeholder="Name" /></div>
            <div><Label className="text-xs">Bezug</Label><Input value={kontakt.bezug} onChange={(e) => updateNotfallkontakt(index, 'bezug', e.target.value)} placeholder="z.B. Sohn, Nachbar" /></div>
            <div><Label className="text-xs">Telefon</Label><Input value={kontakt.telefon} onChange={(e) => updateNotfallkontakt(index, 'telefon', e.target.value)} placeholder="0511 123456" /></div>
            {customerData.notfallkontakte.length > 1 && (
              <Button type="button" variant="ghost" size="icon" onClick={() => removeNotfallkontakt(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            )}
          </div>
        ))}
      </div>

      {/* Sonstiges */}
      <div className="space-y-3 border-t pt-4">
        <h3 className="text-lg font-semibold">Sonstiges</h3>
        <Textarea value={customerData.sonstiges} onChange={(e) => setCustomerData((p: any) => ({ ...p, sonstiges: e.target.value }))} placeholder="Weitere Notizen, Hinweise, Kommentare..." className="min-h-[80px]" />
      </div>

      {/* Betreuung */}
      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center space-x-2">
          <Checkbox id="has_regular_appointments" checked={customerData.has_regular_appointments} onCheckedChange={(checked) => setCustomerData((p: any) => ({ ...p, has_regular_appointments: checked as boolean }))} />
          <Label htmlFor="has_regular_appointments" className="cursor-pointer">Kunde hat regelmäßige Termine → Mitarbeiter-Matching starten</Label>
        </div>
      </div>
    </div>
  );
}
