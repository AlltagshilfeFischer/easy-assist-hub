import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, Plus, Upload } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
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
import CreateCustomerWizard from '@/components/customers/CreateCustomerWizard';
import { KundenSmartImport } from '@/components/import/KundenSmartImport';
import { CustomerFilters } from '@/components/customers/CustomerFilters';
import { CustomerTable } from '@/components/customers/CustomerTable';
import { CustomerEditDialog } from '@/components/customers/CustomerEditDialog';
import { useCustomerFilters } from '@/hooks/useCustomerFilters';
import { useCustomerMutations } from '@/hooks/useCustomerMutations';

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const monthToDate = (monthString: string | null) => {
  if (!monthString) return null;
  return `${monthString}-01`;
};

export default function MasterData() {
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [showSmartImport, setShowSmartImport] = useState(false);
  const queryClient = useQueryClient();

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kunden')
        .select(`*, hauptbetreuer:mitarbeiter!mitarbeiter(id, vorname, nachname)`)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase.from('mitarbeiter').select('*');
      if (error) throw error;
      return data;
    },
  });

  const filters = useCustomerFilters(customers);
  const { updateCustomerMutation, convertToCustomerMutation, toggleCustomerStatusMutation, deleteCustomerMutation } = useCustomerMutations();

  const handleEditCustomer = async (customer: any) => {
    const { data: zeitfensterData } = await supabase
      .from('kunden_zeitfenster')
      .select('*')
      .eq('kunden_id', customer.id)
      .order('wochentag');

    setEditingCustomer({
      ...customer,
      eintritt: customer.eintritt || getCurrentMonth(),
      zeitfenster: zeitfensterData || [],
    });
    setIsDialogOpen(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      const customerData = {
        ...editingCustomer,
        eintritt: monthToDate(editingCustomer.eintritt),
        austritt: monthToDate(editingCustomer.austritt),
      };
      updateCustomerMutation.mutate(customerData, {
        onSuccess: () => {
          setIsDialogOpen(false);
          setEditingCustomer(null);
        },
      });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Kunden/Neukunden</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Verwalten Sie Kundendaten und Neukundenkontakte</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Button variant="outline" onClick={() => setShowSmartImport(true)} className="gap-2">
            <Upload className="h-4 w-4" />Importieren
          </Button>
          <Button onClick={() => setIsCreatingCustomer(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Neuen Kunden anlegen</span>
            <span className="sm:hidden">Neu</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Building className="h-4 w-4 sm:h-5 sm:w-5" />Kundenverwaltung
          </CardTitle>
          <CardDescription className="text-sm">Bearbeiten Sie alle Kundendaten direkt in der Tabelle</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <CustomerFilters
            customers={customers}
            searchQuery={filters.searchQuery} setSearchQuery={filters.setSearchQuery}
            customerStatusFilter={filters.customerStatusFilter} setCustomerStatusFilter={filters.setCustomerStatusFilter}
            customerKategorieFilter={filters.customerKategorieFilter} setCustomerKategorieFilter={filters.setCustomerKategorieFilter}
            stadtteilFilter={filters.stadtteilFilter} setStadtteilFilter={filters.setStadtteilFilter}
            eintrittsdatumFilter={filters.eintrittsdatumFilter} setEintrittsdatumFilter={filters.setEintrittsdatumFilter}
            dateFromFilter={filters.dateFromFilter} setDateFromFilter={filters.setDateFromFilter}
            dateToFilter={filters.dateToFilter} setDateToFilter={filters.setDateToFilter}
          />

          {customersLoading ? (
            <div className="text-center py-4">Lade Kundendaten...</div>
          ) : filters.sortedCustomers.length > 0 ? (
            <CustomerTable
              customers={filters.sortedCustomers}
              customerSort={filters.customerSort}
              onSort={filters.handleSort}
              onEdit={handleEditCustomer}
              onToggleStatus={(p) => toggleCustomerStatusMutation.mutate(p)}
              onDelete={(id) => setDeleteCustomerId(id)}
              onConvert={(id) => convertToCustomerMutation.mutate(id)}
              togglePending={toggleCustomerStatusMutation.isPending}
              convertPending={convertToCustomerMutation.isPending}
              nameFilter={filters.nameFilter} setNameFilter={filters.setNameFilter}
              telefonFilter={filters.telefonFilter} setTelefonFilter={filters.setTelefonFilter}
              emailFilter={filters.emailFilter} setEmailFilter={filters.setEmailFilter}
              pflegegradFilter={filters.pflegegradFilter} setPflegegradFilter={filters.setPflegegradFilter}
              strasseFilter={filters.strasseFilter} setStrasseFilter={filters.setStrasseFilter}
              plzFilter={filters.plzFilter} setPlzFilter={filters.setPlzFilter}
              stadtFilter={filters.stadtFilter} setStadtFilter={filters.setStadtFilter}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">Keine Kunden gefunden</div>
          )}
        </CardContent>
      </Card>

      <CustomerEditDialog
        open={isDialogOpen}
        onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingCustomer(null); }}
        editingCustomer={editingCustomer}
        setEditingCustomer={setEditingCustomer}
        employees={employees}
        onSave={handleSaveCustomer}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteCustomerId} onOpenChange={() => setDeleteCustomerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kunde löschen?</AlertDialogTitle>
            <AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht werden. Alle zugehörigen Termine und Dokumente werden ebenfalls gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteCustomerId) { deleteCustomerMutation.mutate(deleteCustomerId); setDeleteCustomerId(null); } }}>
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateCustomerWizard open={isCreatingCustomer} onOpenChange={setIsCreatingCustomer} employees={employees || []} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['customers'] })} />
      <KundenSmartImport open={showSmartImport} onOpenChange={setShowSmartImport} />
    </div>
  );
}
