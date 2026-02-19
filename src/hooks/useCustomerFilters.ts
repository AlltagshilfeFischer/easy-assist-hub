import { useState, useMemo } from 'react';

export type SortKey = 'name' | 'status' | 'telefon' | 'email' | 'created_at' | 'pflegegrad' | 'strasse' | 'geburtsdatum' | 'eintritt';
export type SortDirection = 'asc' | 'desc';

export interface CustomerFilterState {
  searchQuery: string;
  customerStatusFilter: 'all' | 'active' | 'inactive';
  customerKategorieFilter: 'all' | 'Kunde' | 'Interessent';
  dateFromFilter: string;
  dateToFilter: string;
  stadtteilFilter: string;
  eintrittsdatumFilter: string;
  nameFilter: string;
  telefonFilter: string;
  emailFilter: string;
  pflegegradFilter: string;
  strasseFilter: string;
  plzFilter: string;
  stadtFilter: string;
  customerSort: { key: SortKey; direction: SortDirection };
}

export function useCustomerFilters(customers: any[] | undefined) {
  const [searchQuery, setSearchQuery] = useState('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [customerKategorieFilter, setCustomerKategorieFilter] = useState<'all' | 'Kunde' | 'Interessent'>('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [stadtteilFilter, setStadtteilFilter] = useState('all');
  const [eintrittsdatumFilter, setEintrittsdatumFilter] = useState('all');
  const [nameFilter, setNameFilter] = useState('');
  const [telefonFilter, setTelefonFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [pflegegradFilter, setPflegegradFilter] = useState('');
  const [strasseFilter, setStrasseFilter] = useState('');
  const [plzFilter, setPlzFilter] = useState('');
  const [stadtFilter, setStadtFilter] = useState('');
  const [customerSort, setCustomerSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'created_at',
    direction: 'desc',
  });

  const handleSort = (key: SortKey) => {
    setCustomerSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedCustomers = useMemo(() => {
    if (!customers) return [];

    let filtered = customers;

    // Global search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((customer: any) => {
        const searchableFields = [
          customer.name, customer.vorname, customer.nachname,
          customer.telefonnr, customer.email, customer.strasse,
          customer.stadt, customer.plz, customer.stadtteil, customer.pflegekasse,
        ].filter(Boolean).map((f) => f.toLowerCase());
        return searchableFields.some((field) => field.includes(query));
      });
    }

    // Column filters
    if (nameFilter.trim()) {
      const q = nameFilter.toLowerCase();
      filtered = filtered.filter((c: any) => `${c.vorname || ''} ${c.nachname || ''}`.toLowerCase().includes(q));
    }
    if (telefonFilter.trim()) {
      const q = telefonFilter.toLowerCase();
      filtered = filtered.filter((c: any) => c.telefonnr?.toLowerCase().includes(q));
    }
    if (emailFilter.trim()) {
      const q = emailFilter.toLowerCase();
      filtered = filtered.filter((c: any) => c.email?.toLowerCase().includes(q));
    }
    if (pflegegradFilter.trim()) {
      filtered = filtered.filter((c: any) => c.pflegegrad?.toString().includes(pflegegradFilter));
    }
    if (strasseFilter.trim()) {
      const q = strasseFilter.toLowerCase();
      filtered = filtered.filter((c: any) => c.strasse?.toLowerCase().includes(q));
    }
    if (plzFilter.trim()) {
      const q = plzFilter.toLowerCase();
      filtered = filtered.filter((c: any) => c.plz?.toLowerCase().includes(q));
    }
    if (stadtFilter.trim()) {
      const q = stadtFilter.toLowerCase();
      filtered = filtered.filter((c: any) => c.stadt?.toLowerCase().includes(q));
    }

    // Status filter
    if (customerStatusFilter === 'active') {
      filtered = filtered.filter((c: any) => c.aktiv === true);
    } else if (customerStatusFilter === 'inactive') {
      filtered = filtered.filter((c: any) => c.aktiv === false);
    }

    // Kategorie filter
    if (customerKategorieFilter !== 'all') {
      filtered = filtered.filter((c: any) => c.kategorie === customerKategorieFilter);
    }

    // Stadtteil filter
    if (stadtteilFilter !== 'all' && stadtteilFilter) {
      filtered = filtered.filter((c: any) => c.stadtteil === stadtteilFilter);
    }

    // Eintrittsdatum filter
    if (eintrittsdatumFilter !== 'all' && eintrittsdatumFilter) {
      const now = new Date();
      const filterDate = new Date();
      switch (eintrittsdatumFilter) {
        case 'last_month': filterDate.setMonth(now.getMonth() - 1); break;
        case 'last_3_months': filterDate.setMonth(now.getMonth() - 3); break;
        case 'last_6_months': filterDate.setMonth(now.getMonth() - 6); break;
        case 'last_year': filterDate.setFullYear(now.getFullYear() - 1); break;
        case 'this_year': filterDate.setMonth(0); filterDate.setDate(1); break;
      }
      filtered = filtered.filter((c: any) => {
        if (!c.eintritt) return false;
        return new Date(c.eintritt) >= filterDate;
      });
    }

    // Date range filter (created_at)
    if (dateFromFilter || dateToFilter) {
      filtered = filtered.filter((c: any) => {
        const createdAt = c.created_at ? new Date(c.created_at) : null;
        if (!createdAt) return false;
        const matchesFrom = !dateFromFilter || createdAt >= new Date(dateFromFilter);
        const matchesTo = !dateToFilter || createdAt <= new Date(dateToFilter + 'T23:59:59');
        return matchesFrom && matchesTo;
      });
    }

    // Sort
    return [...filtered].sort((a, b) => {
      const { key, direction } = customerSort;
      let aValue: string | number = '';
      let bValue: string | number = '';

      switch (key) {
        case 'name': aValue = (a.name || '').toLowerCase(); bValue = (b.name || '').toLowerCase(); break;
        case 'status': aValue = a.aktiv ? 'aktiv' : 'inaktiv'; bValue = b.aktiv ? 'aktiv' : 'inaktiv'; break;
        case 'telefon': aValue = (a.telefonnr || '').toLowerCase(); bValue = (b.telefonnr || '').toLowerCase(); break;
        case 'email': aValue = (a.email || '').toLowerCase(); bValue = (b.email || '').toLowerCase(); break;
        case 'pflegegrad': aValue = a.pflegegrad || 0; bValue = b.pflegegrad || 0; break;
        case 'strasse': aValue = (a.strasse || '').toLowerCase(); bValue = (b.strasse || '').toLowerCase(); break;
        case 'geburtsdatum': aValue = new Date(a.geburtsdatum || 0).getTime(); bValue = new Date(b.geburtsdatum || 0).getTime(); break;
        case 'eintritt': aValue = new Date(a.eintritt || 0).getTime(); bValue = new Date(b.eintritt || 0).getTime(); break;
        case 'created_at': aValue = new Date(a.created_at || 0).getTime(); bValue = new Date(b.created_at || 0).getTime(); break;
        default: return 0;
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [customers, customerSort, searchQuery, customerStatusFilter, customerKategorieFilter, stadtteilFilter, eintrittsdatumFilter, dateFromFilter, dateToFilter, nameFilter, telefonFilter, emailFilter, pflegegradFilter, strasseFilter, plzFilter, stadtFilter]);

  return {
    sortedCustomers,
    customerSort,
    handleSort,
    searchQuery, setSearchQuery,
    customerStatusFilter, setCustomerStatusFilter,
    customerKategorieFilter, setCustomerKategorieFilter,
    dateFromFilter, setDateFromFilter,
    dateToFilter, setDateToFilter,
    stadtteilFilter, setStadtteilFilter,
    eintrittsdatumFilter, setEintrittsdatumFilter,
    nameFilter, setNameFilter,
    telefonFilter, setTelefonFilter,
    emailFilter, setEmailFilter,
    pflegegradFilter, setPflegegradFilter,
    strasseFilter, setStrasseFilter,
    plzFilter, setPlzFilter,
    stadtFilter, setStadtFilter,
  };
}
