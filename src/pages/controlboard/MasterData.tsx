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
import { Checkbox } from '@/components/ui/checkbox';
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
import { Users, Building, Edit, Phone, Mail, ArrowUpDown, ChevronUp, ChevronDown, Plus, Trash2, Search, Power, Sparkles } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import AITimeWindowsCreator from '@/components/schedule/AITimeWindowsCreator';
import CreateCustomerWizard from '@/components/customers/CreateCustomerWizard';

type SortKey = 'name' | 'status' | 'telefon' | 'email' | 'created_at' | 'pflegegrad' | 'strasse' | 'geburtsdatum' | 'eintritt';
type SortDirection = 'asc' | 'desc';

export default function MasterData() {
  const [editingCustomer, setEditingCustomer] = useState<{
    id: string;
    name: string | null;
    vorname: string | null;
    nachname: string | null;
    geburtsdatum: string | null;
    kategorie: string | null;
    strasse: string | null;
    stadt: string | null;
    plz: string | null;
    stadtteil: string | null;
    telefonnr: string | null;
    email: string | null;
    pflegekasse: string | null;
    versichertennummer: string | null;
    pflegegrad: number | null;
    kasse_privat: string | null;
    kopie_lw: string | null;
    verhinderungspflege_status: string | null;
    eintritt: string | null;
    austritt: string | null;
    begruendung: string | null;
    aktiv: boolean;
    status: string | null;
    angehoerige_ansprechpartner: string | null;
    sonstiges: string | null;
    notfall_name: string | null;
    notfall_telefon: string | null;
    sollstunden: number | null;
    startdatum: string | null;
    stunden_kontingent_monat: number | null;
    tage: string | null;
    mitarbeiter: string | null;
    zeitfenster?: any[];
  } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [customerSort, setCustomerSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'created_at', direction: 'desc' });
  const [searchQuery, setSearchQuery] = useState('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [customerKategorieFilter, setCustomerKategorieFilter] = useState<'all' | 'Kunde' | 'Interessent'>('all');
  const [dateFromFilter, setDateFromFilter] = useState<string>('');
  const [dateToFilter, setDateToFilter] = useState<string>('');
  const [stadtteilFilter, setStadtteilFilter] = useState<string>('all');
  const [eintrittsdatumFilter, setEintrittsdatumFilter] = useState<string>('all');
  const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);
  const [showAITimeWindows, setShowAITimeWindows] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  
  // Column filters
  const [nameFilter, setNameFilter] = useState<string>('');
  const [telefonFilter, setTelefonFilter] = useState<string>('');
  const [emailFilter, setEmailFilter] = useState<string>('');
  const [pflegegradFilter, setPflegegradFilter] = useState<string>('');
  const [strasseFilter, setStrasseFilter] = useState<string>('');
  const [plzFilter, setPlzFilter] = useState<string>('');
  const [stadtFilter, setStadtFilter] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data: mitData, error: mitError } = await (supabase as any)
        .from('mitarbeiter')
        .select('*');
      if (mitError) throw mitError;
      return mitData;
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

      // Update zeitfenster if provided
      if (zeitfenster && Array.isArray(zeitfenster)) {
        // Delete existing time windows
        await (supabase as any)
          .from('kunden_zeitfenster')
          .delete()
          .eq('kunden_id', kundenData.id);

        // Insert new time windows
        if (zeitfenster.length > 0) {
          const windowsToInsert = zeitfenster.map((w: any) => ({
            kunden_id: kundenData.id,
            wochentag: w.wochentag,
            von: w.von,
            bis: w.bis
          }));

          const { error: zeitfensterError } = await (supabase as any)
            .from('kunden_zeitfenster')
            .insert(windowsToInsert);

          if (zeitfensterError) throw zeitfensterError;
        }
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
      await (supabase as any).from('kunden_zeitfenster').delete().eq('kunden_id', kundenId);
      
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

  const handleOpenCreateDialog = () => {
    setIsCreatingCustomer(true);
  };

  const handleWizardSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['customers'] });
  };


  const handleEditCustomer = async (customer: any) => {
    // Fetch time windows for this customer
    const { data: zeitfensterData } = await (supabase as any)
      .from('kunden_zeitfenster')
      .select('*')
      .eq('kunden_id', customer.id)
      .order('wochentag');

    setEditingCustomer({
      ...customer,
      eintritt: customer.eintritt || getCurrentMonth(),
      zeitfenster: zeitfensterData || []
    });
    setIsDialogOpen(true);
    setShowAITimeWindows(false);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      const customerData = {
        ...editingCustomer,
        eintritt: monthToDate(editingCustomer.eintritt),
        austritt: monthToDate(editingCustomer.austritt),
      };
      updateCustomerMutation.mutate(customerData);
    }
  };


  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const formatMonthYear = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit' });
  };

  const getCurrentMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const dateToMonth = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const monthToDate = (monthString: string) => {
    if (!monthString) return null;
    return `${monthString}-01`;
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

  const handleSort = (key: SortKey) => {
    setCustomerSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
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
          customer.vorname,
          customer.nachname,
          customer.telefonnr,
          customer.email,
          customer.strasse,
          customer.stadt,
          customer.plz,
          customer.stadtteil,
          customer.pflegekasse,
        ].filter(Boolean).map(f => f.toLowerCase());
        
        return searchableFields.some(field => field.includes(query));
      });
    }
    
    // Column filters
    if (nameFilter.trim()) {
      const query = nameFilter.toLowerCase();
      filtered = filtered.filter((customer: any) => {
        const fullName = `${customer.vorname || ''} ${customer.nachname || ''}`.toLowerCase();
        return fullName.includes(query);
      });
    }
    
    if (telefonFilter.trim()) {
      const query = telefonFilter.toLowerCase();
      filtered = filtered.filter((customer: any) => 
        customer.telefonnr?.toLowerCase().includes(query)
      );
    }
    
    if (emailFilter.trim()) {
      const query = emailFilter.toLowerCase();
      filtered = filtered.filter((customer: any) => 
        customer.email?.toLowerCase().includes(query)
      );
    }
    
    if (pflegegradFilter.trim()) {
      filtered = filtered.filter((customer: any) => 
        customer.pflegegrad?.toString().includes(pflegegradFilter)
      );
    }
    
    if (strasseFilter.trim()) {
      const query = strasseFilter.toLowerCase();
      filtered = filtered.filter((customer: any) => 
        customer.strasse?.toLowerCase().includes(query)
      );
    }
    
    if (plzFilter.trim()) {
      const query = plzFilter.toLowerCase();
      filtered = filtered.filter((customer: any) => 
        customer.plz?.toLowerCase().includes(query)
      );
    }
    
    if (stadtFilter.trim()) {
      const query = stadtFilter.toLowerCase();
      filtered = filtered.filter((customer: any) => 
        customer.stadt?.toLowerCase().includes(query)
      );
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
    
    // Filter by stadtteil
    if (stadtteilFilter !== 'all' && stadtteilFilter) {
      filtered = filtered.filter((customer: any) => customer.stadtteil === stadtteilFilter);
    }
    
    // Filter by eintrittsdatum
    if (eintrittsdatumFilter !== 'all' && eintrittsdatumFilter) {
      const now = new Date();
      const filterDate = new Date();
      
      switch (eintrittsdatumFilter) {
        case 'last_month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case 'last_3_months':
          filterDate.setMonth(now.getMonth() - 3);
          break;
        case 'last_6_months':
          filterDate.setMonth(now.getMonth() - 6);
          break;
        case 'last_year':
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
        case 'this_year':
          filterDate.setMonth(0);
          filterDate.setDate(1);
          break;
      }
      
      filtered = filtered.filter((customer: any) => {
        if (!customer.eintritt) return false;
        const eintritt = new Date(customer.eintritt);
        return eintritt >= filterDate;
      });
    }
    
    // Filter by date range (created_at)
    if (dateFromFilter || dateToFilter) {
      filtered = filtered.filter((customer: any) => {
        const createdAt = customer.created_at ? new Date(customer.created_at) : null;
        if (!createdAt) return false;
        
        const matchesFrom = !dateFromFilter || createdAt >= new Date(dateFromFilter);
        const matchesTo = !dateToFilter || createdAt <= new Date(dateToFilter + 'T23:59:59');
        
        return matchesFrom && matchesTo;
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
        case 'pflegegrad':
          aValue = a.pflegegrad || 0;
          bValue = b.pflegegrad || 0;
          break;
        case 'strasse':
          aValue = (a.strasse || '').toLowerCase();
          bValue = (b.strasse || '').toLowerCase();
          break;
        case 'geburtsdatum':
          aValue = new Date(a.geburtsdatum || 0).getTime();
          bValue = new Date(b.geburtsdatum || 0).getTime();
          break;
        case 'eintritt':
          aValue = new Date(a.eintritt || 0).getTime();
          bValue = new Date(b.eintritt || 0).getTime();
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
  }, [customers, customerSort, searchQuery, customerStatusFilter, customerKategorieFilter, stadtteilFilter, eintrittsdatumFilter, dateFromFilter, dateToFilter, nameFilter, telefonFilter, emailFilter, pflegegradFilter, strasseFilter, plzFilter, stadtFilter]);


  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Kunden/Neukunden</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Verwalten Sie Kundendaten und Neukundenkontakte
          </p>
        </div>
        <Button onClick={handleOpenCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Neuen Kunden anlegen</span>
          <span className="sm:hidden">Neu</span>
        </Button>
      </div>

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
                  <Select value={stadtteilFilter} onValueChange={setStadtteilFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Stadtteil" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Stadtteile</SelectItem>
                      {Array.from(new Set(customers?.map((c: any) => c.stadtteil).filter(Boolean))).sort().map((stadtteil: any) => (
                        <SelectItem key={stadtteil} value={stadtteil}>
                          {stadtteil}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={eintrittsdatumFilter} onValueChange={setEintrittsdatumFilter}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Eintrittsdatum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Eintrittsdaten</SelectItem>
                      <SelectItem value="last_month">Letzter Monat</SelectItem>
                      <SelectItem value="last_3_months">Letzte 3 Monate</SelectItem>
                      <SelectItem value="last_6_months">Letzte 6 Monate</SelectItem>
                      <SelectItem value="this_year">Dieses Jahr</SelectItem>
                      <SelectItem value="last_year">Letztes Jahr+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Date Range Filter */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start sm:items-center">
                  <Label className="text-sm font-medium whitespace-nowrap">Hinzugefügt:</Label>
                  <div className="flex gap-2 items-center">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">Von:</Label>
                    <Input
                      type="date"
                      value={dateFromFilter}
                      onChange={(e) => setDateFromFilter(e.target.value)}
                      className="w-[160px]"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">Bis:</Label>
                    <Input
                      type="date"
                      value={dateToFilter}
                      onChange={(e) => setDateToFilter(e.target.value)}
                      className="w-[160px]"
                    />
                  </div>
                  {(dateFromFilter || dateToFilter) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDateFromFilter('');
                        setDateToFilter('');
                      }}
                    >
                      Zurücksetzen
                    </Button>
                  )}
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
                              onClick={(key) => handleSort(key)}
                            >
                              Name
                            </SortButton>
                          </TableHead>
                           <TableHead>
                             <SortButton 
                               sortKey="status" 
                               currentSort={customerSort} 
                               onClick={(key) => handleSort(key)}
                             >
                               Status
                             </SortButton>
                           </TableHead>
                           <TableHead>Kategorie</TableHead>
                           <TableHead>
                             <SortButton 
                               sortKey="telefon" 
                               currentSort={customerSort} 
                               onClick={(key) => handleSort(key)}
                             >
                               Telefon
                             </SortButton>
                           </TableHead>
                          <TableHead>
                            <SortButton 
                              sortKey="email" 
                              currentSort={customerSort} 
                              onClick={(key) => handleSort(key)}
                            >
                              E-Mail
                            </SortButton>
                          </TableHead>
                           <TableHead>
                             <SortButton 
                               sortKey="pflegegrad" 
                               currentSort={customerSort} 
                               onClick={(key) => handleSort(key)}
                             >
                               Pflegegrad
                             </SortButton>
                           </TableHead>
                            <TableHead>PLZ</TableHead>
                            <TableHead>Stadt</TableHead>
                            <TableHead>
                              <SortButton 
                                sortKey="strasse" 
                                currentSort={customerSort} 
                                onClick={(key) => handleSort(key)}
                              >
                                Straße
                              </SortButton>
                            </TableHead>
                           <TableHead>
                             <SortButton 
                               sortKey="geburtsdatum" 
                               currentSort={customerSort} 
                               onClick={(key) => handleSort(key)}
                             >
                               Geburtsdatum
                             </SortButton>
                           </TableHead>
                           <TableHead>
                             <SortButton 
                               sortKey="created_at" 
                               currentSort={customerSort} 
                               onClick={(key) => handleSort(key)}
                             >
                               Hinzugefügt
                             </SortButton>
                           </TableHead>
                          <TableHead>Aktionen</TableHead>
                       </TableRow>
                       <TableRow>
                         <TableHead>
                           <Input
                             placeholder="Name filtern..."
                             value={nameFilter}
                             onChange={(e) => setNameFilter(e.target.value)}
                             className="h-8 text-xs"
                           />
                         </TableHead>
                         <TableHead></TableHead>
                         <TableHead></TableHead>
                         <TableHead>
                           <Input
                             placeholder="Telefon filtern..."
                             value={telefonFilter}
                             onChange={(e) => setTelefonFilter(e.target.value)}
                             className="h-8 text-xs"
                           />
                         </TableHead>
                         <TableHead>
                           <Input
                             placeholder="E-Mail filtern..."
                             value={emailFilter}
                             onChange={(e) => setEmailFilter(e.target.value)}
                             className="h-8 text-xs"
                           />
                         </TableHead>
                         <TableHead>
                           <Input
                             placeholder="Pflegegrad..."
                             value={pflegegradFilter}
                             onChange={(e) => setPflegegradFilter(e.target.value)}
                             className="h-8 text-xs w-20"
                           />
                         </TableHead>
                         <TableHead>
                           <Input
                             placeholder="PLZ..."
                             value={plzFilter}
                             onChange={(e) => setPlzFilter(e.target.value)}
                             className="h-8 text-xs w-24"
                           />
                         </TableHead>
                         <TableHead>
                           <Input
                             placeholder="Stadt..."
                             value={stadtFilter}
                             onChange={(e) => setStadtFilter(e.target.value)}
                             className="h-8 text-xs"
                           />
                         </TableHead>
                         <TableHead>
                           <Input
                             placeholder="Straße..."
                             value={strasseFilter}
                             onChange={(e) => setStrasseFilter(e.target.value)}
                             className="h-8 text-xs"
                           />
                         </TableHead>
                         <TableHead></TableHead>
                         <TableHead></TableHead>
                         <TableHead></TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {sortedCustomers.map((customer: any) => (
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
                              {customer.plz || '-'}
                            </TableCell>
                            <TableCell>
                              {customer.stadt || '-'}
                            </TableCell>
                             <TableCell>
                               {customer.strasse || '-'}
                             </TableCell>
                           <TableCell>
                             {formatDate(customer.geburtsdatum)}
                           </TableCell>
                           <TableCell>
                             {customer.created_at 
                               ? new Date(customer.created_at).toLocaleDateString('de-DE', {
                                   day: '2-digit',
                                   month: '2-digit',
                                   year: 'numeric'
                                 })
                               : '-'}
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

      {/* Edit Customer Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
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
                      <Label htmlFor="vorname">Vorname</Label>
                      <Input
                        id="vorname"
                        value={editingCustomer.vorname || ''}
                        onChange={(e) => setEditingCustomer({
                          ...editingCustomer,
                          vorname: e.target.value
                        })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="nachname">Nachname</Label>
                      <Input
                        id="nachname"
                        value={editingCustomer.nachname || ''}
                        onChange={(e) => setEditingCustomer({
                          ...editingCustomer,
                          nachname: e.target.value
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
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="edit-strasse">Straße</Label>
                    <Input
                      id="edit-strasse"
                      value={editingCustomer.strasse || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        strasse: e.target.value
                      })}
                      placeholder="Straße und Hausnummer"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-plz">PLZ</Label>
                    <Input
                      id="edit-plz"
                      value={editingCustomer.plz || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        plz: e.target.value
                      })}
                      placeholder="PLZ"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-stadt">Stadt</Label>
                    <Input
                      id="edit-stadt"
                      value={editingCustomer.stadt || ''}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        stadt: e.target.value
                      })}
                      placeholder="Stadt"
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
                        stunden_kontingent_monat: e.target.value ? parseFloat(e.target.value) : null
                      })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                        <SelectItem value="Verordnung">Verordnung</SelectItem>
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
                    <Label htmlFor="eintritt">Eintrittsmonat</Label>
                    <Input
                      id="eintritt"
                      type="month"
                      value={dateToMonth(editingCustomer.eintritt) || getCurrentMonth()}
                      onChange={(e) => setEditingCustomer({
                        ...editingCustomer,
                        eintritt: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="austritt">Austrittsmonat</Label>
                    <Input
                      id="austritt"
                      type="month"
                      value={dateToMonth(editingCustomer.austritt) || ''}
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
                        const zeitfenster = editingCustomer.zeitfenster || [];
                        setEditingCustomer({
                          ...editingCustomer,
                          zeitfenster: [...zeitfenster, {
                            wochentag: 1,
                            von: '08:00',
                            bis: '12:00'
                          }]
                        });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Manuell hinzufügen
                    </Button>
                  </div>
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

      {/* AI Time Windows Dialog for Editing */}
      <Dialog open={showAITimeWindows && editingCustomer !== null} onOpenChange={setShowAITimeWindows}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>KI-Zeitfenster generieren</DialogTitle>
            <DialogDescription>
              Beschreiben Sie die gewünschten Zeitfenster in natürlicher Sprache
            </DialogDescription>
          </DialogHeader>
          {editingCustomer && (
            <AITimeWindowsCreator
              onConfirm={(windows) => {
                setEditingCustomer({
                  ...editingCustomer,
                  zeitfenster: windows
                });
                setShowAITimeWindows(false);
                toast({
                  title: 'Zeitfenster generiert',
                  description: 'Die KI hat Zeitfenster erstellt. Bitte überprüfen Sie diese und speichern Sie dann.',
                });
              }}
              onCancel={() => setShowAITimeWindows(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Customer Wizard */}
      <CreateCustomerWizard
        open={isCreatingCustomer}
        onOpenChange={setIsCreatingCustomer}
        employees={employees || []}
        onSuccess={handleWizardSuccess}
      />
    </div>
  );
}