import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';

interface CustomerFiltersProps {
  customers: any[] | undefined;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  customerStatusFilter: 'all' | 'active' | 'inactive';
  setCustomerStatusFilter: (v: 'all' | 'active' | 'inactive') => void;
  customerKategorieFilter: 'all' | 'Kunde' | 'Interessent';
  setCustomerKategorieFilter: (v: 'all' | 'Kunde' | 'Interessent') => void;
  stadtteilFilter: string;
  setStadtteilFilter: (v: string) => void;
  eintrittsdatumFilter: string;
  setEintrittsdatumFilter: (v: string) => void;
  dateFromFilter: string;
  setDateFromFilter: (v: string) => void;
  dateToFilter: string;
  setDateToFilter: (v: string) => void;
}

export function CustomerFilters({
  customers,
  searchQuery, setSearchQuery,
  customerStatusFilter, setCustomerStatusFilter,
  customerKategorieFilter, setCustomerKategorieFilter,
  stadtteilFilter, setStadtteilFilter,
  eintrittsdatumFilter, setEintrittsdatumFilter,
  dateFromFilter, setDateFromFilter,
  dateToFilter, setDateToFilter,
}: CustomerFiltersProps) {
  return (
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
            {Array.from(new Set(customers?.map((c: any) => c.stadtteil).filter(Boolean)))
              .sort()
              .map((stadtteil: any) => (
                <SelectItem key={stadtteil} value={stadtteil}>{stadtteil}</SelectItem>
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
          <Input type="date" value={dateFromFilter} onChange={(e) => setDateFromFilter(e.target.value)} className="w-[160px]" />
        </div>
        <div className="flex gap-2 items-center">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Bis:</Label>
          <Input type="date" value={dateToFilter} onChange={(e) => setDateToFilter(e.target.value)} className="w-[160px]" />
        </div>
        {(dateFromFilter || dateToFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFromFilter(''); setDateToFilter(''); }}>
            Zurücksetzen
          </Button>
        )}
      </div>

      {/* Kategorie Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={customerKategorieFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setCustomerKategorieFilter('all')}>
          Alle ({customers?.length || 0})
        </Button>
        <Button variant={customerKategorieFilter === 'Kunde' ? 'default' : 'outline'} size="sm" onClick={() => setCustomerKategorieFilter('Kunde')}>
          Kunden ({customers?.filter((c: any) => c.kategorie === 'Kunde').length || 0})
        </Button>
        <Button variant={customerKategorieFilter === 'Interessent' ? 'default' : 'outline'} size="sm" onClick={() => setCustomerKategorieFilter('Interessent')}>
          Interessenten ({customers?.filter((c: any) => c.kategorie === 'Interessent').length || 0})
        </Button>
      </div>
    </div>
  );
}
