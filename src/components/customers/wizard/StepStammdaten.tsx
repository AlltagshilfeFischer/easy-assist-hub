import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TimeInput } from '@/components/ui/time-input';
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
import AITimeWindowsCreator from '@/components/schedule/ai/AITimeWindowsCreator';
import { useSettings } from '@/hooks/useSettings';
import { PflegekasseCombobox } from '@/components/customers/PflegekasseCombobox';
import { WeekMatrixPicker } from '@/components/customers/WeekMatrixPicker';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useState, useMemo, useEffect } from 'react';

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
  { label: 'Früh',       key: 'frueh',       von: '08:30', bis: '10:00' },
  { label: 'Vormittag',  key: 'vormittag',   von: '10:00', bis: '12:00' },
  { label: 'Mittag',     key: 'mittag',      von: '12:00', bis: '13:30' },
  { label: 'Nachmittag', key: 'nachmittag',  von: '13:30', bis: '15:30' },
  { label: 'Abend',      key: 'abend',       von: '15:30', bis: '18:00' },
];

const WPM = 52 / 12; // exakte Wochen pro Monat (4.333...)

const FREQUENZ_PRO_MONAT: Record<string, number> = {
  '14_taegig': WPM / 2,
  'woechentlich': WPM,
  '2x_woechentlich': WPM * 2,
  '3x_woechentlich': WPM * 3,
  '4x_woechentlich': WPM * 4,
  '5x_woechentlich': WPM * 5,
};

const MONATSNAMEN = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

interface StepStammdatenProps {
  customerData: any;
  setCustomerData: (fn: (prev: any) => any) => void;
  employees: any[];
}

