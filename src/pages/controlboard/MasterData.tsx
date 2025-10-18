import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Users, Building, Edit, Phone, Mail, ArrowUpDown, ChevronUp, ChevronDown, Plus, Trash2, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';

type SortKey = 'name' | 'status' | 'telefon' | 'email' | 'notfall_name' | 'created_at' | 'pflegegrad' | 'adresse' | 'geburtsdatum';
type SortDirection = 'asc' | 'desc';

export default function MasterData() {
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [customerSort, setCustomerSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'name', direction: 'asc' });
  const [employeeSort, setEmployeeSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'name', direction: 'asc' });
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Using type assertion to work with German table names - fetch ALL customers (active and inactive)
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('kunden')
        .select(`
          *,
          zeitfenster:kunden_zeitfenster(*),
          hauptbetreuer:mitarbeiter!mitarbeiter(id, vorname, nachname)
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
    
    // First filter by search query
    let filtered = customers;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = customers.filter((customer: any) => {
        const searchableFields = [
          customer.name,
          customer.telefonnr,
          customer.email,
          customer.adresse,
          customer.stadtteil,
          customer.notfall_name,
          customer.notfall_telefon,
          customer.pflegekasse,
        ].filter(Boolean).map(f => f.toLowerCase());
        
        return searchableFields.some(field => field.includes(query));
      });
    }
    
    // Then sort
    return [...filtered].sort((a, b) => {
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
        case 'pflegegrad':
          aValue = a.pflegegrad || 0;
          bValue = b.pflegegrad || 0;
          break;
        case 'adresse':
          aValue = (a.adresse || '').toLowerCase();
          bValue = (b.adresse || '').toLowerCase();
          break;
        case 'geburtsdatum':
          aValue = new Date(a.geburtsdatum || 0).getTime();
          bValue = new Date(b.geburtsdatum || 0).getTime();
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
  }, [customers, customerSort, searchQuery]);

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
              {/* Search Bar */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Kunden suchen (Name, Telefon, E-Mail, Adresse, Notfallkontakt...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
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
                              sortKey="pflegegrad" 
                              currentSort={customerSort} 
                              onClick={(key) => handleSort(key, 'customer')}
                            >
                              Pflegegrad
                            </SortButton>
                          </TableHead>
                          <TableHead>
                            <SortButton 
                              sortKey="adresse" 
                              currentSort={customerSort} 
                              onClick={(key) => handleSort(key, 'customer')}
                            >
                              Adresse
                            </SortButton>
                          </TableHead>
                          <TableHead>
                            <SortButton 
                              sortKey="geburtsdatum" 
                              currentSort={customerSort} 
                              onClick={(key) => handleSort(key, 'customer')}
                            >
                              Geburtsdatum
                            </SortButton>
                          </TableHead>
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
                             {customer.pflegegrad || '-'}
                           </TableCell>
                           <TableCell>
                             {customer.adresse || '-'}
                           </TableCell>
                           <TableCell>
                             {formatDate(customer.geburtsdatum)}
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kundendaten bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie alle Informationen für {editingCustomer?.name}
            </DialogDescription>
          </DialogHeader>
          
          {editingCustomer && (
            <form onSubmit={handleSaveCustomer} className="space-y-6">
              {/* Persönliche Daten */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Persönliche Daten</h3>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <Label htmlFor="name">Name</Label>
                     <Input
                       id="name"
                       value={editingCustomer.name || ''}
                       onChange={(e) => setEditingCustomer({
                         ...editingCustomer,
                         name: e.target.value
                       })}
                       required
                     />
                   </div>
                   <div>
                     <Label htmlFor="geburtsdatum">Geburtsdatum</Label>
                     <Input
                       id="geburtsdatum"
                       type="date"
                       value={editingCustomer.geburtsdatum || ''}
                       onChange={(e) => setEditingCustomer({
                         ...editingCustomer,
                         geburtsdatum: e.target.value
                       })}
                     />
                   </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <Label htmlFor="hauptbetreuer">Hauptbetreuer</Label>
                      <Select
                        value={editingCustomer.mitarbeiter || '__none__'}
                        onValueChange={(value) => setEditingCustomer({
                          ...editingCustomer,
                          mitarbeiter: value === '__none__' ? null : value
                        })}
                      >
                        <SelectTrigger id="hauptbetreuer">
                          <SelectValue placeholder="Hauptbetreuer auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Kein Hauptbetreuer</SelectItem>
                          {employees?.filter((e: any) => e.ist_aktiv).map((mitarbeiter: any) => (
                            <SelectItem key={mitarbeiter.id} value={mitarbeiter.id}>
                              {`${mitarbeiter.vorname || ''} ${mitarbeiter.nachname || ''}`.trim() || mitarbeiter.email || 'Unbenannter Mitarbeiter'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                   </div>
                 </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="adresse">Adresse</Label>
                    <Input
                      id="adresse"
                      value={editingCustomer.adresse || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        adresse: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="stadtteil">Stadtteil</Label>
                    <Input
                      id="stadtteil"
                      value={editingCustomer.stadtteil || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        stadtteil: e.target.value
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Kontaktdaten */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold">Kontaktdaten</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="telefonnr">Telefon</Label>
                    <Input
                      id="telefonnr"
                      value={editingCustomer.telefonnr || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        telefonnr: e.target.value
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
              </div>

              {/* Notfallkontakt */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold">Notfallkontakt</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="notfall_name">Name</Label>
                    <Input
                      id="notfall_name"
                      value={editingCustomer.notfall_name || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        notfall_name: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="notfall_telefon">Telefon</Label>
                    <Input
                      id="notfall_telefon"
                      value={editingCustomer.notfall_telefon || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        notfall_telefon: e.target.value
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Pflegedaten */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold">Pflegedaten</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pflegegrad">Pflegegrad</Label>
                    <Input
                      id="pflegegrad"
                      type="number"
                      min="0"
                      max="5"
                      value={editingCustomer.pflegegrad || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        pflegegrad: e.target.value ? parseInt(e.target.value) : null
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="stunden_kontingent_monat">Stunden Kontingent/Monat</Label>
                    <Input
                      id="stunden_kontingent_monat"
                      type="number"
                      step="0.5"
                      value={editingCustomer.stunden_kontingent_monat || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        stunden_kontingent_monat: e.target.value
                      })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pflegekasse">Pflegekasse</Label>
                    <Input
                      id="pflegekasse"
                      value={editingCustomer.pflegekasse || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        pflegekasse: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="versichertennummer">Versichertennummer</Label>
                    <Input
                      id="versichertennummer"
                      value={editingCustomer.versichertennummer || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        versichertennummer: e.target.value
                      })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="kasse_privat">Kasse Privat</Label>
                    <Input
                      id="kasse_privat"
                      value={editingCustomer.kasse_privat || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        kasse_privat: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="verhinderungspflege_status">Verhinderungspflege Status</Label>
                    <Input
                      id="verhinderungspflege_status"
                      value={editingCustomer.verhinderungspflege_status || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        verhinderungspflege_status: e.target.value
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Status und Austrittsinformationen */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold">Status und Austrittsinformationen</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="aktiv" className="text-base font-medium">Status</Label>
                    <Select
                      value={editingCustomer.aktiv ? 'true' : 'false'}
                      onValueChange={(value) => setEditingCustomer({
                        ...editingCustomer,
                        aktiv: value === 'true'
                      })}
                    >
                      <SelectTrigger id="aktiv">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Aktiv</SelectItem>
                        <SelectItem value="false">Nicht aktiv</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="austritt">Austrittsdatum</Label>
                    <Input
                      id="austritt"
                      type="date"
                      value={editingCustomer.austritt || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        austritt: e.target.value
                      })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="begruendung">Begründung für Austritt/Deaktivierung</Label>
                  <Textarea
                    id="begruendung"
                    value={editingCustomer.begruendung || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      begruendung: e.target.value
                    })}
                    placeholder="Begründung eingeben..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Weitere Informationen */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold">Weitere Informationen</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="eintritt">Eintrittsdatum</Label>
                    <Input
                      id="eintritt"
                      type="date"
                      value={editingCustomer.eintritt || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        eintritt: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status (Freitext)</Label>
                    <Input
                      id="status"
                      value={editingCustomer.status || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        status: e.target.value
                      })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tage">Tage</Label>
                    <Input
                      id="tage"
                      value={editingCustomer.tage || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        tage: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="kopie_lw_vorhanden">Kopie LW vorhanden</Label>
                    <Input
                      id="kopie_lw_vorhanden"
                      value={editingCustomer.kopie_lw_vorhanden || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        kopie_lw_vorhanden: e.target.value
                      })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="angehoerige_ansprechpartner">Angehörige/Ansprechpartner</Label>
                  <Input
                    id="angehoerige_ansprechpartner"
                    value={editingCustomer.angehoerige_ansprechpartner || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      angehoerige_ansprechpartner: e.target.value
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="sonstiges">Sonstiges</Label>
                  <Textarea
                    id="sonstiges"
                    value={editingCustomer.sonstiges || ''}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      sonstiges: e.target.value
                    })}
                    rows={3}
                  />
                </div>
              </div>

              {/* Zeitfenster Section */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">Zeitfenster</Label>
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

              <div className="flex justify-end gap-2 border-t pt-4">
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