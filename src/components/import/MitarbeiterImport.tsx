import { SmartDataImport, ColumnConfig, DataRow } from './SmartDataImport';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface MitarbeiterRow extends DataRow {
  vorname: string;
  nachname: string;
  email: string;
  telefon: string;
  strasse: string;
  plz: string;
  stadt: string;
  soll_wochenstunden: string;
}

const COLUMNS: ColumnConfig[] = [
  { 
    key: 'vorname', 
    label: 'Vorname', 
    required: true, 
    width: 120 
  },
  { 
    key: 'nachname', 
    label: 'Nachname', 
    required: true, 
    width: 120 
  },
  { 
    key: 'email', 
    label: 'E-Mail', 
    required: true, 
    width: 200,
    validate: (value) => {
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return 'Ungültige E-Mail';
      }
      return null;
    }
  },
  { 
    key: 'telefon', 
    label: 'Telefon', 
    required: false, 
    width: 130 
  },
  { 
    key: 'strasse', 
    label: 'Straße', 
    required: false, 
    width: 150 
  },
  { 
    key: 'plz', 
    label: 'PLZ', 
    required: false, 
    width: 80,
    validate: (value) => {
      if (value && !/^\d{5}$/.test(value)) {
        return 'PLZ muss 5 Ziffern haben';
      }
      return null;
    }
  },
  { 
    key: 'stadt', 
    label: 'Stadt', 
    required: false, 
    width: 120 
  },
  { 
    key: 'soll_wochenstunden', 
    label: 'Soll-Stunden/Woche', 
    required: false, 
    width: 130,
    hint: 'z.B. 40',
    validate: (value) => {
      if (value && (isNaN(Number(value)) || Number(value) < 0 || Number(value) > 60)) {
        return 'Stunden 0-60';
      }
      return null;
    }
  },
];

const createEmptyRow = (): MitarbeiterRow => ({
  id: crypto.randomUUID(),
  vorname: '',
  nachname: '',
  email: '',
  telefon: '',
  strasse: '',
  plz: '',
  stadt: '',
  soll_wochenstunden: '',
  errors: [],
});

interface MitarbeiterImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MitarbeiterImport({ open, onOpenChange }: MitarbeiterImportProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleImport = async (rows: MitarbeiterRow[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('Nicht authentifiziert');
    }

    // Process each employee via the invite-mitarbeiter edge function
    const results = [];
    const errors = [];

    for (const row of rows) {
      try {
        const { data, error } = await supabase.functions.invoke('invite-mitarbeiter', {
          body: {
            email: row.email.trim(),
            vorname: row.vorname.trim(),
            nachname: row.nachname.trim(),
            telefon: row.telefon?.trim() || null,
            strasse: row.strasse?.trim() || null,
            plz: row.plz?.trim() || null,
            stadt: row.stadt?.trim() || null,
            soll_wochenstunden: row.soll_wochenstunden ? parseFloat(row.soll_wochenstunden) : null,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (error) throw error;
        results.push(row);
      } catch (error: any) {
        errors.push({ row, error: error.message });
      }
    }

    if (errors.length > 0) {
      toast({
        title: 'Teilweiser Import',
        description: `${results.length} erfolgreich, ${errors.length} fehlgeschlagen`,
        variant: 'destructive',
      });
    }

    queryClient.invalidateQueries({ queryKey: ['mitarbeiter'] });
  };

  return (
    <SmartDataImport<MitarbeiterRow>
      open={open}
      onOpenChange={onOpenChange}
      title="Mitarbeiter importieren"
      description="Importieren Sie Mitarbeiter aus Excel, CSV oder als Freitext. Jeder Mitarbeiter erhält automatisch eine Einladungs-E-Mail."
      columns={COLUMNS}
      onImport={handleImport}
      createEmptyRow={createEmptyRow}
      initialRowCount={10}
      batchSize={50} // Process employees in smaller batches due to email sending
    />
  );
}
