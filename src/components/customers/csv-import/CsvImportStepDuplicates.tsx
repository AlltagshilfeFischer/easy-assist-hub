import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { ValidatedRow } from '@/hooks/useCsvImportValidation';
import type { DuplicateInfo, DuplicateAction } from '@/hooks/useCsvDuplicateCheck';

interface CsvImportStepDuplicatesProps {
  validatedRows: ValidatedRow[];
  duplicateInfos: Map<number, DuplicateInfo>;
  actions: Map<number, DuplicateAction>;
  onSetAction: (rowIndex: number, action: DuplicateAction) => void;
  onSetAllAction: (action: DuplicateAction) => void;
  isLoading?: boolean;
}

const ACTION_LABELS: Record<DuplicateAction, string> = {
  skip: 'Überspringen',
  import_anyway: 'Trotzdem importieren',
  update_existing: 'Aktualisieren',
};

export function CsvImportStepDuplicates({
  validatedRows,
  duplicateInfos,
  actions,
  onSetAction,
  onSetAllAction,
  isLoading,
}: CsvImportStepDuplicatesProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Prüfe auf Duplikate...
      </div>
    );
  }

  const duplicateRows = validatedRows.filter(row => {
    const info = duplicateInfos.get(row.record._rowIndex);
    return info?.status === 'potential';
  });

  if (duplicateRows.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-4">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium">Keine Duplikate gefunden</p>
          <p className="text-green-600 mt-0.5">Alle Zeilen können importiert werden</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-medium text-amber-700">
          {duplicateRows.length} mögliche{duplicateRows.length !== 1 ? ' Duplikate' : 's Duplikat'} gefunden
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSetAllAction('skip')}
          >
            Alle überspringen
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSetAllAction('update_existing')}
            className="text-blue-700 border-blue-300 hover:bg-blue-50"
          >
            Alle aktualisieren
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSetAllAction('import_anyway')}
          >
            Alle neu importieren
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {duplicateRows.map(row => {
          const rowIndex = row.record._rowIndex;
          const info = duplicateInfos.get(rowIndex);
          const currentAction = actions.get(rowIndex) ?? 'skip';

          const csvVorname = row.editedValues.vorname ?? row.record.vorname ?? '';
          const csvNachname = row.editedValues.nachname ?? row.record.nachname ?? '';
          const csvGeburtsdatum = row.editedValues.geburtsdatum ?? row.record.geburtsdatum ?? '';
          const csvStrasse = row.editedValues.strasse ?? row.record.strasse ?? '';

          const existing = info?.existingCustomer;

          return (
            <div key={rowIndex} className="rounded-md border overflow-hidden">
              <div className="grid grid-cols-2 divide-x">
                <div className="p-3 bg-blue-50">
                  <p className="text-xs font-medium text-blue-700 mb-1">CSV-Zeile {rowIndex + 1}</p>
                  <p className="text-sm font-medium">{csvVorname} {csvNachname}</p>
                  {csvGeburtsdatum && (
                    <p className="text-xs text-muted-foreground">{csvGeburtsdatum}</p>
                  )}
                  {csvStrasse && (
                    <p className="text-xs text-muted-foreground">{csvStrasse}</p>
                  )}
                </div>
                <div className="p-3 bg-amber-50">
                  <p className="text-xs font-medium text-amber-700 mb-1">Bestehender Eintrag</p>
                  {existing ? (
                    <>
                      <p className="text-sm font-medium">
                        {existing.vorname} {existing.nachname}
                      </p>
                      {existing.geburtsdatum && (
                        <p className="text-xs text-muted-foreground">
                          {existing.geburtsdatum}
                        </p>
                      )}
                      {existing.strasse && (
                        <p className="text-xs text-muted-foreground">{existing.strasse}</p>
                      )}
                      {existing.telefonnr && (
                        <p className="text-xs text-muted-foreground">{existing.telefonnr}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Details nicht verfügbar</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 p-3 bg-muted/30 border-t">
                {(['skip', 'import_anyway', 'update_existing'] as DuplicateAction[]).map(action => (
                  <Button
                    key={action}
                    size="sm"
                    variant={currentAction === action ? 'default' : 'outline'}
                    onClick={() => onSetAction(rowIndex, action)}
                    className={
                      currentAction === action && action === 'skip'
                        ? 'bg-slate-700 hover:bg-slate-800'
                        : currentAction === action && action === 'update_existing'
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : undefined
                    }
                  >
                    {ACTION_LABELS[action]}
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
