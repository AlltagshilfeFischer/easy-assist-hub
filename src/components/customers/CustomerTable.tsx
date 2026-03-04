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
import { Edit, Phone, Mail, ArrowUpDown, ChevronUp, ChevronDown, Power, Trash2, Eye } from 'lucide-react';
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
          currentSort.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </div>
    </Button>
  );
}

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('de-DE');
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
  emailFilter, setEmailFilter,
  pflegegradFilter, setPflegegradFilter,
  strasseFilter, setStrasseFilter,
  plzFilter, setPlzFilter,
  stadtFilter, setStadtFilter,
}: CustomerTableProps) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow>
            <TableHead><SortButton sortKey="name" currentSort={customerSort} onClick={onSort}>Name</SortButton></TableHead>
            <TableHead><SortButton sortKey="status" currentSort={customerSort} onClick={onSort}>Status</SortButton></TableHead>
            <TableHead>Kategorie</TableHead>
            <TableHead><SortButton sortKey="telefon" currentSort={customerSort} onClick={onSort}>Telefon</SortButton></TableHead>
            <TableHead><SortButton sortKey="email" currentSort={customerSort} onClick={onSort}>E-Mail</SortButton></TableHead>
            <TableHead><SortButton sortKey="pflegegrad" currentSort={customerSort} onClick={onSort}>Pflegegrad</SortButton></TableHead>
            <TableHead>PLZ</TableHead>
            <TableHead>Stadt</TableHead>
            <TableHead><SortButton sortKey="strasse" currentSort={customerSort} onClick={onSort}>Straße</SortButton></TableHead>
            <TableHead><SortButton sortKey="geburtsdatum" currentSort={customerSort} onClick={onSort}>Geburtsdatum</SortButton></TableHead>
            <TableHead><SortButton sortKey="created_at" currentSort={customerSort} onClick={onSort}>Hinzugefügt</SortButton></TableHead>
            <TableHead>Aktionen</TableHead>
          </TableRow>
          {/* Column filter row */}
          <TableRow>
            <TableHead><Input placeholder="Name filtern..." value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} className="h-8 text-xs" /></TableHead>
            <TableHead></TableHead>
            <TableHead></TableHead>
            <TableHead><Input placeholder="Telefon filtern..." value={telefonFilter} onChange={(e) => setTelefonFilter(e.target.value)} className="h-8 text-xs" /></TableHead>
            <TableHead><Input placeholder="E-Mail filtern..." value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)} className="h-8 text-xs" /></TableHead>
            <TableHead><Input placeholder="Pflegegrad..." value={pflegegradFilter} onChange={(e) => setPflegegradFilter(e.target.value)} className="h-8 text-xs w-20" /></TableHead>
            <TableHead><Input placeholder="PLZ..." value={plzFilter} onChange={(e) => setPlzFilter(e.target.value)} className="h-8 text-xs w-24" /></TableHead>
            <TableHead><Input placeholder="Stadt..." value={stadtFilter} onChange={(e) => setStadtFilter(e.target.value)} className="h-8 text-xs" /></TableHead>
            <TableHead><Input placeholder="Straße..." value={strasseFilter} onChange={(e) => setStrasseFilter(e.target.value)} className="h-8 text-xs" /></TableHead>
            <TableHead></TableHead>
            <TableHead></TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer: any) => (
            <TableRow key={customer.id}>
              <TableCell className="font-medium">{customer.vorname} {customer.nachname}</TableCell>
              <TableCell>
                <Badge variant={customer.aktiv ? 'default' : 'secondary'}>{customer.aktiv ? 'Aktiv' : 'Inaktiv'}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={customer.kategorie === 'Interessent' ? 'outline' : 'default'}>{customer.kategorie || 'Kunde'}</Badge>
              </TableCell>
              <TableCell>
                {customer.telefonnr ? (
                  <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{customer.telefonnr}</div>
                ) : '-'}
              </TableCell>
              <TableCell>
                {customer.email ? (
                  <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{customer.email}</div>
                ) : '-'}
              </TableCell>
              <TableCell>{customer.pflegegrad || '-'}</TableCell>
              <TableCell>{customer.plz || '-'}</TableCell>
              <TableCell>{customer.stadt || '-'}</TableCell>
              <TableCell>{customer.strasse || '-'}</TableCell>
              <TableCell>{formatDate(customer.geburtsdatum)}</TableCell>
              <TableCell>
                {customer.created_at
                  ? new Date(customer.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  : '-'}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {onViewDetail && <Button variant="outline" size="sm" onClick={() => onViewDetail(customer.id)} title="Details anzeigen"><Eye className="h-3 w-3" /></Button>}
                  <Button variant="outline" size="sm" onClick={() => onEdit(customer)} title="Bearbeiten"><Edit className="h-3 w-3" /></Button>
                  <Button variant={customer.aktiv ? 'outline' : 'default'} size="sm" onClick={() => onToggleStatus({ kundenId: customer.id, currentStatus: customer.aktiv })} disabled={togglePending} title={customer.aktiv ? 'Deaktivieren' : 'Aktivieren'}><Power className="h-3 w-3" /></Button>
                  <Button variant="destructive" size="sm" onClick={() => onDelete(customer.id)} title="Löschen"><Trash2 className="h-3 w-3" /></Button>
                  {customer.kategorie === 'Interessent' && (
                    <Button variant="default" size="sm" onClick={() => onConvert(customer.id)} disabled={convertPending}>Zu Kunde</Button>
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
