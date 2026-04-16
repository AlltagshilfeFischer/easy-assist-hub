import React from 'react';
import { Button } from '@/components/ui/button';
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
  // bereits im Format TT.MM.JJJJ (aus Excel-Import)?
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(val)) return val;
  // ISO-Datum oder YYYY-MM
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
  nameFilter, setNameFilter,
  telefonFilter, setTelefonFilter,
  pflegegradFilter, setPflegegradFilter,
  pflegekasseFilter, setPflegekasseFilter,
  // kept in props but not used in filter-row (used by hook)
  emailFilter: _emailFilter, setEmailFilter: _setEmailFilter,
  strasseFilter: _strasseFilter, setStrasseFilter: _setStrasseFilter,
  plzFilter: _plzFilter, setPlzFilter: _setPlzFilter,
  stadtFilter: _stadtFilter, setStadtFilter: _setStadtFilter,
}: CustomerTableProps) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-[1400px] text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[110px]"><SortButton sortKey="nachname" currentSort={customerSort} onClick={onSort}>Nachname</SortButton></TableHead>
            <TableHead className="w-[100px]"><SortButton sortKey="vorname" currentSort={customerSort} onClick={onSort}>Vorname</SortButton></TableHead>
            <TableHead className="w-[60px]"><SortButton sortKey="pflegegrad" currentSort={customerSort} onClick={onSort}>PG</SortButton></TableHead>
            <TableHead><SortButton sortKey="strasse" currentSort={customerSort} onClick={onSort}>Adresse</SortButton></TableHead>
            <TableHead className="w-[120px]"><SortButton sortKey="telefon" currentSort={customerSort} onClick={onSort}>Telefon</SortButton></TableHead>
            <TableHead className="w-[100px]"><SortButton sortKey="geburtsdatum" currentSort={customerSort} onClick={onSort}>Geburtsdatum</SortButton></TableHead>
            <TableHead>Pflegekasse</TableHead>
            <TableHead>Vers.Nr.</TableHead>
            <TableHead className="w-[80px]">Kasse/Privat</TableHead>
            <TableHead className="w-[70px]">Std/Mon</TableHead>
            <TableHead className="w-[90px]"><SortButton sortKey="eintritt" currentSort={customerSort} onClick={onSort}>Eintritt</SortButton></TableHead>
            <TableHead className="w-[90px]">Austritt</TableHead>
            <TableHead className="w-[70px]">Status</TableHead>
            <TableHead className="w-[120px]">Aktionen</TableHead>
          </TableRow>
          {/* Spaltenfilter-Zeile */}
          <TableRow>
            <TableHead colSpan={2}><Input placeholder="Name filtern..." value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} className="h-7 text-xs" /></TableHead>
            <TableHead><Input placeholder="PG..." value={pflegegradFilter} onChange={(e) => setPflegegradFilter(e.target.value)} className="h-7 text-xs w-12" /></TableHead>
            <TableHead></TableHead>
            <TableHead><Input placeholder="Telefon..." value={telefonFilter} onChange={(e) => setTelefonFilter(e.target.value)} className="h-7 text-xs" /></TableHead>
            <TableHead></TableHead>
            <TableHead><Input placeholder="Kasse..." value={pflegekasseFilter} onChange={(e) => setPflegekasseFilter(e.target.value)} className="h-7 text-xs" /></TableHead>
            <TableHead></TableHead>
            <TableHead></TableHead>
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
              <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                Keine Kunden gefunden
              </TableCell>
            </TableRow>
          )}
          {customers.map((customer: any) => (
            <TableRow key={customer.id}>
              <TableCell className="font-medium">{customer.nachname || '-'}</TableCell>
              <TableCell>{customer.vorname || '-'}</TableCell>
              <TableCell>{customer.pflegegrad ?? '-'}</TableCell>
              <TableCell className="max-w-[200px] truncate" title={buildAddress(customer)}>
                {buildAddress(customer)}
              </TableCell>
              <TableCell>{customer.telefonnr || '-'}</TableCell>
              <TableCell>{formatDate(customer.geburtsdatum)}</TableCell>
              <TableCell className="max-w-[140px] truncate" title={customer.pflegekasse || ''}>
                {customer.pflegekasse || '-'}
              </TableCell>
              <TableCell className="max-w-[120px] truncate" title={customer.versichertennummer || ''}>
                {customer.versichertennummer || '-'}
              </TableCell>
              <TableCell>{customer.kassen_privat || '-'}</TableCell>
              <TableCell>{customer.stunden_kontingent_monat || '-'}</TableCell>
              <TableCell>{formatDate(customer.eintritt)}</TableCell>
              <TableCell>{formatDate(customer.austritt)}</TableCell>
              <TableCell>
                <Badge variant={customer.aktiv ? 'default' : 'secondary'} className="text-xs">
                  {customer.aktiv ? 'Aktiv' : 'Inaktiv'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {onViewDetail && (
                    <Button variant="outline" size="sm" onClick={() => onViewDetail(customer.id)} title="Details">
                      <Eye className="h-3 w-3" />
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => onEdit(customer)} title="Bearbeiten">
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant={customer.aktiv ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => onToggleStatus({ kundenId: customer.id, currentStatus: customer.aktiv })}
                    disabled={togglePending}
                    title={customer.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                  >
                    <Power className="h-3 w-3" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => onDelete(customer.id)} title="Löschen">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  {customer.kategorie === 'Interessent' && (
                    <Button variant="default" size="sm" onClick={() => onConvert(customer.id)} disabled={convertPending} className="text-xs px-2">
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
