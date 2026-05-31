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

  const isInteressent = record.kategorie?.trim().toLowerCase() === 'interessent';
  if (!isInteressent && !record.vorname?.trim()) {
    errors.push({ field: 'vorname', message: 'Vorname ist erforderlich' });
  }
  if (!record.nachname?.trim()) {
    errors.push({ field: 'nachname', message: 'Nachname ist erforderlich' });
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
    const deMatch = record.geburtsdatum.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    const isoMatch = record.geburtsdatum.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (deMatch) {
      const [, day, month, year] = deMatch;
      const date = new Date(`${year}-${month}-${day}`);
      if (isNaN(date.getTime()) || date.getUTCDate() !== parseInt(day, 10)) {
        errors.push({ field: 'geburtsdatum', message: 'Ungültiges Datum (z.B. 31.02. existiert nicht)' });
      }
    } else if (isoMatch) {
      const [, year, month, day] = isoMatch;
      const date = new Date(`${year}-${month}-${day}`);
      if (isNaN(date.getTime()) || date.getUTCDate() !== parseInt(day, 10)) {
        errors.push({ field: 'geburtsdatum', message: 'Ungültiges Datum' });
      }
    } else {
      errors.push({ field: 'geburtsdatum', message: 'Datum muss im Format TT.MM.JJJJ oder JJJJ-MM-TT sein' });
    }
  }

  if (record.pflegegrad) {
    const val = Number(record.pflegegrad);
    if (isNaN(val) || !Number.isInteger(val) || val < 0 || val > 5) {
      errors.push({ field: 'pflegegrad', message: 'Pflegegrad muss ein ganzzahliger Wert von 0 bis 5 sein' });
    }
  }

  if (record.kategorie) {
    const norm = record.kategorie.trim();
    const cap = norm.charAt(0).toUpperCase() + norm.slice(1).toLowerCase();
    if (!['Kunde', 'Interessent'].includes(cap)) {
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
