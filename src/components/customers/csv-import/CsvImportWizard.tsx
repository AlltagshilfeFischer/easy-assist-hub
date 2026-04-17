import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { applyColumnMapping } from '@/lib/csv-parser';
import type { CsvParseResult, MappedCustomerRecord } from '@/lib/csv-parser';
import { useCsvImportValidation } from '@/hooks/useCsvImportValidation';
import { useCsvDuplicateCheck } from '@/hooks/useCsvDuplicateCheck';
import type { DuplicateAction } from '@/hooks/useCsvDuplicateCheck';
import { CsvImportStepMapping } from './CsvImportStepMapping';
import { CsvImportStepValidation } from './CsvImportStepValidation';
import { CsvImportStepDuplicates } from './CsvImportStepDuplicates';

interface CsvImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function recordToSupabaseInsert(r: MappedCustomerRecord) {
  // DD.MM.YYYY → YYYY-MM-DD (ISO); YYYY-MM-DD durchreichen; sonst null
  const toIsoDate = (s?: string): string | null => {
    if (!s) return null;
    const de = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (de) return `${de[3]}-${de[2]}-${de[1]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // YYYY-MM (Monatsformat)
    if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
    return null;
  };
  const vorname  = r.vorname?.trim()  || null;
  const nachname = r.nachname?.trim() || null;
  return {
    vorname,
    nachname,
    name: [vorname, nachname].filter(Boolean).join(' ') || null,
    telefonnr: r.telefonnr?.trim() || null,
    email: r.email?.trim() || null,
    strasse: r.strasse?.trim() || null,
    plz: r.plz?.trim() || null,
    stadt: r.stadt?.trim() || null,
    stadtteil: r.stadtteil?.trim() || null,
    adresse: r.adresse?.trim() || null,
    geburtsdatum: toIsoDate(r.geburtsdatum),
    pflegegrad: r.pflegegrad != null && r.pflegegrad !== '' ? parseInt(r.pflegegrad, 10) : null,
    pflegekasse: r.pflegekasse?.trim() || null,
    versichertennummer: r.versichertennummer?.trim() || null,
    kategorie: r.kategorie || 'Kunde',
    aktiv: !r.kategorie || r.kategorie === 'Kunde',
    stunden_kontingent_monat: r.stunden_kontingent_monat
      ? parseFloat(r.stunden_kontingent_monat)
      : null,
    sonstiges: r.sonstiges?.trim() || null,
    angehoerige_ansprechpartner: r.angehoerige_ansprechpartner?.trim() || null,
    eintritt: toIsoDate(r.eintritt),
    austritt: toIsoDate(r.austritt),
    kasse_privat: r.kassen_privat?.trim() || null,
    farbe_kalender: '#10B981',
  };
}

const STEP_LABELS = ['1. Spalten zuordnen', '2. Daten prüfen', '3. Duplikate'] as const;

export function CsvImportWizard({ open, onOpenChange }: CsvImportWizardProps) {
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [csvParseResult, setCsvParseResult] = useState<CsvParseResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({});
  const [mappedRecords, setMappedRecords] = useState<MappedCustomerRecord[]>([]);
  const [editedRows, setEditedRows] = useState<Map<number, Partial<MappedCustomerRecord>>>(new Map());
  const [skipInvalidRows, setSkipInvalidRows] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const mergedRecords = useMemo(
    () => mappedRecords.map(r => ({ ...r, ...(editedRows.get(r._rowIndex) ?? {}) })),
    [mappedRecords, editedRows]
  );
  const { validatedRows } = useCsvImportValidation(mergedRecords);

  const rowsForDuplicateCheck = validatedRows.filter(r => r.isValid || skipInvalidRows);
  const { duplicateInfos, actions, setAction, setAllDuplicatesAction: setAllAction } = useCsvDuplicateCheck(rowsForDuplicateCheck);

  const resetState = () => {
    setCurrentStep(1);
    setCsvParseResult(null);
    setColumnMapping({});
    setMappedRecords([]);
    setEditedRows(new Map());
    setSkipInvalidRows(false);
    setIsImporting(false);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  };

  const handleMappingComplete = (parseResult: CsvParseResult, mapping: Record<string, string | null>) => {
    setCsvParseResult(parseResult);
    setColumnMapping(mapping);
    const records = applyColumnMapping(parseResult, mapping);
    setMappedRecords(records);
    setCurrentStep(2);
  };

  const handleEditRow = (rowIndex: number, field: string, value: string) => {
    setEditedRows(prev => {
      const next = new Map(prev);
      const existing = next.get(rowIndex) ?? {};
      next.set(rowIndex, { ...existing, [field]: value });
      return next;
    });
  };

  const canProceedToStep3 = () => {
    const errorCount = validatedRows.filter(r => !r.isValid).length;
    return errorCount === 0 || skipInvalidRows;
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const rowsToImport: MappedCustomerRecord[] = [];
      const rowsToUpdate: Array<{ id: string; record: MappedCustomerRecord }> = [];

      for (const row of validatedRows) {
        if (!row.isValid && !skipInvalidRows) continue;
        const mergedRecord: MappedCustomerRecord = {
          ...row.record,
          ...row.editedValues,
          ...(editedRows.get(row.record._rowIndex) ?? {}),
        };
        const dupInfo = duplicateInfos.get(row.record._rowIndex);

        if (dupInfo?.status === 'potential') {
          const action = actions.get(row.record._rowIndex) ?? 'skip';
          if (action === 'skip') continue;
          if (action === 'update_existing' && dupInfo.existingCustomer) {
            rowsToUpdate.push({ id: dupInfo.existingCustomer.id, record: mergedRecord });
            continue;
          }
          // 'import_anyway' falls through to rowsToImport
        }
        rowsToImport.push(mergedRecord);
      }

      if (rowsToImport.length > 0) {
        const inserts = rowsToImport.map(r => recordToSupabaseInsert(r));
        const { error } = await supabase.from('kunden').insert(inserts);
        if (error) throw error;
      }

      const updateErrors: string[] = [];
      for (const { id, record } of rowsToUpdate) {
        const updates = recordToSupabaseInsert(record);
        const { error } = await supabase.from('kunden').update(updates).eq('id', id);
        if (error) {
          const name = `${record.vorname ?? ''} ${record.nachname ?? ''}`.trim();
          updateErrors.push(name || id);
          console.error('[CsvImport] Update-Fehler:', error);
        }
      }
      if (updateErrors.length > 0) {
        toast.warning(`${updateErrors.length} Aktualisierung(en) fehlgeschlagen`, {
          description: updateErrors.slice(0, 3).join(', '),
        });
      }

      queryClient.invalidateQueries({ queryKey: ['customers'] });

      const importedMsg = rowsToImport.length > 0
        ? `${rowsToImport.length} Kunden importiert`
        : 'Keine neuen Kunden importiert';
      const updatedMsg = rowsToUpdate.length > 0
        ? `, ${rowsToUpdate.length} aktualisiert`
        : '';

      toast.success(`${importedMsg}${updatedMsg}`);
      handleClose(false);
    } catch (err) {
      console.error('[CsvImport] Import-Fehler:', err);
      toast.error('Import fehlgeschlagen', {
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kunden aus CSV importieren</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 pb-2">
          {STEP_LABELS.map((label, index) => {
            const step = (index + 1) as 1 | 2 | 3;
            const isActive = currentStep === step;
            const isDone = currentStep > step;
            return (
              <div key={step} className="flex items-center gap-2">
                {index > 0 && (
                  <div className={`h-px w-8 ${isDone ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                )}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isDone
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <span>{step}</span>
                  <span className="hidden sm:inline">{label.replace(/^\d\. /, '')}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="min-h-[300px]">
          {currentStep === 1 && (
            <CsvImportStepMapping onComplete={handleMappingComplete} />
          )}
          {currentStep === 2 && (
            <CsvImportStepValidation
              validatedRows={validatedRows}
              onEdit={handleEditRow}
              skipInvalidRows={skipInvalidRows}
              onSkipInvalidRowsChange={setSkipInvalidRows}
            />
          )}
          {currentStep === 3 && (
            <CsvImportStepDuplicates
              validatedRows={rowsForDuplicateCheck}
              duplicateInfos={duplicateInfos}
              actions={actions}
              onSetAction={setAction}
              onSetAllAction={setAllAction}
            />
          )}
        </div>

        {/* Navigation footer */}
        <div className="flex items-center justify-between border-t pt-4 mt-2">
          <Button
            variant="outline"
            onClick={() => {
              if (currentStep === 1) {
                handleClose(false);
              } else {
                setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3);
              }
            }}
            disabled={isImporting}
          >
            {currentStep === 1 ? 'Abbrechen' : 'Zurück'}
          </Button>

          {currentStep === 2 ? (
            <Button
              onClick={() => {
                if (!canProceedToStep3()) return;
                setCurrentStep(3);
              }}
              disabled={!canProceedToStep3()}
            >
              Weiter zu Duplikaten
            </Button>
          ) : currentStep === 3 ? (
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importiere...
                </>
              ) : (
                'Jetzt importieren'
              )}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
