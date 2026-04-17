import { useMemo } from 'react';
import { MappedCustomerRecord } from '@/lib/csv-parser';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidatedRow {
  record: MappedCustomerRecord;
  errors: ValidationError[];
  isValid: boolean;
  editedValues: Partial<MappedCustomerRecord>;
}

function validateRecord(record: MappedCustomerRecord): ValidationError[] {
  const errors: ValidationError[] = [];

  const hasVorname  = record.vorname?.trim().length  > 0;
  const hasNachname = record.nachname?.trim().length > 0;
  const hasVollname = record.vollname?.trim().length > 0;

  if (!hasVorname && !hasNachname && !hasVollname) {
    errors.push({ field: 'vorname', message: 'Vorname, Nachname oder kombinierter Name ist erforderlich' });
  }

  if (record.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
      errors.push({ field: 'email', message: 'Ungültige E-Mail-Adresse' });
    }
  }

  if (record.plz) {
    if (!/^\d{5}$/.test(record.plz)) {
      errors.push({ field: 'plz', message: 'PLZ muss genau 5 Ziffern haben' });
    }
  }

  if (record.telefonnr) {
    if (!/^[+\d][\d\s\-\/()]{4,}$/.test(record.telefonnr)) {
      errors.push({ field: 'telefonnr', message: 'Ungültige Telefonnummer' });
    }
  }

  if (record.geburtsdatum) {
    const match = record.geburtsdatum.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) {
      errors.push({ field: 'geburtsdatum', message: 'Datum muss im Format TT.MM.JJJJ sein' });
    } else {
      const [, day, month, year] = match;
      const date = new Date(`${year}-${month}-${day}`);
      if (isNaN(date.getTime()) || date.getDate() !== parseInt(day, 10)) {
        errors.push({ field: 'geburtsdatum', message: 'Ungültiges Datum (z.B. 31.02. existiert nicht)' });
      }
    }
  }

  if (record.pflegegrad) {
    const val = Number(record.pflegegrad);
    if (isNaN(val) || !Number.isInteger(val) || val < 0 || val > 5) {
      errors.push({ field: 'pflegegrad', message: 'Pflegegrad muss ein ganzzahliger Wert von 0 bis 5 sein' });
    }
  }

  if (record.kategorie) {
    if (!['Kunde', 'Interessent'].includes(record.kategorie)) {
      errors.push({ field: 'kategorie', message: 'Kategorie muss "Kunde" oder "Interessent" sein' });
    }
  }

  return errors;
}

function validateRecords(records: MappedCustomerRecord[]): ValidatedRow[] {
  return records.map(record => {
    const errors = validateRecord(record);
    return {
      record,
      errors,
      isValid: errors.length === 0,
      editedValues: {},
    };
  });
}

export function useCsvImportValidation(records: MappedCustomerRecord[]) {
  const validatedRows = useMemo(() => validateRecords(records), [records]);

  const validCount = validatedRows.filter(r => r.isValid).length;
  const errorCount = validatedRows.filter(r => !r.isValid).length;

  return { validatedRows, validCount, errorCount };
}