export function StepStammdaten({ customerData, setCustomerData, employees }: StepStammdatenProps) {
  const { settings } = useSettings();
  const [showAITimeWindows, setShowAITimeWindows] = useState(false);

  const aiAvailable = !!settings.openAiApiKey;

  const berechnetesKontingent = useMemo(() => {
    const pro = FREQUENZ_PRO_MONAT[customerData.terminfrequenz];
    const dauer = parseFloat(customerData.termindauer_stunden);
    if (!pro || !dauer || isNaN(dauer)) return '';
    return (pro * dauer).toFixed(1);
  }, [customerData.terminfrequenz, customerData.termindauer_stunden]);

  // Bug-Fix: berechneten Wert in customerData schreiben damit der Insert ihn nutzt
  useEffect(() => {
    if (berechnetesKontingent) {
      setCustomerData((p: any) => ({ ...p, stunden_kontingent_monat: berechnetesKontingent }));
    }
  }, [berechnetesKontingent, setCustomerData]);

  const [startdatumDisplay, setStartdatumDisplay] = useState(() => {
    if (!customerData.startdatum) return '';
    const parts = (customerData.startdatum as string).split('-');
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : '';
  });

  // weekMatrix abgeleitet aus zeitfenster (bidirektionale Synchronisation)
  const weekMatrix = useMemo(() => {
    const matrix: Record<number, Record<string, boolean>> = {};
    (customerData.zeitfenster || []).forEach((z: TimeWindow) => {
      const shift = SHIFT_BLOCKS.find((s) => s.von === z.von && s.bis === z.bis);
      if (shift) {
        if (!matrix[z.wochentag]) matrix[z.wochentag] = {};
        matrix[z.wochentag][shift.key] = true;
      }
    });
    return matrix;
  }, [customerData.zeitfenster]);

  const toggleMatrixCell = (day: number, shiftKey: string) => {
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

  const isKunde = customerData.kategorie === 'Kunde';

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
        <div className="grid grid-cols-5 gap-4">
          <div>
            <Label>Titel / Präfix</Label>
            <Select value={customerData.titel || '__none__'} onValueChange={(v) => setCustomerData((p: any) => ({ ...p, titel: v === '__none__' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Kein Titel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Kein Titel</SelectItem>
                <SelectItem value="Dr.">Dr.</SelectItem>
                <SelectItem value="Dr. med.">Dr. med.</SelectItem>
                <SelectItem value="Prof.">Prof.</SelectItem>
                <SelectItem value="Prof. Dr.">Prof. Dr.</SelectItem>
                <SelectItem value="Dipl.-Ing.">Dipl.-Ing.</SelectItem>
                <SelectItem value="Mag.">Mag.</SelectItem>
                <SelectItem value="M.Sc.">M.Sc.</SelectItem>
                <SelectItem value="B.Sc.">B.Sc.</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label htmlFor="vorname">Vorname{isKunde ? ' *' : ''}</Label><Input id="vorname" value={customerData.vorname} onChange={(e) => setCustomerData((p: any) => ({ ...p, vorname: e.target.value }))} placeholder="Max" required={isKunde} /></div>
          <div><Label htmlFor="nachname">Nachname *</Label><Input id="nachname" value={customerData.nachname} onChange={(e) => setCustomerData((p: any) => ({ ...p, nachname: e.target.value }))} placeholder="Mustermann" required /></div>
          <div>
            <Label htmlFor="geburtsdatum">Geburtsdatum</Label>
            <Input
              id="geburtsdatum"
              type="date"
              value={customerData.geburtsdatum}
              onChange={(e) => setCustomerData((p: any) => ({ ...p, geburtsdatum: e.target.value }))}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text').trim();
                const match = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
                if (match) {
                  e.preventDefault();
                  const [, day, month, year] = match;
                  setCustomerData((p: any) => ({ ...p, geburtsdatum: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` }));
                }
              }}
            />
          </div>
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
          <div className="space-y-2 col-span-2"><Label htmlFor="stadt">Stadt *</Label><Input id="stadt" value={customerData.stadt} onChange={(e) => setCustomerData((p: any) => ({ ...p, stadt: e.target.value }))} placeholder="Stadt" required /></div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div><Label htmlFor="stadtteil">Stadtteil</Label><Input id="stadtteil" value={customerData.stadtteil} onChange={(e) => setCustomerData((p: any) => ({ ...p, stadtteil: e.target.value }))} placeholder="z.B. Linden, Mitte" /></div>
          <div><Label htmlFor="telefonnr">Telefon{isKunde ? ' *' : ''}</Label><Input id="telefonnr" value={customerData.telefonnr} onChange={(e) => { const val = e.target.value.replace(/[^\d+\-\/ ()]/g, ''); setCustomerData((p: any) => ({ ...p, telefonnr: val })); }} placeholder="0511 123456" inputMode="tel" required={isKunde} /></div>
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
        <h3 className="text-lg font-semibold">Pflege-Informationen{!isKunde && <span className="text-sm font-normal text-muted-foreground ml-2">(optional)</span>}</h3>
        <div className="grid grid-cols-3 gap-4">
          <div><Label>Pflegekasse</Label><PflegekasseCombobox value={customerData.pflegekasse} onValueChange={(v) => setCustomerData((p: any) => ({ ...p, pflegekasse: v }))} /></div>
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
        <div className="grid grid-cols-2 gap-4">
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

      {/* Rechnungskopie — nur fuer Kunden */}
      {isKunde && (
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
      )}

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
          <div>
            <Label>Termindauer (Std.)</Label>
            <Input type="number" step="0.5" value={customerData.termindauer_stunden} onChange={(e) => setCustomerData((p: any) => ({ ...p, termindauer_stunden: e.target.value }))} />
          </div>
          <div>
            <Label>Stunden/Monat <span className="text-xs text-muted-foreground">(berechnet)</span></Label>
            <Input
              readOnly
              value={berechnetesKontingent || customerData.stunden_kontingent_monat || ''}
              className="bg-muted cursor-default"
              placeholder="— wird aus Frequenz × Dauer berechnet"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Eintrittsmonat</Label>
            <div className="flex gap-2">
              <Select
                value={customerData.eintritt?.split('-')[1] ?? ''}
                onValueChange={(m) => {
                  const y = customerData.eintritt?.split('-')[0] || new Date().getFullYear().toString();
                  setCustomerData((p: any) => ({ ...p, eintritt: `${y}-${m}` }));
                }}
              >
                <SelectTrigger className="flex-1"><SelectValue placeholder="Monat" /></SelectTrigger>
                <SelectContent>
                  {MONATSNAMEN.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                className="w-20"
                placeholder="Jahr"
                value={customerData.eintritt?.split('-')[0] ?? ''}
                onChange={(e) => {
                  const m = customerData.eintritt?.split('-')[1] || String(new Date().getMonth() + 1).padStart(2, '0');
                  setCustomerData((p: any) => ({ ...p, eintritt: `${e.target.value}-${m}` }));
                }}
              />
            </div>
          </div>
          <div>
            <Label>Startdatum <span className="text-xs text-muted-foreground">(TT.MM.JJJJ)</span></Label>
            <Input
              placeholder="TT.MM.JJJJ"
              value={startdatumDisplay}
              onChange={(e) => {
                const raw = e.target.value;
                setStartdatumDisplay(raw);
                const match = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
                if (match) {
                  const [, d, m, y] = match;
                  setCustomerData((p: any) => ({ ...p, startdatum: `${y}-${m}-${d}` }));
                } else if (!raw) {
                  setCustomerData((p: any) => ({ ...p, startdatum: '' }));
                }
                // Partial input: state wird erst geschrieben wenn Format komplett ist
              }}
            />
          </div>
        </div>
      </div>

      {/* Zeitfenster */}
      <div className="space-y-3 border-t pt-4">
        <h3 className="text-lg font-semibold">Zeitfenster</h3>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Klicken Sie auf die gewünschten Zeitblöcke:</p>
          <WeekMatrixPicker matrix={weekMatrix} onToggle={toggleMatrixCell} />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Oder: Individuelle Zeiten</p>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!aiAvailable}
                      onClick={() => setShowAITimeWindows(true)}
                    >
                      <Sparkles className="h-4 w-4 mr-1" />KI-Zeitfenster
                    </Button>
                  </span>
                </TooltipTrigger>
                {!aiAvailable && (
                  <TooltipContent>
                    <p>OpenAI API-Schlüssel fehlt — in den Einstellungen hinterlegen</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <Button type="button" variant="outline" size="sm" onClick={() => setCustomerData((p: any) => ({ ...p, zeitfenster: [...p.zeitfenster, { wochentag: 1, von: '09:00', bis: '10:30' }] }))}>
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
            <div><Label className="text-xs">Von</Label><TimeInput value={zeitfenster.von || ''} onChange={(v) => { const updated = [...customerData.zeitfenster]; updated[index] = { ...updated[index], von: v }; setCustomerData((p: any) => ({ ...p, zeitfenster: updated })); }} /></div>
            <div><Label className="text-xs">Bis</Label><TimeInput value={zeitfenster.bis || ''} onChange={(v) => { const updated = [...customerData.zeitfenster]; updated[index] = { ...updated[index], bis: v }; setCustomerData((p: any) => ({ ...p, zeitfenster: updated })); }} /></div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setCustomerData((p: any) => ({ ...p, zeitfenster: p.zeitfenster.filter((_: any, i: number) => i !== index) }))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}

        {customerData.zeitfenster.length > 0 && <div className="text-xs text-muted-foreground">{customerData.zeitfenster.length} Zeitfenster ausgewählt</div>}

        {showAITimeWindows && (
          <AITimeWindowsCreator
            onConfirm={(windows: TimeWindow[]) => {
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
            <div><Label className="text-xs">Telefon</Label><Input value={kontakt.telefon} onChange={(e) => updateNotfallkontakt(index, 'telefon', e.target.value.replace(/[^\d+\-\/ ()]/g, ''))} placeholder="0511 123456" inputMode="tel" /></div>
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
          <Label htmlFor="has_regular_appointments" className="cursor-pointer">Hat regelmäßige Termine → Mitarbeiter-Matching starten</Label>
        </div>
      </div>
    </div>
  );
}
