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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, Building, Edit, Phone, Mail, ArrowUpDown, ChevronUp, ChevronDown, Plus, Trash2, Search, Power } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';

type SortKey = 'name' | 'status' | 'telefon' | 'email' | 'created_at' | 'pflegegrad' | 'adresse' | 'geburtsdatum';
type SortDirection = 'asc' | 'desc';

export default function MasterData() {
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [customerSort, setCustomerSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'name', direction: 'asc' });
  const [employeeSort, setEmployeeSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'name', direction: 'asc' });
  const [searchQuery, setSearchQuery] = useState('');
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [customerKategorieFilter, setCustomerKategorieFilter] = useState<'all' | 'Kunde' | 'Interessent'>('all');
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);
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
      // Load employees first
      const { data: mitData, error: mitError } = await (supabase as any)
        .from('mitarbeiter')
        .select('*');
      if (mitError) throw mitError;

      const benutzerIds = (mitData || [])
        .map((m: any) => m.benutzer_id)
        .filter((id: string | null) => !!id);

      if (benutzerIds.length === 0) return mitData;

      // Load related user data to get email
      const { data: benData, error: benError } = await (supabase as any)
        .from('benutzer')
        .select('id, email, vorname, nachname')
        .in('id', benutzerIds);
      if (benError) throw benError;

      const byId = new Map((benData || []).map((b: any) => [b.id, b]));
      const enriched = (mitData || []).map((m: any) => ({
        ...m,
        email: m.email ?? (m.benutzer_id ? (byId.get(m.benutzer_id) as any)?.email : undefined),
        benutzer: m.benutzer_id ? (byId.get(m.benutzer_id) as any) : undefined,
      }));

      return enriched;
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

  const convertToCustomerMutation = useMutation({
    mutationFn: async (kundenId: string) => {
      const { error } = await (supabase as any)
        .from('kunden')
        .update({ kategorie: 'Kunde' })
        .eq('id', kundenId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: 'Erfolg',
        description: 'Interessent wurde zu Kunde umgewandelt',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler',
        description: 'Umwandlung fehlgeschlagen',
        variant: 'destructive',
      });
    },
  });

  const toggleCustomerStatusMutation = useMutation({
    mutationFn: async ({ kundenId, currentStatus }: { kundenId: string; currentStatus: boolean }) => {
      const { error } = await (supabase as any)
        .from('kunden')
        .update({ aktiv: !currentStatus })
        .eq('id', kundenId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: 'Erfolg',
        description: variables.currentStatus ? 'Kunde wurde deaktiviert' : 'Kunde wurde aktiviert',
      });
    },
    onError: () => {
      toast({
        title: 'Fehler',
        description: 'Status konnte nicht geändert werden',
        variant: 'destructive',
      });
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (kundenId: string) => {
      // First delete related records
      await (supabase as any).from('dokumente').delete().eq('kunden_id', kundenId);
      await (supabase as any).from('termine').delete().eq('kunden_id', kundenId);
      
      // Then delete the customer
      const { error } = await (supabase as any)
        .from('kunden')
        .delete()
        .eq('id', kundenId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setDeleteCustomerId(null);
      toast({
        title: 'Erfolg',
        description: 'Kunde wurde erfolgreich gelöscht',
      });
    },
    onError: () => {
      toast({
        title: 'Fehler',
        description: 'Kunde konnte nicht gelöscht werden',
        variant: 'destructive',
      });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async (employeeData: any) => {
      const { error } = await (supabase as any)
        .from('mitarbeiter')
        .update(employeeData)
        .eq('id', employeeData.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsEmployeeDialogOpen(false);
      setEditingEmployee(null);
      toast({
        title: 'Erfolg',
        description: 'Mitarbeiterdaten wurden aktualisiert',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fehler',
        description: 'Mitarbeiterdaten konnten nicht aktualisiert werden',
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

  const handleEditEmployee = (employee: any) => {
    setEditingEmployee(employee);
    setIsEmployeeDialogOpen(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmployee) {
      updateEmployeeMutation.mutate(editingEmployee);
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
          customer.pflegekasse,
        ].filter(Boolean).map(f => f.toLowerCase());
        
        return searchableFields.some(field => field.includes(query));
      });
    }
    
    // Filter by status
    if (customerStatusFilter === 'active') {
      filtered = filtered.filter((customer: any) => customer.aktiv === true);
    } else if (customerStatusFilter === 'inactive') {
      filtered = filtered.filter((customer: any) => customer.aktiv === false);
    }
    
    // Filter by kategorie
    if (customerKategorieFilter === 'Kunde') {
      filtered = filtered.filter((customer: any) => customer.kategorie === 'Kunde');
    } else if (customerKategorieFilter === 'Interessent') {
      filtered = filtered.filter((customer: any) => customer.kategorie === 'Interessent');
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
  }, [customers, customerSort, searchQuery, customerStatusFilter, customerKategorieFilter]);

  const sortedEmployees = useMemo(() => {
    if (!employees) return [];
    
    // First filter by search query
    let filtered = employees;
    if (employeeSearchQuery.trim()) {
      const query = employeeSearchQuery.toLowerCase();
      filtered = employees.filter((employee: any) => {
        const searchableFields = [
          employee.vorname,
          employee.nachname,
          employee.email,
          employee.telefon,
        ].filter(Boolean).map(f => f.toLowerCase());
        
        return searchableFields.some(field => field.includes(query));
      });
    }
    
    // Filter by status
    if (employeeStatusFilter === 'active') {
      filtered = filtered.filter((employee: any) => employee.ist_aktiv === true);
    } else if (employeeStatusFilter === 'inactive') {
      filtered = filtered.filter((employee: any) => employee.ist_aktiv === false);
    }
    
    // Then sort
    return [...filtered].sort((a, b) => {
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
  }, [employees, employeeSort, employeeSearchQuery, employeeStatusFilter]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Stammdatenverwaltung</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Verwalten Sie Kunden- und Mitarbeiterdaten
        </p>
      </div>

      <Tabs defaultValue="customers" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="customers" className="text-sm sm:text-base">Kunden</TabsTrigger>
          <TabsTrigger value="employees" className="text-sm sm:text-base">Mitarbeiter</TabsTrigger>
        </TabsList>

        {/* Kunden Tab */}
        <TabsContent value="customers">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Building className="h-4 w-4 sm:h-5 sm:w-5" />
                Kundenverwaltung
              </CardTitle>
              <CardDescription className="text-sm">
                Bearbeiten Sie alle Kundendaten direkt in der Tabelle
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {/* Search and Filter Bar */}
              <div className="mb-4 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Kunden suchen..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 text-sm"
                    />
                  </div>
                  <Select value={customerStatusFilter} onValueChange={(value: any) => setCustomerStatusFilter(value)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle anzeigen</SelectItem>
                      <SelectItem value="active">Nur Aktive</SelectItem>
                      <SelectItem value="inactive">Nur Inaktive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Kategorie Filter Buttons */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={customerKategorieFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCustomerKategorieFilter('all')}
                  >
                    Alle ({customers?.length || 0})
                  </Button>
                  <Button
                    variant={customerKategorieFilter === 'Kunde' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCustomerKategorieFilter('Kunde')}
                  >
                    Kunden ({customers?.filter((c: any) => c.kategorie === 'Kunde').length || 0})
                  </Button>
                  <Button
                    variant={customerKategorieFilter === 'Interessent' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCustomerKategorieFilter('Interessent')}
                  >
                    Interessenten ({customers?.filter((c: any) => c.kategorie === 'Interessent').length || 0})
                  </Button>
                </div>
              </div>
              {customersLoading ? (
                <div className="text-center py-4">Lade Kundendaten...</div>
              ) : customers && customers.length > 0 ? (
                <div className="rounded-md border overflow-x-auto">
                   <Table className="min-w-[900px]">
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
                          <TableHead>Kategorie</TableHead>
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
                               <Badge variant={customer.kategorie === 'Interessent' ? "outline" : "default"}>
                                 {customer.kategorie || 'Kunde'}
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
                                 <div className="flex gap-2">
                                   <Button
                                     variant="outline"
                                     size="sm"
                                     onClick={() => handleEditCustomer(customer)}
                                     title="Bearbeiten"
                                   >
                                     <Edit className="h-3 w-3" />
                                   </Button>
                                   <Button
                                     variant={customer.aktiv ? "outline" : "default"}
                                     size="sm"
                                     onClick={() => toggleCustomerStatusMutation.mutate({ 
                                       kundenId: customer.id, 
                                       currentStatus: customer.aktiv 
                                     })}
                                     disabled={toggleCustomerStatusMutation.isPending}
                                     title={customer.aktiv ? "Deaktivieren" : "Aktivieren"}
                                   >
                                     <Power className="h-3 w-3" />
                                   </Button>
                                   <Button
                                     variant="destructive"
                                     size="sm"
                                     onClick={() => setDeleteCustomerId(customer.id)}
                                     title="Löschen"
                                   >
                                     <Trash2 className="h-3 w-3" />
                                   </Button>
                                   {customer.kategorie === 'Interessent' && (
                                     <Button
                                       variant="default"
                                       size="sm"
                                       onClick={() => convertToCustomerMutation.mutate(customer.id)}
                                       disabled={convertToCustomerMutation.isPending}
                                     >
                                       Zu Kunde
                                     </Button>
                                   )}
                                 </div>
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
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                Mitarbeiterverwaltung
              </CardTitle>
              <CardDescription className="text-sm">
                Übersicht aller registrierten Mitarbeiter
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {/* Search and Filter Bar */}
              <div className="mb-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Mitarbeiter suchen..."
                    value={employeeSearchQuery}
                    onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                    className="pl-10 text-sm"
                  />
                </div>
                <Select value={employeeStatusFilter} onValueChange={(value: any) => setEmployeeStatusFilter(value)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle anzeigen</SelectItem>
                    <SelectItem value="active">Nur Aktive</SelectItem>
                    <SelectItem value="inactive">Nur Inaktive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {employeesLoading ? (
                <div className="text-center py-4">Lade Mitarbeiterdaten...</div>
              ) : employees && employees.length > 0 ? (
                <div className="rounded-md border overflow-x-auto">
                   <Table className="min-w-[700px]">
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
                          <TableHead>Aktionen</TableHead>
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
                           <TableCell>
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => handleEditEmployee(employee)}
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
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="kategorie">Kategorie</Label>
                      <Select
                        value={editingCustomer.kategorie || 'Kunde'}
                        onValueChange={(value) => setEditingCustomer({
                          ...editingCustomer,
                          kategorie: value
                        })}
                      >
                        <SelectTrigger id="kategorie">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Interessent">Interessent</SelectItem>
                          <SelectItem value="Kunde">Kunde</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
                    <Label htmlFor="stunden_kontingent_monat">Stunden</Label>
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
                    <Label htmlFor="kasse_privat">Pflegekasse</Label>
                    <Select
                      value={editingCustomer.kasse_privat || ''}
                      onValueChange={(value) => setEditingCustomer({
                        ...editingCustomer,
                        kasse_privat: value
                      })}
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
                      value={editingCustomer.verhinderungspflege_status || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        verhinderungspflege_status: e.target.value
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold">Status</h3>
                
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

              {/* Ein- und Austrittsdaten */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold">Ein- und Austrittsdaten</h3>
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="kopie_lw">Kopie LW</Label>
                    <Select
                      value={editingCustomer.kopie_lw || ''}
                      onValueChange={(value) => setEditingCustomer({
                        ...editingCustomer,
                        kopie_lw: value
                      })}
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

      {/* Edit Employee Dialog */}
      <Dialog open={isEmployeeDialogOpen} onOpenChange={setIsEmployeeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mitarbeiterdaten bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie die Informationen für {editingEmployee?.vorname} {editingEmployee?.nachname}
            </DialogDescription>
          </DialogHeader>
          
          {editingEmployee && (
            <form onSubmit={handleSaveEmployee} className="space-y-6">
              {/* Persönliche Daten */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Persönliche Daten</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vorname">Vorname</Label>
                    <Input
                      id="vorname"
                      value={editingEmployee.vorname || ''}
                      onChange={(e) => setEditingEmployee({
                        ...editingEmployee,
                        vorname: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="nachname">Nachname</Label>
                    <Input
                      id="nachname"
                      value={editingEmployee.nachname || ''}
                      onChange={(e) => setEditingEmployee({
                        ...editingEmployee,
                        nachname: e.target.value
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
                    <Label htmlFor="emp_telefon">Telefon</Label>
                    <Input
                      id="emp_telefon"
                      value={editingEmployee.telefon || ''}
                      onChange={(e) => setEditingEmployee({
                        ...editingEmployee,
                        telefon: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="farbe_kalender">Kalenderfarbe</Label>
                    <Input
                      id="farbe_kalender"
                      type="color"
                      value={editingEmployee.farbe_kalender || '#3B82F6'}
                      onChange={(e) => setEditingEmployee({
                        ...editingEmployee,
                        farbe_kalender: e.target.value
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Status und Arbeitszeit */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold">Status und Arbeitszeit</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ist_aktiv">Status</Label>
                    <Select
                      value={editingEmployee.ist_aktiv ? 'true' : 'false'}
                      onValueChange={(value) => setEditingEmployee({
                        ...editingEmployee,
                        ist_aktiv: value === 'true'
                      })}
                    >
                      <SelectTrigger id="ist_aktiv">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Aktiv</SelectItem>
                        <SelectItem value="false">Nicht aktiv</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="soll_wochenstunden">Soll-Wochenstunden</Label>
                    <Input
                      id="soll_wochenstunden"
                      type="number"
                      step="0.5"
                      value={editingEmployee.soll_wochenstunden || ''}
                      onChange={(e) => setEditingEmployee({
                        ...editingEmployee,
                        soll_wochenstunden: e.target.value ? parseFloat(e.target.value) : null
                      })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="max_termine_pro_tag">Max. Termine pro Tag</Label>
                  <Input
                    id="max_termine_pro_tag"
                    type="number"
                    value={editingEmployee.max_termine_pro_tag || ''}
                    onChange={(e) => setEditingEmployee({
                      ...editingEmployee,
                      max_termine_pro_tag: e.target.value ? parseInt(e.target.value) : null
                    })}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEmployeeDialogOpen(false)}
                >
                  Abbrechen
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateEmployeeMutation.isPending}
                >
                  {updateEmployeeMutation.isPending ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteCustomerId !== null} onOpenChange={(open) => !open && setDeleteCustomerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kunde wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Der Kunde und alle zugehörigen Daten 
              (Termine, Zeitfenster, Dokumente) werden permanent gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCustomerId && deleteCustomerMutation.mutate(deleteCustomerId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCustomerMutation.isPending ? 'Löschen...' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}