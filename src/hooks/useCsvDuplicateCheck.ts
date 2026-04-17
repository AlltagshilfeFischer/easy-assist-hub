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

const normalizeKey = (v: string, n: string, geb?: string): string => {
  const base = `${v.trim().toLowerCase()}|${n.trim().toLowerCase()}`;
  return geb ? `${base}|${geb}` : base;
};

const parseGermanDateToIso = (s: string): string => {
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
};

export function useCsvDuplicateCheck(validRows: ValidatedRow[]) {
  const { data: existingCustomers, isLoading } = useQuery({
    queryKey: ['customers-for-duplicate-check'],
    queryFn: async (): Promise<ExistingCustomer[]> => {
      const { data, error } = await supabase
        .from('kunden')
        .select('id, vorname, nachname, geburtsdatum, strasse, telefonnr');
      if (error) throw error;
      return data ?? [];
    },
  });

  const duplicateInfos: Map<number, DuplicateInfo> = useMemo(() => {
    const result = new Map<number, DuplicateInfo>();

    if (!existingCustomers) return result;

    const existingByFullKey = new Map<string, ExistingCustomer>();
    const existingByNameKey = new Map<string, ExistingCustomer>();

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
    }

    for (const validatedRow of validRows) {
      const { record } = validatedRow;
      const rowIndex = record._rowIndex;
      // vollname aufteilen falls vorname/nachname leer
      let vorname  = record.vorname  ?? '';
      let nachname = record.nachname ?? '';
      if (!vorname && !nachname && record.vollname?.trim()) {
        const parts = record.vollname.trim().split(/\s+/);
        nachname = parts[0] ?? '';
        vorname  = parts.slice(1).join(' ');
      }

      let found: ExistingCustomer | undefined;

      if (record.geburtsdatum) {
        const isoGeb = parseGermanDateToIso(record.geburtsdatum);
        const fullKey = normalizeKey(vorname, nachname, isoGeb);
        found = existingByFullKey.get(fullKey);
      }

      if (!found) {
        const nameKey = normalizeKey(vorname, nachname);
        found = existingByNameKey.get(nameKey);
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
