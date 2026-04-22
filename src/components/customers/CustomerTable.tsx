import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Edit, ArrowUpDown, ChevronUp, ChevronDown, Power, Trash2, Eye } from 'lucide-react';
import type { SortKey, SortDirection } from '@/hooks/useCustomerFilters';

interface CustomerTableProps {
  customers: any[];
  customerSort: { key: SortKey; direction: SortDirection };
  onSort: (key: SortKey) => void;
  onEdit: (customer: any) => void;
  onToggleStatus: (params: { kundenId: string; currentStatus: boolean }) => void;
  onDelete: (id: string) => void;
  onConvert: (id: string) => void;
  onViewDetail?: (customerId: string) => void;
  togglePending: boolean;
  convertPending: boolean;
  // Selection
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onToggleAll: () => void;
  // Column filters
  nameFilter: string; setNameFilter: (v: string) => void;
  telefonFilter: string; setTelefonFilter: (v: string) => void;
  emailFilter: string; setEmailFilter: (v: string) => void;
  pflegegradFilter: string; setPflegegradFilter: (v: string) => void;
  pflegekasseFilter: string; setPflegekasseFilter: (v: string) => void;
  strasseFilter: string; setStrasseFilter: (v: string) => void;
  plzFilter: string; setPlzFilter: (v: string) => void;
  stadtFilter: string; setStadtFilter: (v: string) => void;
}

