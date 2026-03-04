import { SmartDataImport, ColumnConfig, DataRow } from './SmartDataImport';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface MitarbeiterRow extends DataRow {
  vorname: string;
  nachname: string;
  telefon: string;
  strasse: string;
  plz: string;
  stadt: string;
  zustaendigkeitsbereich: string;
  soll_wochenstunden: string;
  qualification: string;
  employment_type: string;
}

const COLUMNS: ColumnConfig[] = [
  { key: 'vorname', label: 'Vorname', required: true, width: 120 },
  { key: 'nachname', label: 'Nachname', required: true, width: 120 },
  { key: 'telefon', label: 'Telefon', required: false, width: 130 },
  { key: 'strasse', label: 'Straße', required: false, width: 150 },
  { key: 'plz', label: 'PLZ', required: false, width: 80,
    validate: (value) => {
      if (value && !/^\d{5}$/.test(value)) return 'PLZ 5 Ziffern';
      return null;
    }
  },
  { key: 'stadt', label: 'Stadt', required: false, width: 120 },
  { key: 'zustaendigkeitsbereich', label: 'Bereich', required: false, width: 120, hint: 'Stadtteil/Gebiet' },
  { key: 'soll_wochenstunden', label: 'Std/Woche', required: false, width: 90, hint: 'z.B. 30',
    validate: (value) => {
      if (value && (isNaN(Number(value)) || Number(value) < 0 || Number(value) > 60)) return 'Zahl 0-60';
      return null;
    }
  },
  { key: 'qualification', label: 'Qualifikation', required: false, width: 130, hint: 'z.B. Pflegefachkraft' },
  { key: 'employment_type', label: 'Beschäftigung', required: false, width: 120, hint: 'Vollzeit/Teilzeit/Minijob' },
];

const createEmptyRow = (): MitarbeiterRow => ({
  id: crypto.randomUUID(),
  vorname: '',
  nachname: '',
  telefon: '',
  strasse: '',
  plz: '',
  stadt: '',
  zustaendigkeitsbereich: '',
  soll_wochenstunden: '',
  qualification: '',
  employment_type: '',
  errors: [],
});

interface MitarbeiterSmartImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function MitarbeiterSmartImport({ open, onOpenChange, onSuccess }: MitarbeiterSmartImportProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleImport = async (rows: MitarbeiterRow[]) => {
    // Duplikat-Check gegen DB
    const { data: existing } = await supabase
      .from('mitarbeiter')
      .select('vorname, nachname');

    const existingKeys = new Set(
      (existing ?? []).map(m =>
        `${(m.vorname || '').trim().toLowerCase()}|${(m.nachname || '').trim().toLowerCase()}`
      )
    );

    const seenInBatch = new Set<string>();
    const duplicates: string[] = [];
    const uniqueRows: typeof rows = [];

    for (const row of rows) {
      const key = `${row.vorname.trim().toLowerCase()}|${row.nachname.trim().toLowerCase()}`;
      if (existingKeys.has(key) || seenInBatch.has(key)) {
        duplicates.push(`${row.vorname} ${row.nachname}`);
      } else {
        seenInBatch.add(key);
        uniqueRows.push(row);
      }
    }

    if (duplicates.length > 0) {
      toast({
        title: `${duplicates.length} Duplikat(e) übersprungen`,
        description: duplicates.slice(0, 5).join(', ') + (duplicates.length > 5 ? ` und ${duplicates.length - 5} weitere` : ''),
        variant: 'destructive',
      });
    }

    if (uniqueRows.length === 0) {
      throw new Error('Alle Einträge sind bereits vorhanden.');
    }

    const mitarbeiterToInsert = uniqueRows.map(row => ({
      vorname: row.vorname.trim(),
      nachname: row.nachname.trim(),
      telefon: row.telefon?.trim() || null,
      strasse: row.strasse?.trim() || null,
      plz: row.plz?.trim() || null,
      stadt: row.stadt?.trim() || null,
      zustaendigkeitsbereich: row.zustaendigkeitsbereich?.trim() || null,
      soll_wochenstunden: row.soll_wochenstunden ? parseFloat(row.soll_wochenstunden) : null,
      qualification: row.qualification?.trim() || null,
      employment_type: row.employment_type?.trim() || null,
      ist_aktiv: true,
    }));

    const { error } = await supabase
      .from('mitarbeiter')
      .insert(mitarbeiterToInsert);

    if (error) throw error;

    queryClient.invalidateQueries({ queryKey: ['mitarbeiter'] });
    onSuccess?.();
  };

  const ImportComponent = SmartDataImport<MitarbeiterRow>;

  return (
    <ImportComponent
      open={open}
      onOpenChange={onOpenChange}
      title="Mitarbeiter anlegen / importieren"
      description="Mitarbeiter direkt in der Tabelle anlegen, aus Excel/CSV einfügen oder per KI aus Freitext importieren. Unterstützt 500+ Einträge."
      columns={COLUMNS}
      onImport={handleImport}
      createEmptyRow={createEmptyRow}
      initialRowCount={50}
      batchSize={200}
      aiParseFunction="parse-mitarbeiter-text"
      aiParseResultKey="mitarbeiter"
    />
  );
}
