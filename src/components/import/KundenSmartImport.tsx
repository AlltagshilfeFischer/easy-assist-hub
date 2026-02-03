import { SmartDataImport, ColumnConfig, DataRow } from './SmartDataImport';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface KundenRow extends DataRow {
  vorname: string;
  nachname: string;
  telefonnr: string;
  email: string;
  strasse: string;
  plz: string;
  stadt: string;
  stadtteil: string;
  geburtsdatum: string;
  pflegegrad: string;
  kategorie: string;
  pflegekasse: string;
  versichertennummer: string;
}

const COLUMNS: ColumnConfig[] = [
  { key: 'vorname', label: 'Vorname', required: true, width: 120 },
  { key: 'nachname', label: 'Nachname', required: true, width: 120 },
  { key: 'telefonnr', label: 'Telefon', required: false, width: 130 },
  { key: 'email', label: 'E-Mail', required: false, width: 180,
    validate: (value) => {
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return 'Ungültige E-Mail';
      }
      return null;
    }
  },
  { key: 'strasse', label: 'Straße', required: false, width: 150 },
  { key: 'plz', label: 'PLZ', required: false, width: 80,
    validate: (value) => {
      if (value && !/^\d{5}$/.test(value)) {
        return 'PLZ 5 Ziffern';
      }
      return null;
    }
  },
  { key: 'stadt', label: 'Stadt', required: false, width: 120 },
  { key: 'stadtteil', label: 'Stadtteil', required: false, width: 100 },
  { key: 'geburtsdatum', label: 'Geburtsdatum', required: false, width: 120, hint: 'TT.MM.JJJJ',
    validate: (value) => {
      if (value && !value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)) {
        return 'Datum: TT.MM.JJJJ';
      }
      return null;
    }
  },
  { key: 'pflegegrad', label: 'Pflegegrad', required: false, width: 90, hint: '0-5',
    validate: (value) => {
      if (value && (isNaN(Number(value)) || Number(value) < 0 || Number(value) > 5)) {
        return 'Pflegegrad 0-5';
      }
      return null;
    }
  },
  { key: 'kategorie', label: 'Kategorie', required: false, width: 110, hint: 'Kunde/Interessent' },
  { key: 'pflegekasse', label: 'Pflegekasse', required: false, width: 120 },
  { key: 'versichertennummer', label: 'Versichertennr.', required: false, width: 130 },
];

const createEmptyRow = (): KundenRow => ({
  id: crypto.randomUUID(),
  vorname: '',
  nachname: '',
  telefonnr: '',
  email: '',
  strasse: '',
  plz: '',
  stadt: '',
  stadtteil: '',
  geburtsdatum: '',
  pflegegrad: '',
  kategorie: '',
  pflegekasse: '',
  versichertennummer: '',
  errors: [],
});

const parseGermanDate = (dateStr: string): string | null => {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
};

interface KundenSmartImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KundenSmartImport({ open, onOpenChange }: KundenSmartImportProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleImport = async (rows: KundenRow[]) => {
    const customersToInsert = rows.map(row => ({
      vorname: row.vorname.trim(),
      nachname: row.nachname.trim(),
      telefonnr: row.telefonnr?.trim() || null,
      email: row.email?.trim() || null,
      strasse: row.strasse?.trim() || null,
      plz: row.plz?.trim() || null,
      stadt: row.stadt?.trim() || null,
      stadtteil: row.stadtteil?.trim() || null,
      geburtsdatum: parseGermanDate(row.geburtsdatum),
      pflegegrad: row.pflegegrad ? parseInt(row.pflegegrad, 10) : null,
      kategorie: row.kategorie || 'Kunde',
      pflegekasse: row.pflegekasse?.trim() || null,
      versichertennummer: row.versichertennummer?.trim() || null,
      aktiv: true,
      eintritt: new Date().toISOString().slice(0, 10),
    }));

    const { error } = await supabase
      .from('kunden')
      .insert(customersToInsert);
    
    if (error) throw error;

    queryClient.invalidateQueries({ queryKey: ['customers'] });
  };

  return (
    <SmartDataImport<KundenRow>
      open={open}
      onOpenChange={onOpenChange}
      title="Kunden importieren"
      description="Importieren Sie Kunden aus Excel, CSV oder als Freitext. Die Daten werden automatisch erkannt und können vor dem Import korrigiert werden."
      columns={COLUMNS}
      onImport={handleImport}
      createEmptyRow={createEmptyRow}
      initialRowCount={20}
      batchSize={200} // Larger batches for customers
    />
  );
}
