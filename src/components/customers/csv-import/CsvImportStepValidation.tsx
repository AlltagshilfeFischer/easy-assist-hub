import { useState, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { ValidatedRow } from '@/hooks/useCsvImportValidation';
import type { MappedCustomerRecord } from '@/lib/csv-parser';

interface CsvImportStepValidationProps {
  validatedRows: ValidatedRow[];
  onEdit: (rowIndex: number, field: string, value: string) => void;
  skipInvalidRows: boolean;
  onSkipInvalidRowsChange: (skip: boolean) => void;
}

interface EditingCell {
  rowIndex: number;
  field: string;
}

type RecordField = keyof Omit<MappedCustomerRecord, '_rowIndex'>;

const FIELD_LABELS: Record<RecordField, string> = {
  nachname: 'Nachname',
  vorname: 'Vorname',
  telefonnr: 'Telefon',
  email: 'E-Mail',
  strasse: 'Straße',
  plz: 'PLZ',
  stadt: 'Stadt',
  stadtteil: 'Stadtteil',
  adresse: 'Adresse',
  geburtsdatum: 'Geburtsdatum',
  pflegegrad: 'Pflegegrad',
  pflegekasse: 'Pflegekasse',
  versichertennummer: 'Vers.Nr.',
  kategorie: 'Kategorie',
  stunden_kontingent_monat: 'Std/Mon',
  sonstiges: 'Sonstiges',
  angehoerige_ansprechpartner: 'Angehörige',
  eintritt: 'Eintritt',
  austritt: 'Austritt',
  kassen_privat: 'Kasse/Privat',
};

// Preferred column order
const FIELD_ORDER: RecordField[] = [
  'nachname', 'vorname', 'pflegegrad', 'adresse', 'strasse', 'plz', 'stadt',
  'stadtteil', 'telefonnr', 'email', 'geburtsdatum', 'pflegekasse',
  'versichertennummer', 'kassen_privat', 'stunden_kontingent_monat',
  'eintritt', 'austritt', 'kategorie', 'angehoerige_ansprechpartner', 'sonstiges',
];

export function CsvImportStepValidation({
  validatedRows,
  onEdit,
  skipInvalidRows,
  onSkipInvalidRowsChange,
}: CsvImportStepValidationProps) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');

  const validCount = validatedRows.filter(r => r.isValid).length;
  const errorCount = validatedRows.length - validCount;

  // Zeige alle Spalten, die in mindestens einer Zeile einen Wert haben
  const activeFields = useMemo<RecordField[]>(() => {
    return FIELD_ORDER.filter(field =>
      validatedRows.some(row => {
        const val = row.editedValues[field] ?? row.record[field];
        return val != null && String(val).trim() !== '';
      })
    );
  }, [validatedRows]);

  const getCellValue = (row: ValidatedRow, field: RecordField): string => {
    const edited = row.editedValues[field];
    if (edited !== undefined) return String(edited);
    const original = row.record[field];
    return original != null ? String(original) : '';
  };

  const getFieldErrors = (row: ValidatedRow, field: string) =>
    row.errors.filter(e => e.field === field);

  const startEdit = (rowIndex: number, field: string, currentValue: string) => {
    setEditingCell({ rowIndex, field });
    setEditValue(currentValue);
  };

  const commitEdit = () => {
    if (editingCell) {
      onEdit(editingCell.rowIndex, editingCell.field, editValue);
      setEditingCell(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditingCell(null);
  };

  if (validatedRows.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Keine Daten zum Validieren
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-medium">
          {validCount === validatedRows.length ? (
            <span className="text-green-600">{validCount} Zeilen fehlerfrei</span>
          ) : (
            <>
              <span className="text-green-600">{validCount} Zeilen fehlerfrei</span>
              {', '}
              <span className="text-red-600">{errorCount} mit Fehlern</span>
            </>
          )}
          <span className="text-muted-foreground font-normal ml-2">
            ({activeFields.length} Spalten erkannt)
          </span>
        </p>
        {errorCount > 0 && (
          <div className="flex items-center gap-2">
            <Switch
              id="skip-invalid"
              checked={skipInvalidRows}
              onCheckedChange={onSkipInvalidRowsChange}
            />
            <label htmlFor="skip-invalid" className="text-sm cursor-pointer">
              Fehlerhafte Zeilen überspringen
            </label>
          </div>
        )}
      </div>

      {errorCount === 0 && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Alle Zeilen sind fehlerfrei
        </div>
      )}

      {/* Table — alle erkannten Spalten */}
      <div className="rounded-md border overflow-auto max-h-[400px]">
        <TooltipProvider>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm z-10">
              <tr className="border-b">
                <th className="text-left px-3 py-2 font-medium w-10 shrink-0">#</th>
                {activeFields.map(f => (
                  <th key={f} className="text-left px-3 py-2 font-medium whitespace-nowrap">
                    {FIELD_LABELS[f]}
                  </th>
                ))}
                <th className="text-left px-3 py-2 font-medium shrink-0">Fehler</th>
              </tr>
            </thead>
            <tbody>
              {validatedRows.map(row => {
                const rowIndex = row.record._rowIndex;
                const isEditing = (field: string) =>
                  editingCell?.rowIndex === rowIndex && editingCell.field === field;

                return (
                  <tr
                    key={rowIndex}
                    className={`border-b last:border-0 border-l-4 ${
                      row.isValid
                        ? 'border-l-green-500'
                        : 'border-l-red-500 bg-red-50'
                    }`}
                  >
                    <td className="px-3 py-2 text-muted-foreground text-xs">{rowIndex + 1}</td>
                    {activeFields.map(field => {
                      const cellValue = getCellValue(row, field);
                      const fieldErrors = getFieldErrors(row, field);
                      const hasError = fieldErrors.length > 0;

                      return (
                        <td key={field} className="px-3 py-2 max-w-[160px]">
                          {isEditing(field) ? (
                            <Input
                              autoFocus
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={handleKeyDown}
                              className="h-7 text-sm"
                            />
                          ) : (
                            <span
                              className={`cursor-pointer rounded px-1 py-0.5 block truncate ${
                                hasError
                                  ? 'text-red-700 bg-red-100 hover:bg-red-200'
                                  : 'hover:bg-muted'
                              }`}
                              onClick={() => startEdit(rowIndex, field, cellValue)}
                              title={hasError ? fieldErrors[0].message : cellValue || 'Klicken zum Bearbeiten'}
                            >
                              {cellValue || <span className="text-muted-foreground italic">—</span>}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 shrink-0">
                      {row.errors.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.errors.slice(0, 3).map((err, i) => (
                            <Tooltip key={i}>
                              <TooltipTrigger asChild>
                                <Badge variant="destructive" className="text-xs cursor-help">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  {err.field}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{err.message}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                          {row.errors.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{row.errors.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TooltipProvider>
      </div>
    </div>
  );
}
