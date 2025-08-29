import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Users, Building, Edit, Plus, Phone, Mail, MapPin } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function MasterData() {
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('nachname');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('ist_aktiv', true);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*');
      
      if (error) throw error;
      return data;
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async (customerData: any) => {
      const { error } = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', customerData.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsDialogOpen(false);
      setEditingCustomer(null);
      toast({
        title: 'Erfolg',
        description: 'Kundendaten wurden aktualisiert',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler',
        description: 'Kundendaten konnten nicht aktualisiert werden',
        variant: 'destructive',
      });
    },
  });

  const handleEditCustomer = (customer: any) => {
    setEditingCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      updateCustomerMutation.mutate(editingCustomer);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const getEmployeeName = (userId: string) => {
    const profile = profiles?.find(p => p.benutzer_id === userId);
    return profile ? `${profile.vorname} ${profile.nachname}` : 'Unbekannt';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stammdatenverwaltung</h1>
        <p className="text-muted-foreground">
          Verwalten Sie Kunden- und Mitarbeiterdaten
        </p>
      </div>

      <Tabs defaultValue="customers" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="customers">Kunden</TabsTrigger>
          <TabsTrigger value="employees">Mitarbeiter</TabsTrigger>
        </TabsList>

        {/* Kunden Tab */}
        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Kundenverwaltung
              </CardTitle>
              <CardDescription>
                Bearbeiten Sie alle Kundendaten direkt in der Tabelle
              </CardDescription>
            </CardHeader>
            <CardContent>
              {customersLoading ? (
                <div className="text-center py-4">Lade Kundendaten...</div>
              ) : customers && customers.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Geburtsdatum</TableHead>
                        <TableHead>Adresse</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead>E-Mail</TableHead>
                        <TableHead>Notfallkontakt</TableHead>
                        <TableHead>Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">
                            {customer.vorname} {customer.nachname}
                          </TableCell>
                          <TableCell>{formatDate(customer.geburtsdatum)}</TableCell>
                          <TableCell>
                            <div className="max-w-[200px] truncate">
                              {customer.adresse || '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {customer.telefon ? (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {customer.telefon}
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {customer.email ? (
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {customer.email}
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {customer.notfallkontakt_name ? (
                              <div>
                                <div className="font-medium text-sm">
                                  {customer.notfallkontakt_name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {customer.notfallkontakt_telefon}
                                </div>
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditCustomer(customer)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Kunden gefunden
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mitarbeiter Tab */}
        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Mitarbeiterverwaltung
              </CardTitle>
              <CardDescription>
                Übersicht aller registrierten Mitarbeiter
              </CardDescription>
            </CardHeader>
            <CardContent>
              {employeesLoading ? (
                <div className="text-center py-4">Lade Mitarbeiterdaten...</div>
              ) : employees && employees.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Mitarbeiternummer</TableHead>
                        <TableHead>Einstellungsdatum</TableHead>
                        <TableHead>Stundenlohn</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Qualifikationen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((employee) => {
                        const profile = profiles?.find(p => p.benutzer_id === employee.benutzer_id);
                        return (
                          <TableRow key={employee.id}>
                            <TableCell className="font-medium">
                              {getEmployeeName(employee.benutzer_id)}
                            </TableCell>
                            <TableCell>{employee.position || '-'}</TableCell>
                            <TableCell>{employee.mitarbeiter_nummer || '-'}</TableCell>
                            <TableCell>{formatDate(employee.einstellungsdatum)}</TableCell>
                            <TableCell>
                              {employee.stundenlohn ? `${employee.stundenlohn}€` : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={employee.ist_aktiv ? 'default' : 'secondary'}>
                                {employee.ist_aktiv ? 'Aktiv' : 'Inaktiv'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {employee.qualifikationen && employee.qualifikationen.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {employee.qualifikationen.slice(0, 2).map((qual, index) => (
                                    <Badge key={index} variant="outline" className="text-xs">
                                      {qual}
                                    </Badge>
                                  ))}
                                  {employee.qualifikationen.length > 2 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{employee.qualifikationen.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Mitarbeiter gefunden
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Customer Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Kundendaten bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie die Informationen für {editingCustomer?.vorname} {editingCustomer?.nachname}
            </DialogDescription>
          </DialogHeader>
          
          {editingCustomer && (
            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">Vorname</Label>
                  <Input
                    id="first_name"
                    value={editingCustomer.vorname || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      vorname: e.target.value
                    })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Nachname</Label>
                  <Input
                    id="last_name"
                    value={editingCustomer.nachname || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      nachname: e.target.value
                    })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="birth_date">Geburtsdatum</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={editingCustomer.geburtsdatum || ''}
                  onChange={(e) => setEditingCustomer({
                    ...editingCustomer,
                    geburtsdatum: e.target.value
                  })}
                />
              </div>

              <div>
                <Label htmlFor="address">Adresse</Label>
                <Textarea
                  id="address"
                  value={editingCustomer.adresse || ''}
                  onChange={(e) => setEditingCustomer({
                    ...editingCustomer,
                    adresse: e.target.value
                  })}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={editingCustomer.telefon || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      telefon: e.target.value
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editingCustomer.email || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      email: e.target.value
                    })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emergency_contact_name">Notfallkontakt Name</Label>
                  <Input
                    id="emergency_contact_name"
                    value={editingCustomer.notfallkontakt_name || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      notfallkontakt_name: e.target.value
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="emergency_contact_phone">Notfallkontakt Telefon</Label>
                  <Input
                    id="emergency_contact_phone"
                    value={editingCustomer.notfallkontakt_telefon || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      notfallkontakt_telefon: e.target.value
                    })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notizen</Label>
                <Textarea
                  id="notes"
                  value={editingCustomer.notizen || ''}
                  onChange={(e) => setEditingCustomer({
                    ...editingCustomer,
                    notizen: e.target.value
                  })}
                  rows={3}
                  placeholder="Besondere Hinweise, Allergien, etc."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Abbrechen
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateCustomerMutation.isPending}
                >
                  {updateCustomerMutation.isPending ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}