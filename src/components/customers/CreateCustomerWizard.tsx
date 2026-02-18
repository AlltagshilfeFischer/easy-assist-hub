import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Trash2, Sparkles, ArrowRight, Loader2, UserCheck, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AITimeWindowsCreator from '@/components/schedule/AITimeWindowsCreator';

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

interface EmployeeSuggestion {
  mitarbeiter_id: string;
  match_score: number;
  reasoning: string;
  employee: {
    id: string;
    vorname: string;
    nachname: string;
    plz: string;
    zustaendigkeitsbereich: string;
  };
}

interface CreateCustomerWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: any[];
  onSuccess: () => void;
}

const WEEKDAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const SHIFT_BLOCKS = [
  { label: 'Vormittag', key: 'vormittag', von: '08:00', bis: '12:00' },
  { label: 'Mittag', key: 'mittag', von: '12:00', bis: '15:00' },
  { label: 'Nachmittag', key: 'nachmittag', von: '15:00', bis: '18:00' },
];

export default function CreateCustomerWizard({ 
  open, 
  onOpenChange, 
  employees,
  onSuccess 
}: CreateCustomerWizardProps) {
  const [step, setStep] = useState<'customer' | 'timewindows' | 'employees'>('customer');
  const [showAITimeWindows, setShowAITimeWindows] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [createdCustomerId, setCreatedCustomerId] = useState<string | null>(null);
  
  const [preferences, setPreferences] = useState('');
  const [frequency, setFrequency] = useState('');
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<EmployeeSuggestion[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  const getCurrentMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const monthToDate = (monthString: string) => {
    if (!monthString) return null;
    return `${monthString}-01`;
  };

  const [customerData, setCustomerData] = useState({
    kategorie: 'Kunde',
    vorname: '',
    nachname: '',
    geburtsdatum: '',
    geschlecht: '',
    strasse: '',
    stadt: '',
    plz: '',
    stadtteil: '',
    telefonnr: '',
    email: '',
    kontaktweg: '',
    pflegekasse: '',
    versichertennummer: '',
    pflegegrad: '',
    kasse_privat: '',
    verhinderungspflege_status: '',
    kopie_lw: '',
    rechnungskopie: [] as string[],
    rechnungskopie_adresse_name: '',
    rechnungskopie_adresse_strasse: '',
    rechnungskopie_adresse_plz: '',
    rechnungskopie_adresse_stadt: '',
    stunden_kontingent_monat: '',
    terminfrequenz: '',
    termindauer_stunden: '1.5',
    startdatum: '',
    eintritt: getCurrentMonth(),
    austritt: '',
    angehoerige_ansprechpartner: '',
    has_regular_appointments: false,
    mitarbeiter: '',
    zeitfenster: [] as TimeWindow[],
    notfallkontakte: [{ name: '', bezug: '', telefon: '' }] as NotfallKontakt[],
    sonstiges: '',
  });

  // Wochenmatrix state: [wochentag][shift_key] = boolean
  const [weekMatrix, setWeekMatrix] = useState<Record<number, Record<string, boolean>>>({});

  const toggleMatrixCell = (day: number, shiftKey: string) => {
    setWeekMatrix(prev => {
      const updated = { ...prev };
      if (!updated[day]) updated[day] = {};
      updated[day] = { ...updated[day], [shiftKey]: !updated[day][shiftKey] };
      return updated;
    });

    // Sync to zeitfenster
    const shift = SHIFT_BLOCKS.find(s => s.key === shiftKey)!;
    const isCurrentlyActive = weekMatrix[day]?.[shiftKey];

    if (isCurrentlyActive) {
      // Remove
      setCustomerData(prev => ({
        ...prev,
        zeitfenster: prev.zeitfenster.filter(
          z => !(z.wochentag === day && z.von === shift.von && z.bis === shift.bis)
        )
      }));
    } else {
      // Add
      setCustomerData(prev => ({
        ...prev,
        zeitfenster: [...prev.zeitfenster, { wochentag: day, von: shift.von, bis: shift.bis }]
      }));
    }
  };

  const resetWizard = () => {
    setStep('customer');
    setShowAITimeWindows(false);
    setCreatedCustomerId(null);
    setPreferences('');
    setFrequency('');
    setSuggestions([]);
    setSelectedEmployee(null);
    setWeekMatrix({});
    setCustomerData({
      kategorie: 'Kunde',
      vorname: '',
      nachname: '',
      geburtsdatum: '',
      geschlecht: '',
      strasse: '',
      stadt: '',
      plz: '',
      stadtteil: '',
      telefonnr: '',
      email: '',
      kontaktweg: '',
      pflegekasse: '',
      versichertennummer: '',
      pflegegrad: '',
      kasse_privat: '',
      verhinderungspflege_status: '',
      kopie_lw: '',
      rechnungskopie: [],
      rechnungskopie_adresse_name: '',
      rechnungskopie_adresse_strasse: '',
      rechnungskopie_adresse_plz: '',
      rechnungskopie_adresse_stadt: '',
      stunden_kontingent_monat: '',
      terminfrequenz: '',
      termindauer_stunden: '1.5',
      startdatum: '',
      eintritt: getCurrentMonth(),
      austritt: '',
      angehoerige_ansprechpartner: '',
      has_regular_appointments: false,
      mitarbeiter: '',
      zeitfenster: [],
      notfallkontakte: [{ name: '', bezug: '', telefon: '' }],
      sonstiges: '',
    });
  };

  const handleClose = () => {
    resetWizard();
    onOpenChange(false);
  };

  const handleSaveCustomerAndTimeWindows = async () => {
    if (!customerData.vorname || !customerData.nachname) {
      toast.error('Bitte Vor- und Nachname ausfüllen');
      return;
    }
    if (!customerData.strasse.trim()) {
      toast.error('Bitte Straße und Hausnummer ausfüllen');
      return;
    }
    if (!customerData.plz.trim() || !/^\d{5}$/.test(customerData.plz.trim())) {
      toast.error('Bitte eine gültige 5-stellige PLZ eingeben');
      return;
    }
    if (!customerData.telefonnr.trim()) {
      toast.error('Bitte Telefonnummer ausfüllen');
      return;
    }

    setIsLoading(true);
    try {
      const insertData: Record<string, any> = {
        kategorie: customerData.kategorie,
        vorname: customerData.vorname,
        nachname: customerData.nachname,
        telefonnr: customerData.telefonnr || null,
        email: customerData.email || null,
        strasse: customerData.strasse || null,
        stadt: customerData.stadt || null,
        plz: customerData.plz || null,
        stadtteil: customerData.stadtteil || null,
        geburtsdatum: customerData.geburtsdatum || null,
        geschlecht: customerData.geschlecht || null,
        kontaktweg: customerData.kontaktweg || null,
        pflegekasse: customerData.pflegekasse || null,
        versichertennummer: customerData.versichertennummer || null,
        pflegegrad: customerData.pflegegrad ? parseInt(customerData.pflegegrad) : null,
        stunden_kontingent_monat: customerData.stunden_kontingent_monat ? parseFloat(customerData.stunden_kontingent_monat) : null,
        terminfrequenz: customerData.terminfrequenz || null,
        termindauer_stunden: customerData.termindauer_stunden ? parseFloat(customerData.termindauer_stunden) : 1.5,
        startdatum: customerData.startdatum || null,
        eintritt: monthToDate(customerData.eintritt),
        austritt: monthToDate(customerData.austritt),
        angehoerige_ansprechpartner: customerData.angehoerige_ansprechpartner || null,
        kasse_privat: customerData.kasse_privat || null,
        verhinderungspflege_status: customerData.verhinderungspflege_status || null,
        kopie_lw: customerData.kopie_lw || null,
        rechnungskopie: customerData.rechnungskopie.length > 0 ? customerData.rechnungskopie : null,
        sonstiges: customerData.sonstiges || null,
      };

      if (customerData.rechnungskopie.includes('abweichende_adresse')) {
        insertData.rechnungskopie_adresse_name = customerData.rechnungskopie_adresse_name || null;
        insertData.rechnungskopie_adresse_strasse = customerData.rechnungskopie_adresse_strasse || null;
        insertData.rechnungskopie_adresse_plz = customerData.rechnungskopie_adresse_plz || null;
        insertData.rechnungskopie_adresse_stadt = customerData.rechnungskopie_adresse_stadt || null;
      }

      const { data: customer, error: customerError } = await (supabase as any)
        .from('kunden')
        .insert([insertData])
        .select()
        .single();

      if (customerError) throw customerError;

      setCreatedCustomerId(customer.id);

      // Save time windows
      if (customerData.zeitfenster.length > 0) {
        const windowsToInsert = customerData.zeitfenster.map((w) => ({
          kunden_id: customer.id,
          wochentag: w.wochentag,
          von: w.von,
          bis: w.bis
        }));

        const { error: zeitfensterError } = await (supabase as any)
          .from('kunden_zeitfenster')
          .insert(windowsToInsert);

        if (zeitfensterError) throw zeitfensterError;
      }

      // Save Notfallkontakte
      const validKontakte = customerData.notfallkontakte.filter(k => k.name.trim() && k.telefon.trim());
      if (validKontakte.length > 0) {
        const kontakteToInsert = validKontakte.map(k => ({
          kunden_id: customer.id,
          name: k.name.trim(),
          bezug: k.bezug.trim() || null,
          telefon: k.telefon.trim(),
        }));

        const { error: kontaktError } = await (supabase as any)
          .from('notfallkontakte')
          .insert(kontakteToInsert);

        if (kontaktError) throw kontaktError;
      }

      toast.success('Kundendaten gespeichert');
      
      if (customerData.has_regular_appointments && customerData.zeitfenster.length > 0) {
        setStep('employees');
      } else {
        handleClose();
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error saving customer:', error);
      toast.error(error.message || 'Fehler beim Speichern');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!frequency.trim()) {
      toast.error('Bitte Frequenz angeben');
      return;
    }

    setSuggestionsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-employees', {
        body: {
          timeWindows: customerData.zeitfenster,
          plz: customerData.plz,
          preferences,
          frequency
        }
      });

      if (error) throw error;

      if (!data?.suggestions || data.suggestions.length === 0) {
        toast.error('Keine passenden Mitarbeiter gefunden');
        return;
      }

      setSuggestions(data.suggestions);
      toast.success(`${data.suggestions.length} Mitarbeiter vorgeschlagen`);
    } catch (error: any) {
      console.error('Error suggesting employees:', error);
      toast.error('Fehler beim Vorschlagen von Mitarbeitern');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleConfirmEmployee = async () => {
    if (!selectedEmployee || !createdCustomerId) {
      toast.error('Bitte wählen Sie einen Mitarbeiter aus');
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await (supabase as any)
        .from('kunden')
        .update({ mitarbeiter: selectedEmployee })
        .eq('id', createdCustomerId);

      if (updateError) throw updateError;

      for (const timeWindow of customerData.zeitfenster) {
        const today = new Date();
        const dayOfWeek = timeWindow.wochentag;
        const daysUntilNext = (dayOfWeek - today.getDay() + 7) % 7 || 7;
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + daysUntilNext);

        const { error: vorlageError } = await (supabase as any)
          .from('termin_vorlagen')
          .insert([{
            titel: `${customerData.vorname} ${customerData.nachname}`,
            kunden_id: createdCustomerId,
            mitarbeiter_id: selectedEmployee,
            wochentag: timeWindow.wochentag,
            start_zeit: timeWindow.von,
            dauer_minuten: calculateDuration(timeWindow.von, timeWindow.bis),
            intervall: 'weekly',
            ist_aktiv: true,
            gueltig_von: new Date().toISOString().split('T')[0]
          }]);

        if (vorlageError) {
          console.error('Error creating template:', vorlageError);
        }
      }

      toast.success('Regeltermin erfolgreich erstellt');
      handleClose();
      onSuccess();
    } catch (error: any) {
      console.error('Error confirming employee:', error);
      toast.error(error.message || 'Fehler beim Erstellen des Regeltermins');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDuration = (von: string, bis: string): number => {
    const [vonH, vonM] = von.split(':').map(Number);
    const [bisH, bisM] = bis.split(':').map(Number);
    return (bisH * 60 + bisM) - (vonH * 60 + vonM);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleSkipEmployeeMatching = async () => {
    toast.success('Kunde erfolgreich angelegt');
    handleClose();
    onSuccess();
  };

  const handleRechnungskopieToggle = (value: string) => {
    setCustomerData(prev => ({
      ...prev,
      rechnungskopie: prev.rechnungskopie.includes(value)
        ? prev.rechnungskopie.filter(v => v !== value)
        : [...prev.rechnungskopie, value]
    }));
  };

  const addNotfallkontakt = () => {
    setCustomerData(prev => ({
      ...prev,
      notfallkontakte: [...prev.notfallkontakte, { name: '', bezug: '', telefon: '' }]
    }));
  };

  const removeNotfallkontakt = (index: number) => {
    setCustomerData(prev => ({
      ...prev,
      notfallkontakte: prev.notfallkontakte.filter((_, i) => i !== index)
    }));
  };

  const updateNotfallkontakt = (index: number, field: keyof NotfallKontakt, value: string) => {
    setCustomerData(prev => {
      const updated = [...prev.notfallkontakte];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, notfallkontakte: updated };
    });
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) handleClose();
      else onOpenChange(open);
    }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'customer' && 'Schritt 1: Kundendaten'}
            {step === 'employees' && 'Schritt 2: Mitarbeiter-Matching'}
          </DialogTitle>
          <DialogDescription>
            {step === 'customer' && 'Erfassen Sie die Kundendaten und Zeitfenster'}
            {step === 'employees' && 'KI-gestützte Mitarbeiter-Zuordnung'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${step === 'customer' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            <span className="font-medium">1</span>
            <span className="hidden sm:inline">Kundendaten</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${step === 'employees' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            <span className="font-medium">2</span>
            <span className="hidden sm:inline">Mitarbeiter</span>
          </div>
        </div>

        {/* Step 1: Customer Data */}
        {step === 'customer' && (
          <div className="space-y-6">
            {/* Kategorie-Auswahl */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Was möchten Sie anlegen?</h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setCustomerData({ ...customerData, kategorie: 'Interessent' })}
                  className={`p-6 border-2 rounded-lg transition-all hover:scale-105 ${
                    customerData.kategorie === 'Interessent'
                      ? 'border-primary bg-primary/10 shadow-lg'
                      : 'border-muted bg-background hover:border-primary/50'
                  }`}
                >
                  <div className="text-center space-y-2">
                    <div className={`text-2xl font-bold ${customerData.kategorie === 'Interessent' ? 'text-primary' : 'text-foreground'}`}>
                      Interessent
                    </div>
                    <p className="text-sm text-muted-foreground">Für potenzielle neue Kunden</p>
                  </div>
                </button>
                
                <button
                  type="button"
                  onClick={() => setCustomerData({ ...customerData, kategorie: 'Kunde' })}
                  className={`p-6 border-2 rounded-lg transition-all hover:scale-105 ${
                    customerData.kategorie === 'Kunde'
                      ? 'border-primary bg-primary/10 shadow-lg'
                      : 'border-muted bg-background hover:border-primary/50'
                  }`}
                >
                  <div className="text-center space-y-2">
                    <div className={`text-2xl font-bold ${customerData.kategorie === 'Kunde' ? 'text-primary' : 'text-foreground'}`}>
                      Kunde
                    </div>
                    <p className="text-sm text-muted-foreground">Für bestehende Kunden</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Basis-Informationen */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basis-Informationen</h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="vorname">Vorname *</Label>
                  <Input
                    id="vorname"
                    value={customerData.vorname}
                    onChange={(e) => setCustomerData({ ...customerData, vorname: e.target.value })}
                    placeholder="Max"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="nachname">Nachname *</Label>
                  <Input
                    id="nachname"
                    value={customerData.nachname}
                    onChange={(e) => setCustomerData({ ...customerData, nachname: e.target.value })}
                    placeholder="Mustermann"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="geburtsdatum">Geburtsdatum</Label>
                  <Input
                    id="geburtsdatum"
                    type="date"
                    value={customerData.geburtsdatum}
                    onChange={(e) => setCustomerData({ ...customerData, geburtsdatum: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Geschlecht</Label>
                  <Select
                    value={customerData.geschlecht}
                    onValueChange={(value) => setCustomerData({ ...customerData, geschlecht: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maennlich">Männlich</SelectItem>
                      <SelectItem value="weiblich">Weiblich</SelectItem>
                      <SelectItem value="divers">Divers</SelectItem>
                      <SelectItem value="keine_angabe">Keine Angabe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Kontaktdaten */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Kontaktdaten</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 col-span-3">
                  <Label htmlFor="strasse">Straße und Hausnummer *</Label>
                  <Input
                    id="strasse"
                    value={customerData.strasse}
                    onChange={(e) => setCustomerData({ ...customerData, strasse: e.target.value })}
                    placeholder="Straße und Hausnummer"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plz">PLZ *</Label>
                  <Input
                    id="plz"
                    value={customerData.plz}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                      setCustomerData({ ...customerData, plz: val });
                    }}
                    placeholder="30159"
                    maxLength={5}
                    inputMode="numeric"
                    required
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="stadt">Stadt</Label>
                  <Input
                    id="stadt"
                    value={customerData.stadt}
                    onChange={(e) => setCustomerData({ ...customerData, stadt: e.target.value })}
                    placeholder="Stadt"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="stadtteil">Stadtteil</Label>
                  <Input
                    id="stadtteil"
                    value={customerData.stadtteil}
                    onChange={(e) => setCustomerData({ ...customerData, stadtteil: e.target.value })}
                    placeholder="z.B. Linden, Mitte"
                  />
                </div>
                <div>
                  <Label htmlFor="telefonnr">Telefon *</Label>
                  <Input
                    id="telefonnr"
                    value={customerData.telefonnr}
                    onChange={(e) => setCustomerData({ ...customerData, telefonnr: e.target.value })}
                    placeholder="0511 123456"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={customerData.email}
                    onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                    placeholder="kunde@email.de"
                  />
                </div>
                <div>
                  <Label>Bevorzugter Kontaktweg</Label>
                  <Select
                    value={customerData.kontaktweg}
                    onValueChange={(value) => setCustomerData({ ...customerData, kontaktweg: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="telefon">Telefon</SelectItem>
                      <SelectItem value="email">E-Mail</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Pflege-Informationen */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Pflege-Informationen</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="pflegekasse">Pflegekasse</Label>
                  <Input
                    id="pflegekasse"
                    value={customerData.pflegekasse}
                    onChange={(e) => setCustomerData({ ...customerData, pflegekasse: e.target.value })}
                    placeholder="AOK, Barmer, etc."
                  />
                </div>
                <div>
                  <Label htmlFor="versichertennummer">Versichertennummer</Label>
                  <Input
                    id="versichertennummer"
                    value={customerData.versichertennummer}
                    onChange={(e) => setCustomerData({ ...customerData, versichertennummer: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="pflegegrad">Pflegegrad</Label>
                  <Select
                    value={customerData.pflegegrad}
                    onValueChange={(value) => setCustomerData({ ...customerData, pflegegrad: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nicht_vorhanden">Nicht vorhanden</SelectItem>
                      <SelectItem value="0">0</SelectItem>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Kasse/Privat</Label>
                  <Select
                    value={customerData.kasse_privat}
                    onValueChange={(value) => setCustomerData({ ...customerData, kasse_privat: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Kasse">Kasse</SelectItem>
                      <SelectItem value="Privat">Privat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="verhinderungspflege_status">Verhinderungspflege</Label>
                  <Input
                    id="verhinderungspflege_status"
                    value={customerData.verhinderungspflege_status}
                    onChange={(e) => setCustomerData({ ...customerData, verhinderungspflege_status: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Kopie LW</Label>
                  <Select
                    value={customerData.kopie_lw}
                    onValueChange={(value) => setCustomerData({ ...customerData, kopie_lw: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ja">Ja</SelectItem>
                      <SelectItem value="Nein">Nein</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Rechnungskopie-Logik */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Rechnungskopie</h3>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rk_email"
                    checked={customerData.rechnungskopie.includes('email')}
                    onCheckedChange={() => handleRechnungskopieToggle('email')}
                  />
                  <Label htmlFor="rk_email" className="cursor-pointer">Per E-Mail</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rk_kunde"
                    checked={customerData.rechnungskopie.includes('kunde')}
                    onCheckedChange={() => handleRechnungskopieToggle('kunde')}
                  />
                  <Label htmlFor="rk_kunde" className="cursor-pointer">An Kunde (Standardadresse)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rk_abweichend"
                    checked={customerData.rechnungskopie.includes('abweichende_adresse')}
                    onCheckedChange={() => handleRechnungskopieToggle('abweichende_adresse')}
                  />
                  <Label htmlFor="rk_abweichend" className="cursor-pointer">Abweichende Adresse</Label>
                </div>
              </div>
              {customerData.rechnungskopie.includes('abweichende_adresse') && (
                <div className="grid grid-cols-4 gap-4 p-3 border rounded-lg bg-muted/30">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={customerData.rechnungskopie_adresse_name}
                      onChange={(e) => setCustomerData({ ...customerData, rechnungskopie_adresse_name: e.target.value })}
                      placeholder="Empfänger"
                    />
                  </div>
                  <div>
                    <Label>Straße</Label>
                    <Input
                      value={customerData.rechnungskopie_adresse_strasse}
                      onChange={(e) => setCustomerData({ ...customerData, rechnungskopie_adresse_strasse: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>PLZ</Label>
                    <Input
                      value={customerData.rechnungskopie_adresse_plz}
                      onChange={(e) => setCustomerData({ ...customerData, rechnungskopie_adresse_plz: e.target.value })}
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <Label>Stadt</Label>
                    <Input
                      value={customerData.rechnungskopie_adresse_stadt}
                      onChange={(e) => setCustomerData({ ...customerData, rechnungskopie_adresse_stadt: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Stunden & Termine */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Termine & Frequenz</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Terminfrequenz</Label>
                  <Select
                    value={customerData.terminfrequenz}
                    onValueChange={(value) => setCustomerData({ ...customerData, terminfrequenz: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle_14_tage">Alle 14 Tage</SelectItem>
                      <SelectItem value="woechentlich">Wöchentlich</SelectItem>
                      <SelectItem value="2x_woechentlich">2x Wöchentlich</SelectItem>
                      <SelectItem value="3x_woechentlich">3x Wöchentlich</SelectItem>
                      <SelectItem value="4x_woechentlich">4x Wöchentlich</SelectItem>
                      <SelectItem value="5x_woechentlich">5x Wöchentlich</SelectItem>
                      <SelectItem value="nach_bedarf">Nach Bedarf</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="termindauer">Termindauer (Std.)</Label>
                  <Input
                    id="termindauer"
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={customerData.termindauer_stunden}
                    onChange={(e) => setCustomerData({ ...customerData, termindauer_stunden: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="stunden_kontingent_monat">Stunden / Monat</Label>
                  <Input
                    id="stunden_kontingent_monat"
                    type="number"
                    step="0.5"
                    value={customerData.stunden_kontingent_monat}
                    onChange={(e) => setCustomerData({ ...customerData, stunden_kontingent_monat: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Eintritt</Label>
                  <Input
                    type="month"
                    value={customerData.eintritt}
                    onChange={(e) => setCustomerData({ ...customerData, eintritt: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Startdatum</Label>
                  <Input
                    type="date"
                    value={customerData.startdatum}
                    onChange={(e) => setCustomerData({ ...customerData, startdatum: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Wochenmatrix */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">Passende Zeiten (Wochenmatrix)</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAITimeWindows(true)}
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
                    KI-Zeitfenster
                  </Button>
                </div>
              </div>

              {/* Clickable matrix */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left text-xs font-medium text-muted-foreground p-2 w-24"></th>
                      {[1, 2, 3, 4, 5, 6, 0].map(day => (
                        <th key={day} className="text-center text-xs font-medium text-muted-foreground p-2">
                          {WEEKDAY_SHORT[day]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SHIFT_BLOCKS.map(shift => (
                      <tr key={shift.key}>
                        <td className="text-xs font-medium text-muted-foreground p-2">
                          {shift.label}
                          <span className="block text-[10px] text-muted-foreground/60">{shift.von}–{shift.bis}</span>
                        </td>
                        {[1, 2, 3, 4, 5, 6, 0].map(day => {
                          const isActive = weekMatrix[day]?.[shift.key];
                          return (
                            <td key={day} className="p-1 text-center">
                              <button
                                type="button"
                                onClick={() => toggleMatrixCell(day, shift.key)}
                                className={`w-full h-10 rounded-md border text-xs font-medium transition-all ${
                                  isActive
                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                    : 'bg-background border-border hover:bg-muted hover:border-primary/40'
                                }`}
                              >
                                {isActive ? '✓' : ''}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Additional manual time windows */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">Oder individuelle Zeitfenster hinzufügen:</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCustomerData({
                      ...customerData,
                      zeitfenster: [...customerData.zeitfenster, { wochentag: 1, von: '08:00', bis: '12:00' }]
                    });
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Manuell
                </Button>
              </div>

              {customerData.zeitfenster.filter(z => {
                // Show only those NOT from matrix
                return !SHIFT_BLOCKS.some(s => s.von === z.von && s.bis === z.bis);
              }).map((zeitfenster, index) => {
                const realIndex = customerData.zeitfenster.indexOf(zeitfenster);
                return (
                  <div key={realIndex} className="grid grid-cols-[1fr,1fr,1fr,auto] gap-2 items-end p-3 border rounded-lg">
                    <div>
                      <Label className="text-xs">Wochentag</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                        value={zeitfenster.wochentag}
                        onChange={(e) => {
                          const updated = [...customerData.zeitfenster];
                          updated[realIndex] = { ...updated[realIndex], wochentag: parseInt(e.target.value) };
                          setCustomerData({ ...customerData, zeitfenster: updated });
                        }}
                      >
                        {[0,1,2,3,4,5,6].map(d => (
                          <option key={d} value={d}>{WEEKDAY_NAMES[d]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Von</Label>
                      <Input
                        type="time"
                        value={zeitfenster.von || ''}
                        onChange={(e) => {
                          const updated = [...customerData.zeitfenster];
                          updated[realIndex] = { ...updated[realIndex], von: e.target.value };
                          setCustomerData({ ...customerData, zeitfenster: updated });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Bis</Label>
                      <Input
                        type="time"
                        value={zeitfenster.bis || ''}
                        onChange={(e) => {
                          const updated = [...customerData.zeitfenster];
                          updated[realIndex] = { ...updated[realIndex], bis: e.target.value };
                          setCustomerData({ ...customerData, zeitfenster: updated });
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const updated = customerData.zeitfenster.filter((_, i) => i !== realIndex);
                        setCustomerData({ ...customerData, zeitfenster: updated });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}

              {customerData.zeitfenster.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {customerData.zeitfenster.length} Zeitfenster ausgewählt
                </div>
              )}
            </div>

            {/* Notfallkontakte */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Notfallkontakte</h3>
                <Button type="button" variant="outline" size="sm" onClick={addNotfallkontakt}>
                  <Plus className="h-4 w-4 mr-1" />
                  Kontakt hinzufügen
                </Button>
              </div>
              {customerData.notfallkontakte.map((kontakt, index) => (
                <div key={index} className="grid grid-cols-[1fr,1fr,1fr,auto] gap-2 items-end p-3 border rounded-lg">
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={kontakt.name}
                      onChange={(e) => updateNotfallkontakt(index, 'name', e.target.value)}
                      placeholder="Name"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Bezug</Label>
                    <Input
                      value={kontakt.bezug}
                      onChange={(e) => updateNotfallkontakt(index, 'bezug', e.target.value)}
                      placeholder="z.B. Sohn, Nachbar"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Telefon</Label>
                    <Input
                      value={kontakt.telefon}
                      onChange={(e) => updateNotfallkontakt(index, 'telefon', e.target.value)}
                      placeholder="0511 123456"
                    />
                  </div>
                  {customerData.notfallkontakte.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeNotfallkontakt(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Sonstiges */}
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-lg font-semibold">Sonstiges</h3>
              <Textarea
                value={customerData.sonstiges}
                onChange={(e) => setCustomerData({ ...customerData, sonstiges: e.target.value })}
                placeholder="Weitere Notizen, Hinweise, Kommentare..."
                className="min-h-[80px]"
              />
            </div>

            {/* Betreuung */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has_regular_appointments"
                  checked={customerData.has_regular_appointments}
                  onCheckedChange={(checked) => 
                    setCustomerData({ ...customerData, has_regular_appointments: checked as boolean })
                  }
                />
                <Label htmlFor="has_regular_appointments" className="cursor-pointer">
                  Kunde hat regelmäßige Termine → Mitarbeiter-Matching starten
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Abbrechen
              </Button>
              <Button 
                onClick={handleSaveCustomerAndTimeWindows}
                disabled={isLoading || !customerData.vorname || !customerData.nachname}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Speichern...
                  </>
                ) : customerData.has_regular_appointments && customerData.zeitfenster.length > 0 ? (
                  <>
                    Weiter zum Mitarbeiter-Matching
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  'Kunden anlegen'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Employee Matching */}
        {step === 'employees' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  KI-Mitarbeiter Matching
                </CardTitle>
                <CardDescription>
                  Lassen Sie die KI den besten Mitarbeiter für diesen Kunden finden
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm font-medium mb-2">Zeitfenster:</p>
                  <div className="space-y-1">
                    {customerData.zeitfenster.map((tw, idx) => (
                      <p key={idx} className="text-sm text-muted-foreground">
                        • {WEEKDAY_NAMES[tw.wochentag]}: {tw.von} - {tw.bis} Uhr
                      </p>
                    ))}
                  </div>
                </div>

                {customerData.plz && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm">
                      <span className="font-medium">PLZ:</span> {customerData.plz}
                    </p>
                  </div>
                )}

                <div>
                  <Label>Frequenz (z.B. "Jeden Montag", "Wöchentlich") *</Label>
                  <Input
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    placeholder="z.B. Jeden Montag"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Mitarbeiter-Präferenzen (optional)</Label>
                  <Textarea
                    value={preferences}
                    onChange={(e) => setPreferences(e.target.value)}
                    placeholder="z.B. 'Erfahrung mit Demenz', 'Männlicher Pfleger bevorzugt'"
                    className="min-h-[80px] mt-2"
                  />
                </div>

                <Button
                  onClick={handleGenerateSuggestions}
                  disabled={suggestionsLoading || !frequency.trim()}
                  className="w-full"
                >
                  {suggestionsLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analysiere Mitarbeiter...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Mitarbeiter vorschlagen
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {suggestions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Vorgeschlagene Mitarbeiter</CardTitle>
                  <CardDescription>Wählen Sie den besten Mitarbeiter für diesen Kunden</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.mitarbeiter_id}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedEmployee === suggestion.mitarbeiter_id
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedEmployee(suggestion.mitarbeiter_id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium">
                            {suggestion.employee.vorname} {suggestion.employee.nachname}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            PLZ: {suggestion.employee.plz || 'N/A'} • {suggestion.employee.zustaendigkeitsbereich || 'Kein Bereich'}
                          </p>
                        </div>
                        <Badge className={`${getScoreColor(suggestion.match_score)} text-white`}>
                          {suggestion.match_score}%
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
                      {selectedEmployee === suggestion.mitarbeiter_id && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-primary">
                          <UserCheck className="h-4 w-4" />
                          Ausgewählt
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between gap-2 border-t pt-4">
              <Button onClick={handleSkipEmployeeMatching} variant="outline">
                Überspringen
              </Button>
              <div className="flex gap-2">
                <Button 
                  onClick={handleConfirmEmployee} 
                  disabled={!selectedEmployee || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Erstelle Regeltermin...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mitarbeiter zuordnen & Regeltermin erstellen
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* AI Time Windows Dialog */}
        {showAITimeWindows && (
          <AITimeWindowsCreator
            onConfirm={(windows: TimeWindow[]) => {
              const newMatrix = { ...weekMatrix };
              windows.forEach(w => {
                const matchingShift = SHIFT_BLOCKS.find(s => s.von === w.von && s.bis === w.bis);
                if (matchingShift) {
                  if (!newMatrix[w.wochentag]) newMatrix[w.wochentag] = {};
                  newMatrix[w.wochentag][matchingShift.key] = true;
                }
              });
              setWeekMatrix(newMatrix);
              setCustomerData(prev => ({
                ...prev,
                zeitfenster: [...prev.zeitfenster, ...windows]
              }));
              setShowAITimeWindows(false);
              toast.success(`${windows.length} Zeitfenster hinzugefügt`);
            }}
            onCancel={() => setShowAITimeWindows(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
