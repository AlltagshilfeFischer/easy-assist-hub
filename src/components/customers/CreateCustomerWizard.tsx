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
import { Plus, Trash2, Sparkles, ArrowLeft, ArrowRight, Loader2, UserCheck, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AITimeWindowsCreator from '@/components/schedule/AITimeWindowsCreator';

interface TimeWindow {
  wochentag: number;
  von: string;
  bis: string;
  prioritaet?: number;
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
  
  // Employee suggestion state
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
    strasse: '',
    stadt: '',
    plz: '',
    stadtteil: '',
    telefonnr: '',
    email: '',
    pflegekasse: '',
    versichertennummer: '',
    pflegegrad: '',
    kasse_privat: '',
    verhinderungspflege_status: '',
    kopie_lw: '',
    stunden_kontingent_monat: '',
    startdatum: '',
    eintritt: getCurrentMonth(),
    austritt: '',
    notfall_name: '',
    notfall_telefon: '',
    angehoerige_ansprechpartner: '',
    has_regular_appointments: false,
    mitarbeiter: '',
    zeitfenster: [] as TimeWindow[]
  });

  const resetWizard = () => {
    setStep('customer');
    setShowAITimeWindows(false);
    setCreatedCustomerId(null);
    setPreferences('');
    setFrequency('');
    setSuggestions([]);
    setSelectedEmployee(null);
    setCustomerData({
      kategorie: 'Kunde',
      vorname: '',
      nachname: '',
      geburtsdatum: '',
      strasse: '',
      stadt: '',
      plz: '',
      stadtteil: '',
      telefonnr: '',
      email: '',
      pflegekasse: '',
      versichertennummer: '',
      pflegegrad: '',
      kasse_privat: '',
      verhinderungspflege_status: '',
      kopie_lw: '',
      stunden_kontingent_monat: '',
      startdatum: '',
      eintritt: getCurrentMonth(),
      austritt: '',
      notfall_name: '',
      notfall_telefon: '',
      angehoerige_ansprechpartner: '',
      has_regular_appointments: false,
      mitarbeiter: '',
      zeitfenster: []
    });
  };

  const handleClose = () => {
    resetWizard();
    onOpenChange(false);
  };

  // Step 1: Save customer data and time windows
  const handleSaveCustomerAndTimeWindows = async () => {
    if (!customerData.vorname || !customerData.nachname) {
      toast.error('Bitte Vor- und Nachname ausfüllen');
      return;
    }

    setIsLoading(true);
    try {
      // Create customer
      const insertData = {
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
        pflegekasse: customerData.pflegekasse || null,
        versichertennummer: customerData.versichertennummer || null,
        pflegegrad: customerData.pflegegrad ? parseInt(customerData.pflegegrad) : null,
        stunden_kontingent_monat: customerData.stunden_kontingent_monat ? parseFloat(customerData.stunden_kontingent_monat) : null,
        startdatum: customerData.startdatum || null,
        eintritt: monthToDate(customerData.eintritt),
        austritt: monthToDate(customerData.austritt),
        angehoerige_ansprechpartner: customerData.angehoerige_ansprechpartner || null,
        kasse_privat: customerData.kasse_privat || null,
        verhinderungspflege_status: customerData.verhinderungspflege_status || null,
        kopie_lw: customerData.kopie_lw || null,
      };

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
          bis: w.bis,
          prioritaet: w.prioritaet || 3
        }));

        const { error: zeitfensterError } = await (supabase as any)
          .from('kunden_zeitfenster')
          .insert(windowsToInsert);

        if (zeitfensterError) throw zeitfensterError;
      }

      toast.success('Kundendaten und Zeitfenster gespeichert');
      
      // Go to employee matching if they want regular appointments
      if (customerData.has_regular_appointments && customerData.zeitfenster.length > 0) {
        setStep('employees');
      } else {
        // No regular appointments, done
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

  // Step 2: Generate employee suggestions
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
      if (error.message?.includes('Rate limit')) {
        toast.error('Zu viele Anfragen. Bitte versuchen Sie es später erneut.');
      } else if (error.message?.includes('credits')) {
        toast.error('Nicht genügend Credits. Bitte fügen Sie Credits hinzu.');
      } else {
        toast.error('Fehler beim Vorschlagen von Mitarbeitern');
      }
    } finally {
      setSuggestionsLoading(false);
    }
  };

  // Step 3: Confirm employee and create recurring appointment
  const handleConfirmEmployee = async () => {
    if (!selectedEmployee || !createdCustomerId) {
      toast.error('Bitte wählen Sie einen Mitarbeiter aus');
      return;
    }

    setIsLoading(true);
    try {
      // Update customer with assigned employee
      const { error: updateError } = await (supabase as any)
        .from('kunden')
        .update({ mitarbeiter: selectedEmployee })
        .eq('id', createdCustomerId);

      if (updateError) throw updateError;

      // Create recurring appointments based on time windows
      for (const timeWindow of customerData.zeitfenster) {
        // Calculate the next occurrence of this weekday
        const today = new Date();
        const dayOfWeek = timeWindow.wochentag;
        const daysUntilNext = (dayOfWeek - today.getDay() + 7) % 7 || 7;
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + daysUntilNext);
        
        const startTime = timeWindow.von.split(':');
        const endTime = timeWindow.bis.split(':');
        
        const startAt = new Date(nextDate);
        startAt.setHours(parseInt(startTime[0]), parseInt(startTime[1]), 0, 0);
        
        const endAt = new Date(nextDate);
        endAt.setHours(parseInt(endTime[0]), parseInt(endTime[1]), 0, 0);

        // Create termin_vorlage (recurring template)
        const { error: vorlageError } = await (supabase as any)
          .from('termin_vorlagen')
          .insert([{
            titel: `${customerData.vorname} ${customerData.nachname}`,
            kunden_id: createdCustomerId,
            mitarbeiter_id: selectedEmployee,
            wochentag: timeWindow.wochentag,
            start_zeit: timeWindow.von,
            dauer_minuten: calculateDuration(timeWindow.von, timeWindow.bis),
            intervall: frequency.toLowerCase().includes('wöchentlich') || frequency.toLowerCase().includes('jeden') ? 'weekly' : 'weekly',
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

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) handleClose();
      else onOpenChange(open);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'customer' && 'Schritt 1: Kundendaten'}
            {step === 'timewindows' && 'Schritt 2: Zeitfenster'}
            {step === 'employees' && 'Schritt 3: Mitarbeiter-Matching'}
          </DialogTitle>
          <DialogDescription>
            {step === 'customer' && 'Erfassen Sie die Kundendaten und Zeitfenster'}
            {step === 'timewindows' && 'Definieren Sie die Zeitfenster für regelmäßige Termine'}
            {step === 'employees' && 'KI-gestützte Mitarbeiter-Zuordnung basierend auf Zeitfenstern und Präferenzen'}
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
                    <div className={`text-2xl font-bold ${
                      customerData.kategorie === 'Interessent' ? 'text-primary' : 'text-foreground'
                    }`}>
                      Interessent
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Für potenzielle neue Kunden
                    </p>
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
                    <div className={`text-2xl font-bold ${
                      customerData.kategorie === 'Kunde' ? 'text-primary' : 'text-foreground'
                    }`}>
                      Kunde
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Für bestehende Kunden
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Basis-Informationen */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basis-Informationen</h3>
              <div className="grid grid-cols-3 gap-4">
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
              </div>
            </div>

            {/* Kontaktdaten */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Kontaktdaten</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 col-span-3">
                  <Label htmlFor="strasse">Straße</Label>
                  <Input
                    id="strasse"
                    value={customerData.strasse}
                    onChange={(e) => setCustomerData({ ...customerData, strasse: e.target.value })}
                    placeholder="Straße und Hausnummer"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plz">PLZ</Label>
                  <Input
                    id="plz"
                    value={customerData.plz}
                    onChange={(e) => setCustomerData({ ...customerData, plz: e.target.value })}
                    placeholder="PLZ"
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
              <div className="grid grid-cols-3 gap-4">
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
                  <Label htmlFor="telefonnr">Telefon</Label>
                  <Input
                    id="telefonnr"
                    value={customerData.telefonnr}
                    onChange={(e) => setCustomerData({ ...customerData, telefonnr: e.target.value })}
                    placeholder="0511 123456"
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
                      <SelectItem value="Abweichende Rechnungsadresse">Abweichende Rechnungsadresse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="verhinderungspflege_status">Verhinderungspflege Status</Label>
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

            {/* Stunden & Termine */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Stunden & Termine</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="stunden_kontingent_monat">Stunden</Label>
                  <Input
                    id="stunden_kontingent_monat"
                    type="number"
                    step="0.5"
                    value={customerData.stunden_kontingent_monat}
                    onChange={(e) => setCustomerData({ ...customerData, stunden_kontingent_monat: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="startdatum">Startdatum</Label>
                  <Input
                    id="startdatum"
                    type="date"
                    value={customerData.startdatum}
                    onChange={(e) => setCustomerData({ ...customerData, startdatum: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Betreuung */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Betreuung</h3>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has_regular_appointments"
                  checked={customerData.has_regular_appointments}
                  onCheckedChange={(checked) => 
                    setCustomerData({ 
                      ...customerData, 
                      has_regular_appointments: checked as boolean
                    })
                  }
                />
                <Label htmlFor="has_regular_appointments" className="cursor-pointer">
                  Kunde hat regelmäßige Termine
                </Label>
              </div>
            </div>

            {/* Zeitfenster Section */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">Zeitfenster</Label>
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCustomerData({
                        ...customerData,
                        zeitfenster: [...customerData.zeitfenster, {
                          wochentag: 1,
                          von: '08:00',
                          bis: '12:00',
                          prioritaet: 3
                        }]
                      });
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Manuell hinzufügen
                  </Button>
                </div>
              </div>

              {customerData.zeitfenster.map((zeitfenster, index) => (
                <div key={index} className="grid grid-cols-[1fr,1fr,1fr,auto] gap-2 items-end p-3 border rounded-lg">
                  <div>
                    <Label className="text-xs">Wochentag</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                      value={zeitfenster.wochentag}
                      onChange={(e) => {
                        const updated = [...customerData.zeitfenster];
                        updated[index] = { ...updated[index], wochentag: parseInt(e.target.value) };
                        setCustomerData({ ...customerData, zeitfenster: updated });
                      }}
                    >
                      <option value="0">Sonntag</option>
                      <option value="1">Montag</option>
                      <option value="2">Dienstag</option>
                      <option value="3">Mittwoch</option>
                      <option value="4">Donnerstag</option>
                      <option value="5">Freitag</option>
                      <option value="6">Samstag</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Von</Label>
                    <Input
                      type="time"
                      value={zeitfenster.von || ''}
                      onChange={(e) => {
                        const updated = [...customerData.zeitfenster];
                        updated[index] = { ...updated[index], von: e.target.value };
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
                        updated[index] = { ...updated[index], bis: e.target.value };
                        setCustomerData({ ...customerData, zeitfenster: updated });
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const updated = customerData.zeitfenster.filter((_, i) => i !== index);
                      setCustomerData({ ...customerData, zeitfenster: updated });
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}

              {customerData.zeitfenster.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Keine Zeitfenster definiert
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
              >
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
                      Regeltermin erstellen
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* AI Time Windows Dialog */}
        <Dialog open={showAITimeWindows} onOpenChange={setShowAITimeWindows}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>KI-gestützte Zeitfenster-Erstellung</DialogTitle>
              <DialogDescription>
                Beschreiben Sie die gewünschten Zeitfenster in natürlicher Sprache
              </DialogDescription>
            </DialogHeader>
            <AITimeWindowsCreator
              onConfirm={(windows) => {
                setCustomerData({
                  ...customerData,
                  zeitfenster: windows
                });
                setShowAITimeWindows(false);
                toast.success('Zeitfenster generiert');
              }}
              onCancel={() => setShowAITimeWindows(false)}
            />
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
