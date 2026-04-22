import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, FileSpreadsheet, FileText, Plus, Trash2 } from 'lucide-react';
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
import { CsvImportWizard } from '@/components/customers/csv-import/CsvImportWizard';
import { CustomerImportExport } from '@/components/customers/CustomerImportExport';
import { CustomerFilters } from '@/components/customers/CustomerFilters';
import { CustomerTable } from '@/components/customers/CustomerTable';
import { CustomerEditDialog } from '@/components/customers/CustomerEditDialog';
import { KundenDetailDialog } from '@/components/customers/KundenDetailDialog';
import { useCustomerFilters } from '@/hooks/useCustomerFilters';
import { useCustomerMutations } from '@/hooks/useCustomerMutations';

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const monthToDate = (monthString: string | null) => {
  if (!monthString) return null;
  // Handle both "YYYY-MM" (from month input) and "YYYY-MM-DD" (already full date in DB)
  return `${monthString.substring(0, 7)}-01`;
};

export default function MasterData() {
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [showSmartImport, setShowSmartImport] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [detailKundenId, setDetailKundenId] = useState<string | null>(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
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
  const { updateCustomerMutation, convertToCustomerMutation, toggleCustomerStatusMutation, deleteCustomerMutation, bulkDeleteCustomersMutation } = useCustomerMutations();

  const handleToggleSelection = (id: string) => {
    setSelectedCustomerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = () => {
    const visibleIds = filters.sortedCustomers.map((c: any) => c.id);
    const allSelected = visibleIds.every((id: string) => selectedCustomerIds.has(id));
    if (allSelected) {
      setSelectedCustomerIds(prev => {
        const next = new Set(prev);
        visibleIds.forEach((id: string) => next.delete(id));
        return next;
      });
    } else {
      setSelectedCustomerIds(prev => {
        const next = new Set(prev);
        visibleIds.forEach((id: string) => next.add(id));
        return next;
      });
    }
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedCustomerIds);
    bulkDeleteCustomersMutation.mutate(ids, {
      onSuccess: () => {
        setSelectedCustomerIds(new Set());
        setShowBulkDeleteDialog(false);
      },
    });
  };

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

  const handleSaveCustomer = (e: React.FormEvent, overrides?: Partial<any>) => {
    e.preventDefault();
    if (editingCustomer) {
      const merged = overrides ? { ...editingCustomer, ...overrides } : editingCustomer;
      const customerData = {
        ...merged,
        eintritt: monthToDate(merged.eintritt),
        austritt: monthToDate(merged.austritt),
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
          <Button variant="outline" className="gap-2" onClick={() => setShowSmartImport(true)}>
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">KI-Import</span>
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setShowCsvImport(true)}>
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">CSV / Excel importieren</span>
            <span className="sm:hidden">Import</span>
          </Button>
          <CustomerImportExport customers={customers ?? []} />
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
            resetAllFilters={filters.resetAllFilters}
            hasActiveFilters={filters.hasActiveFilters}
            searchQuery={filters.searchQuery} setSearchQuery={filters.setSearchQuery}
            customerStatusFilter={filters.customerStatusFilter} setCustomerStatusFilter={filters.setCustomerStatusFilter}
            customerKategorieFilter={filters.customerKategorieFilter} setCustomerKategorieFilter={filters.setCustomerKategorieFilter}
            stadtteilFilter={filters.stadtteilFilter} setStadtteilFilter={filters.setStadtteilFilter}
            eintrittsdatumFilter={filters.eintrittsdatumFilter} setEintrittsdatumFilter={filters.setEintrittsdatumFilter}
            dateFromFilter={filters.dateFromFilter} setDateFromFilter={filters.setDateFromFilter}
            dateToFilter={filters.dateToFilter} setDateToFilter={filters.setDateToFilter}
          />

          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              {filters.sortedCustomers.length} von {customers?.length ?? 0} Kunden angezeigt
              {selectedCustomerIds.size > 0 && (
                <span className="ml-2 font-medium text-foreground">· {selectedCustomerIds.size} ausgewählt</span>
              )}
            </p>
            {selectedCustomerIds.size > 0 && (
              <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteDialog(true)} className="gap-2">
                <Trash2 className="h-4 w-4" />
                {selectedCustomerIds.size} Kunden löschen
              </Button>
            )}
          </div>

          {customersLoading ? (
            <div className="text-center py-4">Lade Kundendaten...</div>
          ) : (
            <CustomerTable
              customers={filters.sortedCustomers}
              customerSort={filters.customerSort}
              onSort={filters.handleSort}
              onEdit={handleEditCustomer}
              onToggleStatus={(p) => toggleCustomerStatusMutation.mutate(p)}
              onDelete={(id) => setDeleteCustomerId(id)}
              onConvert={(id) => convertToCustomerMutation.mutate(id)}
              onViewDetail={(id) => setDetailKundenId(id)}
              togglePending={toggleCustomerStatusMutation.isPending}
              convertPending={convertToCustomerMutation.isPending}
              selectedIds={selectedCustomerIds}
              onToggleSelection={handleToggleSelection}
              onToggleAll={handleToggleAll}
              nameFilter={filters.nameFilter} setNameFilter={filters.setNameFilter}
              telefonFilter={filters.telefonFilter} setTelefonFilter={filters.setTelefonFilter}
              emailFilter={filters.emailFilter} setEmailFilter={filters.setEmailFilter}
              pflegegradFilter={filters.pflegegradFilter} setPflegegradFilter={filters.setPflegegradFilter}
              pflegekasseFilter={filters.pflegekasseFilter} setPflegekasseFilter={filters.setPflegekasseFilter}
              strasseFilter={filters.strasseFilter} setStrasseFilter={filters.setStrasseFilter}
              plzFilter={filters.plzFilter} setPlzFilter={filters.setPlzFilter}
              stadtFilter={filters.stadtFilter} setStadtFilter={filters.setStadtFilter}
            />
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

      {/* Bulk-Delete Confirmation */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedCustomerIds.size} Kunden löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Alle zugehörigen Termine und Dokumente der ausgewählten {selectedCustomerIds.size} Kunden werden ebenfalls gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleteCustomersMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteCustomersMutation.isPending ? 'Wird gelöscht...' : `${selectedCustomerIds.size} Kunden endgültig löschen`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateCustomerWizard open={isCreatingCustomer} onOpenChange={setIsCreatingCustomer} employees={employees || []} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['customers'] })} />
      <KundenSmartImport open={showSmartImport} onOpenChange={setShowSmartImport} />
      <CsvImportWizard open={showCsvImport} onOpenChange={setShowCsvImport} />
      <KundenDetailDialog isOpen={!!detailKundenId} onClose={() => setDetailKundenId(null)} kundenId={detailKundenId} />
    </div>
  );
}
