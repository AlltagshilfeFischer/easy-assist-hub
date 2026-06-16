import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ValidatedRow } from './useCsvImportValidation';

export type DuplicateAction = 'skip' | 'import_anyway' | 'update_existing';

export interface DuplicateInfo {
  rowIndex: number;
  status: 'none' | 'potential';
  existingCustomer?: {
    id: string;
    vorname: string | null;
    nachname: string | null;
    geburtsdatum: string | null;
    strasse: string | null;
    telefonnr: string | null;
  };
  action: DuplicateAction;
}

interface ExistingCustomer {
  id: string;
  vorname: string | null;
  nachname: string | null;
  geburtsdatum: string | null;
  strasse: string | null;
  telefonnr: string | null;
}

// Umlaute, Leerzeichen und Sonderzeichen normalisieren für robustes Matching
const normalizeStr = (s: string): string =>
  s.trim().toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ');

const normalizeKey = (v: string, n: string, geb?: string): string => {
  const base = `${normalizeStr(v)}|${normalizeStr(n)}`;
  return geb ? `${base}|${geb}` : base;
};

// Telefonnummer auf Ziffern reduzieren, +49/0049 → 0
const normalizePhone = (s: string): string =>
  s.replace(/[\s\-\/().]/g, '')
    .replace(/^\+49/, '0')
    .replace(/^0049/, '0');

const parseGermanDateToIso = (s: string): string => {
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
};

export function useCsvDuplicateCheck(validRows: ValidatedRow[]) {
  const { data: existingCustomers, isLoading } = useQuery({
    queryKey: ['customers-for-duplicate-check'],
    queryFn: async (): Promise<ExistingCustomer[]> => {
      // Supabase gibt standardmäßig max. 1000 Zeilen zurück — bei größeren DBs
      // müssen wir paginiert laden, damit kein Duplikat übersehen wird.
      const PAGE_SIZE = 1000;
      const all: ExistingCustomer[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('kunden')
          .select('id, vorname, nachname, geburtsdatum, strasse, telefonnr')
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all;
    },
    staleTime: 0,
    gcTime: 0,
  });

  const duplicateInfos: Map<number, DuplicateInfo> = useMemo(() => {
    const result = new Map<number, DuplicateInfo>();

    if (!existingCustomers) return result;

    const existingByFullKey  = new Map<string, ExistingCustomer>();
    const existingByNameKey  = new Map<string, ExistingCustomer>();
    const existingByPhone    = new Map<string, ExistingCustomer>();

    for (const customer of existingCustomers) {
      const vorname = customer.vorname ?? '';
      const nachname = customer.nachname ?? '';
      if (!vorname && !nachname) continue;

      if (customer.geburtsdatum) {
        const fullKey = normalizeKey(vorname, nachname, customer.geburtsdatum);
        existingByFullKey.set(fullKey, customer);
      }

      const nameKey = normalizeKey(vorname, nachname);
      if (!existingByNameKey.has(nameKey)) {
        existingByNameKey.set(nameKey, customer);
      }

      // Telefon als dritte Matching-Stufe (Fallback wenn Name nicht eindeutig)
      if (customer.telefonnr) {
        const phoneKey = normalizePhone(customer.telefonnr);
        if (phoneKey.length >= 6 && !existingByPhone.has(phoneKey)) {
          existingByPhone.set(phoneKey, customer);
        }
      }
    }

    for (const validatedRow of validRows) {
      const { record } = validatedRow;
      const rowIndex = record._rowIndex;
      const vorname  = record.vorname  ?? '';
      const nachname = record.nachname ?? '';

      let found: ExistingCustomer | undefined;

      // Stufe 1: Name + Geburtsdatum (stärkster Match)
      if (record.geburtsdatum) {
        const isoGeb = parseGermanDateToIso(record.geburtsdatum);
        const fullKey = normalizeKey(vorname, nachname, isoGeb);
        found = existingByFullKey.get(fullKey);
      }

      // Stufe 2: Nur Name (umlaut-normalisiert)
      if (!found) {
        const nameKey = normalizeKey(vorname, nachname);
        found = existingByNameKey.get(nameKey);
      }

      // Stufe 3: Telefonnummer (Fallback wenn Name nicht matcht)
      if (!found && record.telefonnr) {
        const phoneKey = normalizePhone(record.telefonnr);
        if (phoneKey.length >= 6) {
          found = existingByPhone.get(phoneKey);
        }
      }

      if (found) {
        result.set(rowIndex, {
          rowIndex,
          status: 'potential',
          existingCustomer: found,
          action: 'skip',
        });
      } else {
        result.set(rowIndex, {
          rowIndex,
          status: 'none',
          action: 'import_anyway',
        });
      }
    }

    return result;
  }, [validRows, existingCustomers]);

  const [actions, setActionsState] = useState<Map<number, DuplicateAction>>(new Map());

  const setAction = (rowIndex: number, action: DuplicateAction) => {
    setActionsState(prev => {
      const next = new Map(prev);
      next.set(rowIndex, action);
      return next;
    });
  };

  const setAllDuplicatesAction = (action: DuplicateAction) => {
    setActionsState(prev => {
      const next = new Map(prev);
      for (const [rowIndex, info] of duplicateInfos.entries()) {
        if (info.status === 'potential') {
          next.set(rowIndex, action);
        }
      }
      return next;
    });
  };

  const duplicateCount = useMemo(() => {
    let count = 0;
    for (const info of duplicateInfos.values()) {
      if (info.status !== 'none') count++;
    }
    return count;
  }, [duplicateInfos]);

  return {
    duplicateInfos,
    actions,
    setAction,
    setAllDuplicatesAction,
    duplicateCount,
    isLoading,
  };
}
