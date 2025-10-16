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
import { Users, Building, Edit, Phone, Mail, ArrowUpDown, ChevronUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';

type SortKey = 'name' | 'status' | 'telefon' | 'email' | 'notfall_name' | 'created_at';
type SortDirection = 'asc' | 'desc';

export default function MasterData() {
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [customerSort, setCustomerSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'name', direction: 'asc' });
  const [employeeSort, setEmployeeSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'name', direction: 'asc' });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Using type assertion to work with German table names
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('kunden')
        .select(`
          *,
          zeitfenster:kunden_zeitfenster(*)
        `)
        .order('name');
      
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
      const { zeitfenster, ...kundenData } = customerData;
      
      // Update customer data
      const { error: kundenError } = await (supabase as any)
        .from('kunden')
        .update(kundenData)
        .eq('id', kundenData.id);
      
      if (kundenError) throw kundenError;

      // Delete existing zeitfenster
      const { error: deleteError } = await (supabase as any)
        .from('kunden_zeitfenster')
        .delete()
        .eq('kunden_id', kundenData.id);
      
      if (deleteError) throw deleteError;

      // Insert new zeitfenster if any
      if (zeitfenster && zeitfenster.length > 0) {
        const { error: insertError } = await (supabase as any)
          .from('kunden_zeitfenster')
          .insert(zeitfenster.map((z: any) => ({
            kunden_id: kundenData.id,
            wochentag: z.wochentag,
            von: z.von,
            bis: z.bis,
            prioritaet: z.prioritaet || 3
          })));
        
        if (insertError) throw insertError;
      }
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

  const getWeekdayName = (day: number): string => {
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return days[day] || '';
  };

  const formatTimeSlots = (zeitfenster: any[]) => {
    if (!zeitfenster || zeitfenster.length === 0) return null;
    
    // Group by weekday
    const grouped = zeitfenster.reduce((acc: any, slot: any) => {
      if (!acc[slot.wochentag]) {
        acc[slot.wochentag] = [];
      }
      acc[slot.wochentag].push(slot);
      return acc;
    }, {});

    // Sort by weekday (Monday first)
    const sortedDays = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => {
        // Convert Sunday (0) to 7 for sorting
        const aDay = a === 0 ? 7 : a;
        const bDay = b === 0 ? 7 : b;
        return aDay - bDay;
      });

    return (
      <div className="flex flex-wrap gap-1">
        {sortedDays.map((day) => (
          <Badge key={day} variant="outline" className="text-xs">
            <span className="font-semibold">{getWeekdayName(day)}</span>
            <span className="mx-1">·</span>
            <span className="text-muted-foreground">
              {grouped[day].map((slot: any, idx: number) => (
                <span key={idx}>
                  {slot.von?.substring(0, 5)}-{slot.bis?.substring(0, 5)}
                  {idx < grouped[day].length - 1 && ', '}
                </span>
              ))}
            </span>
          </Badge>
        ))}
      </div>
    );
  };

  const handleSort = (key: SortKey, type: 'customer' | 'employee') => {
    if (type === 'customer') {
      setCustomerSort(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
      }));
    } else {
      setEmployeeSort(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
      }));
    }
  };

  const SortButton = ({ sortKey, currentSort, onClick, children }: {
    sortKey: SortKey;
    currentSort: { key: SortKey; direction: SortDirection };
    onClick: (key: SortKey) => void;
    children: React.ReactNode;
  }) => {
    const isActive = currentSort.key === sortKey;
    return (
      <Button
        variant="ghost"
        className="h-auto p-0 font-medium hover:bg-transparent"
        onClick={() => onClick(sortKey)}
      >
        <div className="flex items-center gap-1">
          {children}
          {isActive ? (
            currentSort.direction === 'asc' ? 
              <ChevronUp className="h-4 w-4" /> : 
              <ChevronDown className="h-4 w-4" />
          ) : (
            <ArrowUpDown className="h-4 w-4 opacity-50" />
          )}
        </div>
      </Button>
    );
  };

  const sortedCustomers = useMemo(() => {
    if (!customers) return [];
    
    return [...customers].sort((a, b) => {
      const { key, direction } = customerSort;
      let aValue: string | number = '';
      let bValue: string | number = '';

      switch (key) {
        case 'name':
          aValue = (a.name || '').toLowerCase();
          bValue = (b.name || '').toLowerCase();
          break;
        case 'status':
          aValue = a.aktiv ? 'aktiv' : 'inaktiv';
          bValue = b.aktiv ? 'aktiv' : 'inaktiv';
          break;
        case 'telefon':
          aValue = (a.telefonnr || '').toLowerCase();
          bValue = (b.telefonnr || '').toLowerCase();
          break;
        case 'email':
          aValue = (a.email || '').toLowerCase();
          bValue = (b.email || '').toLowerCase();
          break;
        case 'notfall_name':
          aValue = (a.notfall_name || '').toLowerCase();
          bValue = (b.notfall_name || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [customers, customerSort]);

  const sortedEmployees = useMemo(() => {
    if (!employees) return [];
    
    return [...employees].sort((a, b) => {
      const { key, direction } = employeeSort;
      let aValue: string | number = '';
      let bValue: string | number = '';

      switch (key) {
        case 'name':
          aValue = `${a.vorname || ''} ${a.nachname || ''}`.trim().toLowerCase();
          bValue = `${b.vorname || ''} ${b.nachname || ''}`.trim().toLowerCase();
          break;
        case 'email':
          aValue = (a.email || '').toLowerCase();
          bValue = (b.email || '').toLowerCase();
          break;
        case 'telefon':
          aValue = (a.telefon || '').toLowerCase();
          bValue = (b.telefon || '').toLowerCase();
          break;
        case 'status':
          aValue = a.ist_aktiv ? 'aktiv' : 'inaktiv';
          bValue = b.ist_aktiv ? 'aktiv' : 'inaktiv';
          break;
        case 'created_at':
          aValue = new Date(a.created_at || 0).getTime();
          bValue = new Date(b.created_at || 0).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [employees, employeeSort]);

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
                         <TableHead>
                           <SortButton 
                             sortKey="name" 
                             currentSort={customerSort} 
                             onClick={(key) => handleSort(key, 'customer')}
                           >
                             Name
                           </SortButton>
                         </TableHead>
                         <TableHead>
                           <SortButton 
                             sortKey="status" 
                             currentSort={customerSort} 
                             onClick={(key) => handleSort(key, 'customer')}
                           >
                             Status
                           </SortButton>
                         </TableHead>
                         <TableHead>
                           <SortButton 
                             sortKey="telefon" 
                             currentSort={customerSort} 
                             onClick={(key) => handleSort(key, 'customer')}
                           >
                             Telefon
                           </SortButton>
                         </TableHead>
                         <TableHead>
                           <SortButton 
                             sortKey="email" 
                             currentSort={customerSort} 
                             onClick={(key) => handleSort(key, 'customer')}
                           >
                             E-Mail
                           </SortButton>
                         </TableHead>
                          <TableHead>
                            <SortButton 
                              sortKey="notfall_name" 
                              currentSort={customerSort} 
                              onClick={(key) => handleSort(key, 'customer')}
                            >
                              Notfallkontakt
                            </SortButton>
                          </TableHead>
                          <TableHead>Zeitfenster</TableHead>
                          <TableHead>Aktionen</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {sortedCustomers.map((customer: any) => (
                         <TableRow key={customer.id}>
                           <TableCell className="font-medium">
                             {customer.name}
                           </TableCell>
                           <TableCell>
                             <Badge variant={customer.aktiv ? "default" : "secondary"}>
                               {customer.aktiv ? 'Aktiv' : 'Inaktiv'}
                             </Badge>
                           </TableCell>
                           <TableCell>
                             {customer.telefonnr ? (
                               <div className="flex items-center gap-1">
                                 <Phone className="h-3 w-3" />
                                 {customer.telefonnr}
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
                             {formatTimeSlots(customer.zeitfenster) || (
                               <span className="text-muted-foreground text-sm">
                                 Keine Zeitfenster
                               </span>
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
                         <TableHead>
                           <SortButton 
                             sortKey="name" 
                             currentSort={employeeSort} 
                             onClick={(key) => handleSort(key, 'employee')}
                           >
                             Name
                           </SortButton>
                         </TableHead>
                         <TableHead>
                           <SortButton 
                             sortKey="email" 
                             currentSort={employeeSort} 
                             onClick={(key) => handleSort(key, 'employee')}
                           >
                             E-Mail
                           </SortButton>
                         </TableHead>
                         <TableHead>
                           <SortButton 
                             sortKey="telefon" 
                             currentSort={employeeSort} 
                             onClick={(key) => handleSort(key, 'employee')}
                           >
                             Telefon
                           </SortButton>
                         </TableHead>
                         <TableHead>
                           <SortButton 
                             sortKey="status" 
                             currentSort={employeeSort} 
                             onClick={(key) => handleSort(key, 'employee')}
                           >
                             Status
                           </SortButton>
                         </TableHead>
                         <TableHead>
                           <SortButton 
                             sortKey="created_at" 
                             currentSort={employeeSort} 
                             onClick={(key) => handleSort(key, 'employee')}
                           >
                             Erstellt am
                           </SortButton>
                         </TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {sortedEmployees.map((employee: any) => (
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

              {/* Zeitfenster Section */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Zeitfenster</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const zeitfenster = editingCustomer.zeitfenster || [];
                      setEditingCustomer({
                        ...editingCustomer,
                        zeitfenster: [...zeitfenster, {
                          wochentag: 1,
                          von: '08:00',
                          bis: '12:00',
                          prioritaet: 3
                        }]
                      });
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Zeitfenster hinzufügen
                  </Button>
                </div>

                {(editingCustomer.zeitfenster || []).map((zeitfenster: any, index: number) => (
                  <div key={index} className="grid grid-cols-[1fr,1fr,1fr,auto] gap-2 items-end p-3 border rounded-lg">
                    <div>
                      <Label className="text-xs">Wochentag</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                        value={zeitfenster.wochentag}
                        onChange={(e) => {
                          const updated = [...(editingCustomer.zeitfenster || [])];
                          updated[index] = { ...updated[index], wochentag: parseInt(e.target.value) };
                          setEditingCustomer({ ...editingCustomer, zeitfenster: updated });
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
                          const updated = [...(editingCustomer.zeitfenster || [])];
                          updated[index] = { ...updated[index], von: e.target.value };
                          setEditingCustomer({ ...editingCustomer, zeitfenster: updated });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Bis</Label>
                      <Input
                        type="time"
                        value={zeitfenster.bis || ''}
                        onChange={(e) => {
                          const updated = [...(editingCustomer.zeitfenster || [])];
                          updated[index] = { ...updated[index], bis: e.target.value };
                          setEditingCustomer({ ...editingCustomer, zeitfenster: updated });
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const updated = (editingCustomer.zeitfenster || []).filter((_: any, i: number) => i !== index);
                        setEditingCustomer({ ...editingCustomer, zeitfenster: updated });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}

                {(!editingCustomer.zeitfenster || editingCustomer.zeitfenster.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Keine Zeitfenster definiert
                  </p>
                )}
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