import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Building2, Save, Plus, Trash2, Clock } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface Zeitfenster {
  wochentag: number;
  von: string;
  bis: string;
  prioritaet: number;
}

export default function NewEntries() {
  const [newCustomer, setNewCustomer] = useState({
    kategorie: 'Kunde',
    name: '',
    telefonnr: '',
    email: '',
    adresse: '',
    stadtteil: '',
    geburtsdatum: '',
    pflegekasse: '',
    versichertennummer: '',
    pflegegrad: '',
    stunden_kontingent_monat: '',
    startdatum: '',
    angehoerige_ansprechpartner: '',
    sonstiges: '',
    kasse_privat: '',
    verhinderungspflege_status: '',
    begruendung: '',
    kopie_lw_vorhanden: '',
    aktiv: true
  });

  const [zeitfenster, setZeitfenster] = useState<Zeitfenster[]>([]);
  const [currentZeitfenster, setCurrentZeitfenster] = useState<Zeitfenster>({
    wochentag: 1,
    von: '09:00',
    bis: '17:00',
    prioritaet: 3
  });
  const [zeitfensterText, setZeitfensterText] = useState('');
  const [isGeneratingZeitfenster, setIsGeneratingZeitfenster] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const weekdays = [
    { value: 0, label: 'Sonntag' },
    { value: 1, label: 'Montag' },
    { value: 2, label: 'Dienstag' },
    { value: 3, label: 'Mittwoch' },
    { value: 4, label: 'Donnerstag' },
    { value: 5, label: 'Freitag' },
    { value: 6, label: 'Samstag' }
  ];

  const addZeitfenster = () => {
    setZeitfenster([...zeitfenster, currentZeitfenster]);
    setCurrentZeitfenster({
      wochentag: 1,
      von: '09:00',
      bis: '17:00',
      prioritaet: 3
    });
  };

  const removeZeitfenster = (index: number) => {
    setZeitfenster(zeitfenster.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setCurrentZeitfenster({
        wochentag: 1,
        von: '09:00',
        bis: '17:00',
        prioritaet: 3
      });
    }
  };

  const startEditZeitfenster = (index: number) => {
    setEditingIndex(index);
    setCurrentZeitfenster(zeitfenster[index]);
  };

  const saveEditZeitfenster = () => {
    if (editingIndex !== null) {
      const updated = [...zeitfenster];
      updated[editingIndex] = currentZeitfenster;
      setZeitfenster(updated);
      setEditingIndex(null);
      setCurrentZeitfenster({
        wochentag: 1,
        von: '09:00',
        bis: '17:00',
        prioritaet: 3
      });
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setCurrentZeitfenster({
      wochentag: 1,
      von: '09:00',
      bis: '17:00',
      prioritaet: 3
    });
  };

  const generateZeitfensterFromText = async () => {
    if (!zeitfensterText.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte geben Sie eine Beschreibung ein',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingZeitfenster(true);
    try {
      const response = await fetch('https://k01-2025-u36730.vm.elestio.app/webhook/3feaf29e-9fb8-49b6-9d24-f69f2a0b41dc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: zeitfensterText
        }),
      });

      if (!response.ok) {
        throw new Error('KI-Generierung fehlgeschlagen');
      }

      const data = await response.json();
      
      // n8n wraps response in output object: { output: { zeitfenster: Array<Zeitfenster> } }
      const zeitfensterData = data.output?.zeitfenster || data.zeitfenster;
      
      if (zeitfensterData && Array.isArray(zeitfensterData)) {
        setZeitfenster(zeitfensterData);
        toast({
          title: 'Zeitfenster generiert',
          description: `${zeitfensterData.length} Zeitfenster wurden erfolgreich erstellt`,
        });
        setZeitfensterText('');
      } else {
        console.error('Invalid response format:', data);
        throw new Error('Ungültiges Antwortformat');
      }
    } catch (error) {
      console.error('Zeitfenster generation error:', error);
      toast({
        title: 'Fehler',
        description: 'Zeitfenster konnten nicht generiert werden',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingZeitfenster(false);
    }
  };

  const createCustomerMutation = useMutation({
    mutationFn: async (customerData: any) => {
      // Step 1: Create customer
      const { data: kunde, error: kundeError } = await supabase
        .from('kunden')
        .insert([{
          kategorie: customerData.kategorie,
          name: customerData.name,
          telefonnr: customerData.telefonnr,
          email: customerData.email,
          adresse: customerData.adresse,
          stadtteil: customerData.stadtteil,
          geburtsdatum: customerData.geburtsdatum || null,
          pflegekasse: customerData.pflegekasse,
          versichertennummer: customerData.versichertennummer,
          pflegegrad: customerData.pflegegrad ? parseInt(customerData.pflegegrad) : null,
          stunden_kontingent_monat: customerData.stunden_kontingent_monat ? parseFloat(customerData.stunden_kontingent_monat) : null,
          startdatum: customerData.startdatum || null,
          angehoerige_ansprechpartner: customerData.angehoerige_ansprechpartner,
          sonstiges: customerData.sonstiges,
          kasse_privat: customerData.kasse_privat,
          verhinderungspflege_status: customerData.verhinderungspflege_status,
          begruendung: customerData.begruendung,
          kopie_lw_vorhanden: customerData.kopie_lw_vorhanden,
          aktiv: customerData.aktiv
        }])
        .select()
        .single();
      
      if (kundeError) throw kundeError;
      
      // Step 2: Create Zeitfenster
      if (zeitfenster.length > 0) {
        const zeitfensterData = zeitfenster.map(zf => ({
          kunden_id: kunde.id,
          wochentag: zf.wochentag,
          von: zf.von,
          bis: zf.bis,
          prioritaet: zf.prioritaet
        }));

        const { error: zeitfensterError } = await supabase
          .from('kunden_zeitfenster')
          .insert(zeitfensterData);
        
        if (zeitfensterError) throw zeitfensterError;
      }

      return kunde;
    },
    onSuccess: async (kunde) => {
      queryClient.invalidateQueries({ queryKey: ['kunden'] });
      
      toast({
        title: 'Kunde angelegt',
        description: 'Kunde wurde erfolgreich erstellt. Starte KI-Mitarbeiterzuweisung...',
      });

      // TODO: Automatische Vertragsbereitstellung hier implementieren
      // Placeholder für zukünftige automatische Vertragsgenerierung

      // Step 3: AI-based employee assignment
      try {
        const { data, error } = await supabase.functions.invoke('assign-employee-to-customer', {
          body: {
            kunden_id: kunde.id,
            zeitfenster: zeitfenster
          }
        });

        if (error) throw error;

        toast({
          title: 'Mitarbeiter zugewiesen',
          description: `${data.employee_name} wurde zugewiesen (Score: ${data.match_score}/100)\n${data.reasoning}`,
        });
      } catch (error) {
        console.error('Employee assignment error:', error);
        toast({
          title: 'Hinweis',
          description: 'Kunde wurde angelegt, aber Mitarbeiterzuweisung fehlgeschlagen. Bitte manuell zuweisen.',
          variant: 'destructive',
        });
      }

      // Don't reset form after success - let user see the results
    },
    onError: (error) => {
      console.error('Customer creation error:', error);
      toast({
        title: 'Fehler',
        description: 'Kunde konnte nicht erstellt werden',
        variant: 'destructive',
      });
    },
  });

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    createCustomerMutation.mutate(newCustomer);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Neuen Kunden anlegen</h1>
        <p className="text-muted-foreground">
          Erfassen Sie alle Kundendaten, Zeitfenster und erhalten Sie automatisch einen passenden Mitarbeiter
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Kundendaten
          </CardTitle>
          <CardDescription>
            Nach dem Anlegen wird automatisch ein passender Mitarbeiter zugewiesen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateCustomer} className="space-y-8">
            {/* Kategorie-Auswahl - Zwei große Felder */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Was möchten Sie anlegen?</h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setNewCustomer({ ...newCustomer, kategorie: 'Interessent' })}
                  className={`p-6 border-2 rounded-lg transition-all hover:scale-105 ${
                    newCustomer.kategorie === 'Interessent'
                      ? 'border-primary bg-primary/10 shadow-lg'
                      : 'border-muted bg-background hover:border-primary/50'
                  }`}
                >
                  <div className="text-center space-y-2">
                    <div className={`text-2xl font-bold ${
                      newCustomer.kategorie === 'Interessent' ? 'text-primary' : 'text-foreground'
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
                  onClick={() => setNewCustomer({ ...newCustomer, kategorie: 'Kunde' })}
                  className={`p-6 border-2 rounded-lg transition-all hover:scale-105 ${
                    newCustomer.kategorie === 'Kunde'
                      ? 'border-primary bg-primary/10 shadow-lg'
                      : 'border-muted bg-background hover:border-primary/50'
                  }`}
                >
                  <div className="text-center space-y-2">
                    <div className={`text-2xl font-bold ${
                      newCustomer.kategorie === 'Kunde' ? 'text-primary' : 'text-foreground'
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name (Vor- und Nachname) *</Label>
                  <Input
                    id="name"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    placeholder="Max Mustermann"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="geburtsdatum">Geburtsdatum</Label>
                  <Input
                    id="geburtsdatum"
                    type="date"
                    value={newCustomer.geburtsdatum}
                    onChange={(e) => setNewCustomer({ ...newCustomer, geburtsdatum: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Kontaktdaten */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Kontaktdaten</h3>
              <div>
                <Label htmlFor="adresse">Adresse *</Label>
                <Textarea
                  id="adresse"
                  value={newCustomer.adresse}
                  onChange={(e) => setNewCustomer({ ...newCustomer, adresse: e.target.value })}
                  placeholder="Straße, Hausnummer, PLZ, Ort"
                  rows={2}
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="stadtteil">Stadtteil</Label>
                  <Input
                    id="stadtteil"
                    value={newCustomer.stadtteil}
                    onChange={(e) => setNewCustomer({ ...newCustomer, stadtteil: e.target.value })}
                    placeholder="z.B. Linden, Mitte"
                  />
                </div>
                <div>
                  <Label htmlFor="telefonnr">Telefon</Label>
                  <Input
                    id="telefonnr"
                    value={newCustomer.telefonnr}
                    onChange={(e) => setNewCustomer({ ...newCustomer, telefonnr: e.target.value })}
                    placeholder="0511 123456"
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
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
                    value={newCustomer.pflegekasse}
                    onChange={(e) => setNewCustomer({ ...newCustomer, pflegekasse: e.target.value })}
                    placeholder="AOK, Barmer, etc."
                  />
                </div>
                <div>
                  <Label htmlFor="versichertennummer">Versichertennummer</Label>
                  <Input
                    id="versichertennummer"
                    value={newCustomer.versichertennummer}
                    onChange={(e) => setNewCustomer({ ...newCustomer, versichertennummer: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="pflegegrad">Pflegegrad</Label>
                  <Select
                    value={newCustomer.pflegegrad}
                    onValueChange={(value) => setNewCustomer({ ...newCustomer, pflegegrad: value })}
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
                  <Label htmlFor="kasse_privat">Pflegekasse</Label>
                  <Select
                    value={newCustomer.kasse_privat}
                    onValueChange={(value) => setNewCustomer({ ...newCustomer, kasse_privat: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Kasse">Kasse</SelectItem>
                      <SelectItem value="Privat">Privat</SelectItem>
                      <SelectItem value="Beihilfe">Beihilfe</SelectItem>
                      <SelectItem value="Abweichende Rechnungsadresse">Abweichende Rechnungsadresse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="verhinderungspflege_status">Verhinderungspflege Status</Label>
                  <Input
                    id="verhinderungspflege_status"
                    value={newCustomer.verhinderungspflege_status}
                    onChange={(e) => setNewCustomer({ ...newCustomer, verhinderungspflege_status: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="kopie_lw_vorhanden">Kopie LW vorhanden</Label>
                  <Select
                    value={newCustomer.kopie_lw_vorhanden}
                    onValueChange={(value) => setNewCustomer({ ...newCustomer, kopie_lw_vorhanden: value })}
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
                    value={newCustomer.stunden_kontingent_monat}
                    onChange={(e) => setNewCustomer({ ...newCustomer, stunden_kontingent_monat: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="startdatum">Startdatum</Label>
                  <Input
                    id="startdatum"
                    type="date"
                    value={newCustomer.startdatum}
                    onChange={(e) => setNewCustomer({ ...newCustomer, startdatum: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Zeitfenster */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Zeitfenster des Kunden
                </h3>
              </div>

              {/* KI-basierte Zeitfenster-Eingabe */}
              <div className="space-y-3 p-4 border-2 border-primary/20 rounded-lg bg-primary/5">
                <div>
                  <Label htmlFor="zeitfenster-text">Zeitfenster beschreiben (KI-gestützt)</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Beispiel: "Mo-Di von 8-14" oder "Montag bis Freitag 9:00-17:00, Samstag 10-12"
                  </p>
                  <Textarea
                    id="zeitfenster-text"
                    value={zeitfensterText}
                    onChange={(e) => setZeitfensterText(e.target.value)}
                    placeholder="Beschreiben Sie die gewünschten Zeitfenster in natürlicher Sprache..."
                    rows={2}
                    disabled={isGeneratingZeitfenster}
                  />
                </div>
                <Button
                  type="button"
                  onClick={generateZeitfensterFromText}
                  disabled={isGeneratingZeitfenster || !zeitfensterText.trim()}
                  className="w-full"
                >
                  {isGeneratingZeitfenster ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      KI generiert Zeitfenster...
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 mr-2" />
                      Zeitfenster mit KI generieren
                    </>
                  )}
                </Button>
              </div>
              
              {/* Liste der Zeitfenster */}
              {zeitfenster.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Zeitfenster ({zeitfenster.length})</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setZeitfenster([]);
                        setEditingIndex(null);
                      }}
                    >
                      Alle löschen
                    </Button>
                  </div>
                  {zeitfenster.map((zf, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                      <span className="flex-1">
                        {weekdays.find(w => w.value === zf.wochentag)?.label}: {zf.von} - {zf.bis} (Priorität: {zf.prioritaet})
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditZeitfenster(index)}
                      >
                        Bearbeiten
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeZeitfenster(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Zeitfenster hinzufügen/bearbeiten */}
              <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                <Label>{editingIndex !== null ? 'Zeitfenster bearbeiten' : 'Neues Zeitfenster hinzufügen'}</Label>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="wochentag">Wochentag</Label>
                    <Select
                      value={currentZeitfenster.wochentag.toString()}
                      onValueChange={(value) => setCurrentZeitfenster({ 
                        ...currentZeitfenster, 
                        wochentag: parseInt(value) 
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {weekdays.map(day => (
                          <SelectItem key={day.value} value={day.value.toString()}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="von">Von</Label>
                    <Input
                      id="von"
                      type="time"
                      value={currentZeitfenster.von}
                      onChange={(e) => setCurrentZeitfenster({ 
                        ...currentZeitfenster, 
                        von: e.target.value 
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bis">Bis</Label>
                    <Input
                      id="bis"
                      type="time"
                      value={currentZeitfenster.bis}
                      onChange={(e) => setCurrentZeitfenster({ 
                        ...currentZeitfenster, 
                        bis: e.target.value 
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="prioritaet">Priorität</Label>
                    <Select
                      value={currentZeitfenster.prioritaet.toString()}
                      onValueChange={(value) => setCurrentZeitfenster({ 
                        ...currentZeitfenster, 
                        prioritaet: parseInt(value) 
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 (Hoch)</SelectItem>
                        <SelectItem value="2">2 (Mittel)</SelectItem>
                        <SelectItem value="3">3 (Normal)</SelectItem>
                        <SelectItem value="4">4 (Niedrig)</SelectItem>
                        <SelectItem value="5">5 (Optional)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  {editingIndex !== null ? (
                    <>
                      <Button
                        type="button"
                        variant="default"
                        onClick={saveEditZeitfenster}
                        className="flex-1"
                      >
                        Speichern
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={cancelEdit}
                        className="flex-1"
                      >
                        Abbrechen
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addZeitfenster}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Hinzufügen
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Angehörige/Ansprechpartner */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Angehörige/Ansprechpartner</h3>
              <div>
                <Label htmlFor="angehoerige_ansprechpartner">Angehörige/Ansprechpartner</Label>
                <Textarea
                  id="angehoerige_ansprechpartner"
                  value={newCustomer.angehoerige_ansprechpartner}
                  onChange={(e) => setNewCustomer({ ...newCustomer, angehoerige_ansprechpartner: e.target.value })}
                  rows={3}
                  placeholder="Name, Beziehung, Telefon"
                />
              </div>
            </div>

            {/* Sonstiges */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Weitere Informationen</h3>
              <div>
                <Label htmlFor="begruendung">Begründung</Label>
                <Textarea
                  id="begruendung"
                  value={newCustomer.begruendung}
                  onChange={(e) => setNewCustomer({ ...newCustomer, begruendung: e.target.value })}
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="sonstiges">Sonstiges/Notizen</Label>
                <Textarea
                  id="sonstiges"
                  value={newCustomer.sonstiges}
                  onChange={(e) => setNewCustomer({ ...newCustomer, sonstiges: e.target.value })}
                  rows={3}
                  placeholder="Besondere Hinweise, Allergien, Vorlieben, etc."
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={createCustomerMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {createCustomerMutation.isPending ? 'Speichern & Mitarbeiter zuweisen...' : 'Kunden anlegen & Mitarbeiter zuweisen'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
