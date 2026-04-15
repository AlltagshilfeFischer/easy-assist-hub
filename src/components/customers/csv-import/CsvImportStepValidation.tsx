import { useState } from 'react';
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

const EDITABLE_FIELDS: Array<{ key: keyof Omit<MappedCustomerRecord, '_rowIndex'>; label: string }> = [
  { key: 'vorname', label: 'Vorname' },
  { key: 'nachname', label: 'Nachname' },
  { key: 'geburtsdatum', label: 'Geburtsdatum' },
  { key: 'telefonnr', label: 'Telefon' },
  { key: 'strasse', label: 'Straße' },
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

  const getCellValue = (row: ValidatedRow, field: keyof Omit<MappedCustomerRecord, '_rowIndex'>): string => {
    const edited = row.editedValues[field];
    if (edited !== undefined) return String(edited);
    const original = row.record[field];
    return original != null ? String(original) : '';
  };

  const getFieldErrors = (row: ValidatedRow, field: string) => {
    return row.errors.filter(e => e.field === field);
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

      {/* All valid banner */}
      {errorCount === 0 && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Alle Zeilen sind fehlerfrei
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-auto max-h-[400px]">
        <TooltipProvider>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm z-10">
              <tr className="border-b">
                <th className="text-left px-3 py-2 font-medium w-10">#</th>
                {EDITABLE_FIELDS.map(f => (
                  <th key={f.key} className="text-left px-3 py-2 font-medium">{f.label}</th>
                ))}
                <th className="text-left px-3 py-2 font-medium">Fehler</th>
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
                    {EDITABLE_FIELDS.map(({ key }) => {
                      const cellValue = getCellValue(row, key);
                      const fieldErrors = getFieldErrors(row, key);
                      const hasError = fieldErrors.length > 0;

                      return (
                        <td key={key} className="px-3 py-2">
                          {isEditing(key) ? (
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
                              className={`cursor-pointer rounded px-1 py-0.5 ${
                                hasError
                                  ? 'text-red-700 bg-red-100 hover:bg-red-200'
                                  : 'hover:bg-muted'
                              }`}
                              onClick={() => startEdit(rowIndex, key, cellValue)}
                              title={hasError ? fieldErrors[0].message : 'Klicken zum Bearbeiten'}
                            >
                              {cellValue || <span className="text-muted-foreground italic">leer</span>}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2">
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
