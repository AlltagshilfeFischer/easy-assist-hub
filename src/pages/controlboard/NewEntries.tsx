import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, Building2, Save, Plus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function NewEntries() {
  const [newCustomer, setNewCustomer] = useState({
    vorname: '',
    nachname: '',
    geburtsdatum: '',
    adresse: '',
    telefon: '',
    email: '',
    notfallkontakt_name: '',
    notfallkontakt_telefon: '',
    notizen: ''
  });

  const [newEmployee, setNewEmployee] = useState({
    position: '',
    mitarbeiter_nummer: '',
    stundenlohn: '',
    qualifikationen: '',
    notizen: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createCustomerMutation = useMutation({
    mutationFn: async (customerData: any) => {
      const { error } = await supabase
        .from('customers')
        .insert([customerData]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setNewCustomer({
        vorname: '',
        nachname: '',
        geburtsdatum: '',
        adresse: '',
        telefon: '',
        email: '',
        notfallkontakt_name: '',
        notfallkontakt_telefon: '',
        notizen: ''
      });
      toast({
        title: 'Erfolg',
        description: 'Neuer Kunde wurde erstellt',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler',
        description: 'Kunde konnte nicht erstellt werden',
        variant: 'destructive',
      });
    },
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (employeeData: any) => {
      // Hinweis: Für neue Mitarbeiter müsste normalerweise ein User Account erstellt werden
      // Dies ist eine vereinfachte Version
      console.log('Employee creation would require user account setup:', employeeData);
      throw new Error('Mitarbeiter-Erstellung erfordert vollständige Benutzerregistrierung');
    },
    onError: (error) => {
      toast({
        title: 'Hinweis',
        description: 'Mitarbeiter-Erstellung erfordert vollständige Benutzerregistrierung und wird in einer zukünftigen Version implementiert',
        variant: 'destructive',
      });
    },
  });

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    createCustomerMutation.mutate(newCustomer);
  };

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const employeeData = {
      ...newEmployee,
      stundenlohn: newEmployee.stundenlohn ? parseFloat(newEmployee.stundenlohn) : null,
      qualifikationen: newEmployee.qualifikationen.split(',').map(q => q.trim()).filter(q => q)
    };
    createEmployeeMutation.mutate(employeeData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Neukunden & Neumitarbeiter</h1>
        <p className="text-muted-foreground">
          Erfassen Sie neue Kunden und Mitarbeiter in das System
        </p>
      </div>

      <Tabs defaultValue="customers" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="customers">Neuer Kunde</TabsTrigger>
          <TabsTrigger value="employees">Neuer Mitarbeiter</TabsTrigger>
        </TabsList>

        {/* Neuer Kunde Tab */}
        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Neuen Kunden anlegen
              </CardTitle>
              <CardDescription>
                Erfassen Sie alle relevanten Informationen für den neuen Kunden
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCustomer} className="space-y-6">
                {/* Persönliche Daten */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Persönliche Daten</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="customer_first_name">Vorname *</Label>
                      <Input
                        id="customer_first_name"
                        value={newCustomer.vorname}
                        onChange={(e) => setNewCustomer({
                          ...newCustomer,
                          vorname: e.target.value
                        })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="customer_last_name">Nachname *</Label>
                      <Input
                        id="customer_last_name"
                        value={newCustomer.nachname}
                        onChange={(e) => setNewCustomer({
                          ...newCustomer,
                          nachname: e.target.value
                        })}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="customer_birth_date">Geburtsdatum</Label>
                    <Input
                      id="customer_birth_date"
                      type="date"
                      value={newCustomer.geburtsdatum}
                      onChange={(e) => setNewCustomer({
                        ...newCustomer,
                        geburtsdatum: e.target.value
                      })}
                    />
                  </div>
                </div>

                {/* Kontaktdaten */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Kontaktdaten</h3>
                  <div>
                    <Label htmlFor="customer_address">Adresse</Label>
                    <Textarea
                      id="customer_address"
                      value={newCustomer.adresse}
                      onChange={(e) => setNewCustomer({
                        ...newCustomer,
                        adresse: e.target.value
                      })}
                      rows={2}
                      placeholder="Straße, Hausnummer, PLZ, Ort"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="customer_phone">Telefon</Label>
                      <Input
                        id="customer_phone"
                        value={newCustomer.telefon}
                        onChange={(e) => setNewCustomer({
                          ...newCustomer,
                          telefon: e.target.value
                        })}
                        placeholder="+49 123 456789"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customer_email">E-Mail</Label>
                      <Input
                        id="customer_email"
                        type="email"
                        value={newCustomer.email}
                        onChange={(e) => setNewCustomer({
                          ...newCustomer,
                          email: e.target.value
                        })}
                        placeholder="kunde@beispiel.de"
                      />
                    </div>
                  </div>
                </div>

                {/* Notfallkontakt */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Notfallkontakt</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emergency_contact_name">Name</Label>
                      <Input
                        id="emergency_contact_name"
                        value={newCustomer.notfallkontakt_name}
                        onChange={(e) => setNewCustomer({
                          ...newCustomer,
                          notfallkontakt_name: e.target.value
                        })}
                        placeholder="Max Mustermann"
                      />
                    </div>
                    <div>
                      <Label htmlFor="emergency_contact_phone">Telefon</Label>
                      <Input
                        id="emergency_contact_phone"
                        value={newCustomer.notfallkontakt_telefon}
                        onChange={(e) => setNewCustomer({
                          ...newCustomer,
                          notfallkontakt_telefon: e.target.value
                        })}
                        placeholder="+49 123 456789"
                      />
                    </div>
                  </div>
                </div>

                {/* Besondere Hinweise */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Besondere Hinweise</h3>
                  <div>
                    <Label htmlFor="customer_notes">Notizen</Label>
                    <Textarea
                      id="customer_notes"
                      value={newCustomer.notizen}
                      onChange={(e) => setNewCustomer({
                        ...newCustomer,
                        notizen: e.target.value
                      })}
                      rows={4}
                      placeholder="Allergien, besondere Bedürfnisse, Medikamente, etc."
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={createCustomerMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {createCustomerMutation.isPending ? 'Speichern...' : 'Kunden anlegen'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Neuer Mitarbeiter Tab */}
        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Neuen Mitarbeiter anlegen
              </CardTitle>
              <CardDescription>
                Hinweis: Die vollständige Mitarbeiterregistrierung erfordert einen Benutzeraccount und wird in einer zukünftigen Version implementiert
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateEmployee} className="space-y-6">
                {/* Stelleninformationen */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Stelleninformationen</h3>
                  <div>
                    <Label htmlFor="employee_position">Position *</Label>
                    <Input
                      id="employee_position"
                      value={newEmployee.position}
                      onChange={(e) => setNewEmployee({
                        ...newEmployee,
                        position: e.target.value
                      })}
                      placeholder="Pflegekraft, Haushaltshilfe, etc."
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="employee_number">Mitarbeiternummer</Label>
                      <Input
                        id="employee_number"
                        value={newEmployee.mitarbeiter_nummer}
                        onChange={(e) => setNewEmployee({
                          ...newEmployee,
                          mitarbeiter_nummer: e.target.value
                        })}
                        placeholder="MA001"
                      />
                    </div>
                    <div>
                      <Label htmlFor="employee_hourly_rate">Stundenlohn (€)</Label>
                      <Input
                        id="employee_hourly_rate"
                        type="number"
                        step="0.01"
                        value={newEmployee.stundenlohn}
                        onChange={(e) => setNewEmployee({
                          ...newEmployee,
                          stundenlohn: e.target.value
                        })}
                        placeholder="15.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Qualifikationen */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Qualifikationen</h3>
                  <div>
                    <Label htmlFor="employee_qualifications">Qualifikationen</Label>
                    <Input
                      id="employee_qualifications"
                      value={newEmployee.qualifikationen}
                      onChange={(e) => setNewEmployee({
                        ...newEmployee,
                        qualifikationen: e.target.value
                      })}
                      placeholder="Altenpflege, Erste Hilfe, Demenzbetreuung (durch Komma getrennt)"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Mehrere Qualifikationen durch Komma trennen
                    </p>
                  </div>
                </div>

                {/* Notizen */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Zusätzliche Informationen</h3>
                  <div>
                    <Label htmlFor="employee_notes">Notizen</Label>
                    <Textarea
                      id="employee_notes"
                      value={newEmployee.notizen}
                      onChange={(e) => setNewEmployee({
                        ...newEmployee,
                        notizen: e.target.value
                      })}
                      rows={4}
                      placeholder="Besondere Fähigkeiten, Verfügbarkeit, etc."
                    />
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-yellow-600">⚠️</div>
                    <div>
                      <h4 className="font-medium text-yellow-800">Hinweis zur Mitarbeiterregistrierung</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        Die vollständige Registrierung neuer Mitarbeiter erfordert die Erstellung eines Benutzeraccounts 
                        mit E-Mail-Verifizierung und Passwort-Setup. Diese Funktion wird in einer zukünftigen Version 
                        der Anwendung implementiert.
                      </p>
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={createEmployeeMutation.isPending}
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Mitarbeiter anlegen (Demo)
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}