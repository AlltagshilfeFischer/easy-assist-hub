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
import { useEmployees } from '@/hooks/useEmployees';
import { CsvImportStepMapping } from './CsvImportStepMapping';
import { CsvImportStepValidation } from './CsvImportStepValidation';
import { CsvImportStepDuplicates } from './CsvImportStepDuplicates';

interface CsvImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function recordToSupabaseInsert(
  r: MappedCustomerRecord,
  employeeNameMap?: Map<string, string>,
) {
  // DD.MM.YYYY → YYYY-MM-DD (ISO); YYYY-MM-DD durchreichen; sonst null
  const toIsoDate = (s?: string): string | null => {
    if (!s) return null;
    const de = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (de) return `${de[3]}-${de[2]}-${de[1]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
    return null;
  };

  // Mitarbeiter: Name → ID auflösen
  const maKey = r.mitarbeiter_name?.trim().toLowerCase();
  const mitarbeiterId = maKey && employeeNameMap ? (employeeNameMap.get(maKey) ?? null) : null;

  // Verhinderungspflege: Ja / Nein / Beantragt
  const verhNorm = r.verhinderungspflege?.trim().toLowerCase();
  const verhAktiv = verhNorm === 'ja' ? true : null;
  const verhBeantragt = verhNorm === 'beantragt' ? true : null;

  // Status: Aktiv (default) / Inaktiv — überschreibt kategorie-basierte Logik
  const statusNorm = r.aktiv_status?.trim().toLowerCase();
  const aktiv = statusNorm ? statusNorm !== 'inaktiv' : (!r.kategorie || r.kategorie === 'Kunde');

  // Stunden: deutsches Komma → Punkt
  const stundenRaw = r.stunden_kontingent_monat?.replace(',', '.');

  return {
    vorname: r.vorname?.trim() || null,
    nachname: r.nachname?.trim() || null,
    mitarbeiter: mitarbeiterId,
    pflegegrad: r.pflegegrad != null && r.pflegegrad !== '' ? parseInt(r.pflegegrad, 10) : null,
    strasse: r.strasse?.trim() || null,
    plz: r.plz?.trim() || null,
    stadt: r.stadt?.trim() || null,
    stadtteil: r.stadtteil?.trim() || null,
    adresse: r.adresse?.trim() || null,
    geburtsdatum: toIsoDate(r.geburtsdatum),
    pflegekasse: r.pflegekasse?.trim() || null,
    versichertennummer: r.versichertennummer?.trim() || null,
    verhinderungspflege_aktiv: verhAktiv,
    verhinderungspflege_beantragt: verhBeantragt,
    telefonnr: r.telefonnr?.trim() || null,
    kasse_privat: r.kassen_privat?.trim() || null,
    kopie_lw: r.kopie_lw?.trim() || null,
    aktiv,
    stunden_kontingent_monat: stundenRaw ? parseFloat(stundenRaw) || null : null,
    tage: r.tage?.trim() || null,
    sonstiges: r.sonstiges?.trim() || null,
    angehoerige_ansprechpartner: r.angehoerige_ansprechpartner?.trim() || null,
    eintritt: toIsoDate(r.eintritt),
    austritt: toIsoDate(r.austritt),
    kategorie: r.kategorie || 'Kunde',
    email: r.email?.trim() || null,
    farbe_kalender: '#10B981',
  };
}

const STEP_LABELS = ['1. Spalten zuordnen', '2. Daten prüfen', '3. Duplikate'] as const;

export function CsvImportWizard({ open, onOpenChange }: CsvImportWizardProps) {
  const queryClient = useQueryClient();
  const { data: employees = [] } = useEmployees({ includeInactive: true });

  const employeeNameMap = useMemo(
    () =>
      new Map<string, string>(
        employees.map((e) => [`${e.vorname} ${e.nachname}`.toLowerCase().trim(), e.id]),
      ),
    [employees],
  );

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
        const inserts = rowsToImport.map(r => recordToSupabaseInsert(r, employeeNameMap));
        const { error } = await supabase.from('kunden').insert(inserts);
        if (error) throw error;
      }

      const updateErrors: string[] = [];
      for (const { id, record } of rowsToUpdate) {
        const updates = recordToSupabaseInsert(record, employeeNameMap);
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
      const msg = err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null
          ? (err as Record<string, unknown>).message as string
            ?? (err as Record<string, unknown>).details as string
            ?? JSON.stringify(err)
          : String(err);
      toast.error('Import fehlgeschlagen', { description: msg });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] flex flex-col overflow-hidden p-0">
        <div className="flex flex-col h-full overflow-hidden">
          <div className="px-6 pt-6 pb-2 shrink-0">
            <DialogHeader>
              <DialogTitle>Kunden aus CSV importieren</DialogTitle>
            </DialogHeader>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 py-2 shrink-0">
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
                    <span>{label.replace(/^\d\. /, '')}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Step content — scrollbar hier */}
          <div className="flex-1 overflow-auto px-6 py-2">
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
          <div className="flex items-center justify-between border-t px-6 py-4 shrink-0">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