function SortButton({ sortKey, currentSort, onClick, children }: {
  sortKey: SortKey;
  currentSort: { key: SortKey; direction: SortDirection };
  onClick: (key: SortKey) => void;
  children: React.ReactNode;
}) {
  const isActive = currentSort.key === sortKey;
  return (
    <Button variant="ghost" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => onClick(sortKey)}>
      <div className="flex items-center gap-1">
        {children}
        {isActive ? (
          currentSort.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </div>
    </Button>
  );
}

const formatDate = (val: string | null | undefined): string => {
  if (!val) return '-';
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(val)) return val;
  const d = new Date(val.length === 7 ? val + '-01' : val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const buildAddress = (c: any): string => {
  const parts = [c.strasse || c.adresse, c.plz, c.stadt, c.stadtteil].filter(Boolean);
  return parts.join(', ') || '-';
};

export function CustomerTable({
  customers,
  customerSort,
  onSort,
  onEdit,
  onToggleStatus,
  onDelete,
  onConvert,
  onViewDetail,
  togglePending,
  convertPending,
  selectedIds,
  onToggleSelection,
  onToggleAll,
  nameFilter, setNameFilter,
  telefonFilter, setTelefonFilter,
  pflegegradFilter, setPflegegradFilter,
  pflegekasseFilter, setPflegekasseFilter,
  emailFilter: _emailFilter, setEmailFilter: _setEmailFilter,
  strasseFilter: _strasseFilter, setStrasseFilter: _setStrasseFilter,
  plzFilter: _plzFilter, setPlzFilter: _setPlzFilter,
  stadtFilter: _stadtFilter, setStadtFilter: _setStadtFilter,
}: CustomerTableProps) {
  const allSelected = customers.length > 0 && customers.every((c: any) => selectedIds.has(c.id));
  const someSelected = !allSelected && customers.some((c: any) => selectedIds.has(c.id));

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-[880px] text-xs [&_th]:px-1.5 [&_th]:py-1.5 [&_td]:px-1.5 [&_td]:py-1">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[28px]">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={onToggleAll}
                aria-label="Alle auswählen"
              />
            </TableHead>
            <TableHead className="w-[85px]"><SortButton sortKey="nachname" currentSort={customerSort} onClick={onSort}>Nachname</SortButton></TableHead>
            <TableHead className="w-[70px]"><SortButton sortKey="vorname" currentSort={customerSort} onClick={onSort}>Vorname</SortButton></TableHead>
            <TableHead className="w-[36px]"><SortButton sortKey="pflegegrad" currentSort={customerSort} onClick={onSort}>PG</SortButton></TableHead>
            <TableHead className="w-[130px]"><SortButton sortKey="strasse" currentSort={customerSort} onClick={onSort}>Adresse</SortButton></TableHead>
            <TableHead className="w-[95px]"><SortButton sortKey="telefon" currentSort={customerSort} onClick={onSort}>Telefon</SortButton></TableHead>
            <TableHead className="w-[70px]"><SortButton sortKey="geburtsdatum" currentSort={customerSort} onClick={onSort}>Geb.</SortButton></TableHead>
            <TableHead className="w-[130px]">Pflegekasse / Vers.Nr.</TableHead>
            <TableHead className="w-[45px]">K/P</TableHead>
            <TableHead className="w-[45px]">h/Mon</TableHead>
            <TableHead className="w-[130px]"><SortButton sortKey="eintritt" currentSort={customerSort} onClick={onSort}>Ein- / Austritt</SortButton></TableHead>
            <TableHead className="w-[55px]">Status</TableHead>
            <TableHead className="w-[100px]">Aktionen</TableHead>
          </TableRow>
          {/* Spaltenfilter-Zeile */}
          <TableRow>
            <TableHead></TableHead>
            <TableHead colSpan={2}><Input placeholder="Name..." value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} className="h-6 text-xs" /></TableHead>
            <TableHead><Input placeholder="PG" value={pflegegradFilter} onChange={(e) => setPflegegradFilter(e.target.value)} className="h-6 text-xs w-9" /></TableHead>
            <TableHead></TableHead>
            <TableHead><Input placeholder="Telefon..." value={telefonFilter} onChange={(e) => setTelefonFilter(e.target.value)} className="h-6 text-xs" /></TableHead>
            <TableHead></TableHead>
            <TableHead><Input placeholder="Kasse..." value={pflegekasseFilter} onChange={(e) => setPflegekasseFilter(e.target.value)} className="h-6 text-xs" /></TableHead>
            <TableHead></TableHead>
            <TableHead></TableHead>
            <TableHead></TableHead>
            <TableHead></TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.length === 0 && (
            <TableRow>
              <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                Keine Kunden gefunden
              </TableCell>
            </TableRow>
          )}
          {customers.map((customer: any) => (
            <TableRow key={customer.id} data-state={selectedIds.has(customer.id) ? 'selected' : undefined}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.has(customer.id)}
                  onCheckedChange={() => onToggleSelection(customer.id)}
                  aria-label={`${customer.vorname} ${customer.nachname} auswählen`}
                />
              </TableCell>
              <TableCell className="font-medium">{customer.nachname || '-'}</TableCell>
              <TableCell>{customer.vorname || '-'}</TableCell>
              <TableCell>{customer.pflegegrad ?? '-'}</TableCell>
              <TableCell className="max-w-[130px] truncate" title={buildAddress(customer)}>
                {buildAddress(customer)}
              </TableCell>
              <TableCell>{customer.telefonnr || '-'}</TableCell>
              <TableCell>{formatDate(customer.geburtsdatum)}</TableCell>
              <TableCell
                className="max-w-[130px]"
                title={[customer.pflegekasse, customer.versichertennummer].filter(Boolean).join(' · ')}
              >
                <div className="truncate">{customer.pflegekasse || '-'}</div>
                {customer.versichertennummer && (
                  <div className="truncate text-muted-foreground">{customer.versichertennummer}</div>
                )}
              </TableCell>
              <TableCell>{customer.kassen_privat || '-'}</TableCell>
              <TableCell>{customer.stunden_kontingent_monat || '-'}</TableCell>
              <TableCell>
                <div>{formatDate(customer.eintritt)}</div>
                {customer.austritt && (
                  <div className="text-muted-foreground">{formatDate(customer.austritt)}</div>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={customer.aktiv ? 'default' : 'secondary'} className="text-xs px-1 py-0">
                  {customer.aktiv ? 'Aktiv' : 'Inaktiv'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-0.5">
                  {onViewDetail && (
                    <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => onViewDetail(customer.id)} title="Details">
                      <Eye className="h-3 w-3" />
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => onEdit(customer)} title="Bearbeiten">
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant={customer.aktiv ? 'outline' : 'default'}
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onToggleStatus({ kundenId: customer.id, currentStatus: customer.aktiv })}
                    disabled={togglePending}
                    title={customer.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                  >
                    <Power className="h-3 w-3" />
                  </Button>
                  <Button variant="destructive" size="sm" className="h-6 w-6 p-0" onClick={() => onDelete(customer.id)} title="Löschen">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  {customer.kategorie === 'Interessent' && (
                    <Button variant="default" size="sm" onClick={() => onConvert(customer.id)} disabled={convertPending} className="text-xs h-6 px-1.5">
                      Kunde
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
