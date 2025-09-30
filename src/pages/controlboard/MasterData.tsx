import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from '@/components/ui/dialog';
import { Users, Building, Edit, Phone, Mail } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { importAllCustomers } from '@/scripts/importCustomers';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function MasterData() {
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Using type assertion to work with German table names
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('kunden')
        .select('*')
        .order('nachname');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('mitarbeiter')
        .select('*')
        .eq('ist_aktiv', true);
      
      if (error) throw error;
      return data;
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async (customerData: any) => {
      const { error } = await (supabase as any)
        .from('kunden')
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
                        <TableHead>Status</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead>E-Mail</TableHead>
                        <TableHead>Notfallkontakt</TableHead>
                        <TableHead>Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.map((customer: any) => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">
                            {customer.vorname} {customer.nachname}
                          </TableCell>
                          <TableCell>
                            <Badge variant={customer.aktiv ? "default" : "secondary"}>
                              {customer.aktiv ? 'Aktiv' : 'Inaktiv'}
                            </Badge>
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
                            {customer.notfall_name ? (
                              <div>
                                <div className="font-medium text-sm">
                                  {customer.notfall_name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {customer.notfall_telefon}
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
                        <TableHead>E-Mail</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Erstellt am</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((employee: any) => (
                        <TableRow key={employee.id}>
                          <TableCell className="font-medium">
                            {employee.vorname} {employee.nachname}
                          </TableCell>
                          <TableCell>{employee.email || '-'}</TableCell>
                          <TableCell>{employee.telefon || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={employee.ist_aktiv ? 'default' : 'secondary'}>
                              {employee.ist_aktiv ? 'Aktiv' : 'Inaktiv'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(employee.created_at)}</TableCell>
                        </TableRow>
                      ))}
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
                    value={editingCustomer.notfall_name || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      notfall_name: e.target.value
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="emergency_contact_phone">Notfallkontakt Telefon</Label>
                  <Input
                    id="emergency_contact_phone"
                    value={editingCustomer.notfall_telefon || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      notfall_telefon: e.target.value
                    })}
                  />
                </div>
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