import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Building2, Save, Plus, Trash2, Clock, ArrowLeft } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';


export default function NewEntries() {
  const [newCustomer, setNewCustomer] = useState({
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
    eintritt: '',
    austritt: '',
    notfall_name: '',
    notfall_telefon: '',
    angehoerige_ansprechpartner: ''
  });


  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const createCustomerMutation = useMutation({
    mutationFn: async (customerData: any) => {
      // Step 1: Create customer
      const { data: kunde, error: kundeError } = await supabase
        .from('kunden')
        .insert([{
          kategorie: customerData.kategorie,
          vorname: customerData.vorname,
          nachname: customerData.nachname,
          telefonnr: customerData.telefonnr,
          email: customerData.email,
          strasse: customerData.strasse,
          stadt: customerData.stadt,
          plz: customerData.plz,
          stadtteil: customerData.stadtteil,
          geburtsdatum: customerData.geburtsdatum || null,
          pflegekasse: customerData.pflegekasse,
          versichertennummer: customerData.versichertennummer,
          pflegegrad: customerData.pflegegrad ? parseInt(customerData.pflegegrad) : null,
          stunden_kontingent_monat: customerData.stunden_kontingent_monat ? parseFloat(customerData.stunden_kontingent_monat) : null,
          startdatum: customerData.startdatum || null,
          eintritt: customerData.eintritt || null,
          austritt: customerData.austritt || null,
          notfall_name: customerData.notfall_name,
          notfall_telefon: customerData.notfall_telefon,
          angehoerige_ansprechpartner: customerData.angehoerige_ansprechpartner,
          kasse_privat: customerData.kasse_privat,
          verhinderungspflege_status: customerData.verhinderungspflege_status,
          kopie_lw: customerData.kopie_lw
        }])
        .select()
        .single();
      
      if (kundeError) throw kundeError;

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
            kunden_id: kunde.id
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Neuen Kunden anlegen</h1>
          <p className="text-muted-foreground">
            Erfassen Sie alle Kundendaten und erhalten Sie automatisch einen passenden Mitarbeiter
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard/controlboard/master-data')} variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Button>
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
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="vorname">Vorname *</Label>
                  <Input
                    id="vorname"
                    value={newCustomer.vorname}
                    onChange={(e) => setNewCustomer({ ...newCustomer, vorname: e.target.value })}
                    placeholder="Max"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="nachname">Nachname *</Label>
                  <Input
                    id="nachname"
                    value={newCustomer.nachname}
                    onChange={(e) => setNewCustomer({ ...newCustomer, nachname: e.target.value })}
                    placeholder="Mustermann"
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 col-span-3">
                  <Label htmlFor="strasse">Straße *</Label>
                  <Input
                    id="strasse"
                    value={newCustomer.strasse}
                    onChange={(e) => setNewCustomer({ ...newCustomer, strasse: e.target.value })}
                    placeholder="Straße und Hausnummer"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plz">PLZ *</Label>
                  <Input
                    id="plz"
                    value={newCustomer.plz}
                    onChange={(e) => setNewCustomer({ ...newCustomer, plz: e.target.value })}
                    placeholder="PLZ"
                    required
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="stadt">Stadt *</Label>
                  <Input
                    id="stadt"
                    value={newCustomer.stadt}
                    onChange={(e) => setNewCustomer({ ...newCustomer, stadt: e.target.value })}
                    placeholder="Stadt"
                    required
                  />
                </div>
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
                  <Label htmlFor="kopie_lw">Kopie LW</Label>
                  <Select
                    value={newCustomer.kopie_lw}
                    onValueChange={(value) => setNewCustomer({ ...newCustomer, kopie_lw: value })}
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
