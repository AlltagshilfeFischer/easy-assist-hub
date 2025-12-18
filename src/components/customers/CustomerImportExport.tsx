import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Upload, AlertCircle, Check, Plus, Trash2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface CustomerRow {
  id: string;
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
  errors: string[];
}

interface CustomerImportExportProps {
  customers: any[];
}

const COLUMNS = [
  { key: 'vorname', label: 'Vorname', required: true, width: 120 },
  { key: 'nachname', label: 'Nachname', required: true, width: 120 },
  { key: 'telefonnr', label: 'Telefon', required: false, width: 130 },
  { key: 'email', label: 'E-Mail', required: false, width: 180 },
  { key: 'strasse', label: 'Straße', required: false, width: 150 },
  { key: 'plz', label: 'PLZ', required: false, width: 80 },
  { key: 'stadt', label: 'Stadt', required: false, width: 120 },
  { key: 'stadtteil', label: 'Stadtteil', required: false, width: 100 },
  { key: 'geburtsdatum', label: 'Geburtsdatum', required: false, width: 120, hint: 'TT.MM.JJJJ' },
  { key: 'pflegegrad', label: 'Pflegegrad', required: false, width: 90, hint: '0-5' },
  { key: 'kategorie', label: 'Kategorie', required: false, width: 110, hint: 'Kunde/Interessent' },
  { key: 'pflegekasse', label: 'Pflegekasse', required: false, width: 120 },
  { key: 'versichertennummer', label: 'Versichertennr.', required: false, width: 130 },
];

const createEmptyRow = (): CustomerRow => ({
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
  kategorie: 'Kunde',
  pflegekasse: '',
  versichertennummer: '',
  errors: [],
});

export function CustomerImportExport({ customers }: CustomerImportExportProps) {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [rows, setRows] = useState<CustomerRow[]>([createEmptyRow(), createEmptyRow(), createEmptyRow(), createEmptyRow(), createEmptyRow()]);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tableRef = useRef<HTMLDivElement>(null);

  const validateRow = (row: CustomerRow): string[] => {
    const errors: string[] = [];
    
    if (!row.vorname.trim()) {
      errors.push('Vorname ist erforderlich');
    }
    
    if (!row.nachname.trim()) {
      errors.push('Nachname ist erforderlich');
    }
    
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errors.push('Ungültige E-Mail-Adresse');
    }
    
    if (row.pflegegrad && (isNaN(Number(row.pflegegrad)) || Number(row.pflegegrad) < 0 || Number(row.pflegegrad) > 5)) {
      errors.push('Pflegegrad muss zwischen 0 und 5 liegen');
    }
    
    if (row.plz && !/^\d{5}$/.test(row.plz)) {
      errors.push('PLZ muss 5 Ziffern haben');
    }
    
    if (row.geburtsdatum) {
      const dateRegex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
      const match = row.geburtsdatum.match(dateRegex);
      if (!match) {
        errors.push('Geburtsdatum: Format TT.MM.JJJJ');
      } else {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const year = parseInt(match[3], 10);
        const date = new Date(year, month - 1, day);
        if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
          errors.push('Ungültiges Geburtsdatum');
        }
      }
    }
    
    if (row.kategorie && !['Kunde', 'Interessent'].includes(row.kategorie)) {
      errors.push('Kategorie muss "Kunde" oder "Interessent" sein');
    }
    
    return errors;
  };

  const updateRow = (id: string, key: string, value: string) => {
    setRows(prev => prev.map(row => {
      if (row.id === id) {
        const updated = { ...row, [key]: value };
        updated.errors = validateRow(updated);
        return updated;
      }
      return row;
    }));
  };

  const addRow = () => {
    setRows(prev => [...prev, createEmptyRow()]);
  };

  const removeRow = (id: string) => {
    setRows(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(row => row.id !== id);
    });
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData.getData('text');
    if (!clipboardData) return;
    
    const lines = clipboardData.split('\n').filter(line => line.trim());
    if (lines.length === 0) return;
    
    e.preventDefault();
    
    const newRows: CustomerRow[] = lines.map(line => {
      const cells = line.split('\t');
      const row = createEmptyRow();
      
      COLUMNS.forEach((col, index) => {
        if (cells[index]) {
          (row as any)[col.key] = cells[index].trim();
        }
      });
      
      // Default kategorie if not set
      if (!row.kategorie) {
        row.kategorie = 'Kunde';
      }
      
      row.errors = validateRow(row);
      return row;
    });
    
    setRows(newRows);
    
    toast({
      title: 'Daten eingefügt',
      description: `${newRows.length} Zeile(n) aus der Zwischenablage eingefügt`,
    });
  }, [toast]);

  const hasValidRows = rows.some(row => 
    row.vorname.trim() && row.nachname.trim() && row.errors.length === 0
  );

  const validRowCount = rows.filter(row => 
    row.vorname.trim() && row.nachname.trim() && row.errors.length === 0
  ).length;

  const errorRowCount = rows.filter(row => 
    (row.vorname.trim() || row.nachname.trim()) && row.errors.length > 0
  ).length;

  const parseGermanDate = (dateStr: string): string | null => {
    if (!dateStr) return null;
    const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  };

  const handleImport = async () => {
    const validRows = rows.filter(row => 
      row.vorname.trim() && row.nachname.trim() && row.errors.length === 0
    );

    if (validRows.length === 0) {
      toast({
        title: 'Keine gültigen Daten',
        description: 'Bitte korrigieren Sie die Fehler oder fügen Sie gültige Daten ein.',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);

    try {
      const customersToInsert = validRows.map(row => ({
        vorname: row.vorname.trim(),
        nachname: row.nachname.trim(),
        telefonnr: row.telefonnr.trim() || null,
        email: row.email.trim() || null,
        strasse: row.strasse.trim() || null,
        plz: row.plz.trim() || null,
        stadt: row.stadt.trim() || null,
        stadtteil: row.stadtteil.trim() || null,
        geburtsdatum: parseGermanDate(row.geburtsdatum),
        pflegegrad: row.pflegegrad ? parseInt(row.pflegegrad, 10) : null,
        kategorie: row.kategorie || 'Kunde',
        pflegekasse: row.pflegekasse.trim() || null,
        versichertennummer: row.versichertennummer.trim() || null,
        aktiv: true,
        eintritt: new Date().toISOString().slice(0, 10),
      }));

      const { error } = await supabase.from('kunden').insert(customersToInsert);

      if (error) throw error;

      toast({
        title: 'Import erfolgreich',
        description: `${customersToInsert.length} Kunde(n) wurden importiert.`,
      });

      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowImportDialog(false);
      setRows([createEmptyRow(), createEmptyRow(), createEmptyRow(), createEmptyRow(), createEmptyRow()]);
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: 'Import fehlgeschlagen',
        description: error.message || 'Beim Import ist ein Fehler aufgetreten.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = () => {
    if (!customers || customers.length === 0) {
      toast({
        title: 'Keine Daten',
        description: 'Es gibt keine Kunden zum Exportieren.',
        variant: 'destructive',
      });
      return;
    }

    const headers = COLUMNS.map(col => col.label).join('\t');
    
    const dataRows = customers.map((customer: any) => {
      return COLUMNS.map(col => {
        const value = customer[col.key];
        if (col.key === 'geburtsdatum' && value) {
          const date = new Date(value);
          return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
        }
        return value ?? '';
      }).join('\t');
    }).join('\n');

    const csvContent = `${headers}\n${dataRows}`;
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kunden_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast({
      title: 'Export erfolgreich',
      description: `${customers.length} Kunde(n) wurden exportiert.`,
    });
  };

  const clearAll = () => {
    setRows([createEmptyRow(), createEmptyRow(), createEmptyRow(), createEmptyRow(), createEmptyRow()]);
  };

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-[95vw] w-full max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Kunden importieren</DialogTitle>
            <DialogDescription>
              Fügen Sie Kundendaten ein oder geben Sie sie manuell ein. Sie können auch direkt aus Excel kopieren und hier einfügen (Strg+V).
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-4 flex-wrap text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                * Pflichtfeld
              </Badge>
            </div>
            {validRowCount > 0 && (
              <div className="flex items-center gap-1 text-green-600">
                <Check className="h-4 w-4" />
                {validRowCount} gültige Zeile(n)
              </div>
            )}
            {errorRowCount > 0 && (
              <div className="flex items-center gap-1 text-red-600">
                <AlertCircle className="h-4 w-4" />
                {errorRowCount} Zeile(n) mit Fehlern
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X className="h-4 w-4 mr-1" />
              Alles löschen
            </Button>
          </div>

          <ScrollArea className="flex-1 border rounded-md">
            <div 
              ref={tableRef}
              className="min-w-max"
              onPaste={handlePaste}
              tabIndex={0}
            >
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr>
                    <th className="p-2 w-10"></th>
                    {COLUMNS.map(col => (
                      <th 
                        key={col.key} 
                        className="p-2 text-left font-medium whitespace-nowrap"
                        style={{ minWidth: col.width }}
                      >
                        {col.label}
                        {col.required && <span className="text-red-500 ml-1">*</span>}
                        {col.hint && (
                          <span className="text-muted-foreground text-xs block font-normal">
                            {col.hint}
                          </span>
                        )}
                      </th>
                    ))}
                    <th className="p-2 w-20">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => {
                    const hasContent = row.vorname.trim() || row.nachname.trim();
                    const hasErrors = row.errors.length > 0;
                    const isValid = hasContent && !hasErrors;
                    
                    return (
                      <tr 
                        key={row.id} 
                        className={`border-b hover:bg-muted/30 ${hasErrors && hasContent ? 'bg-red-50/50' : ''} ${isValid ? 'bg-green-50/50' : ''}`}
                      >
                        <td className="p-1 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => removeRow(row.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                        {COLUMNS.map(col => (
                          <td key={col.key} className="p-1">
                            {col.key === 'kategorie' ? (
                              <Select
                                value={row.kategorie || 'Kunde'}
                                onValueChange={(value) => updateRow(row.id, 'kategorie', value)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Kunde">Kunde</SelectItem>
                                  <SelectItem value="Interessent">Interessent</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : col.key === 'pflegegrad' ? (
                              <Select
                                value={row.pflegegrad || ''}
                                onValueChange={(value) => updateRow(row.id, 'pflegegrad', value)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">-</SelectItem>
                                  {[0, 1, 2, 3, 4, 5].map(grade => (
                                    <SelectItem key={grade} value={grade.toString()}>{grade}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                value={(row as any)[col.key] || ''}
                                onChange={(e) => updateRow(row.id, col.key, e.target.value)}
                                className={`h-8 text-xs ${col.required && !(row as any)[col.key]?.trim() && hasContent ? 'border-red-300' : ''}`}
                                placeholder={col.hint || ''}
                              />
                            )}
                          </td>
                        ))}
                        <td className="p-1">
                          {hasContent && (
                            <div className="flex items-center justify-center">
                              {isValid ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <div className="group relative">
                                  <AlertCircle className="h-4 w-4 text-red-500 cursor-help" />
                                  <div className="absolute right-0 top-6 z-20 hidden group-hover:block bg-popover border rounded-md p-2 shadow-lg min-w-[200px]">
                                    <ul className="text-xs text-red-600 space-y-1">
                                      {row.errors.map((err, i) => (
                                        <li key={i}>• {err}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ScrollArea>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4 mr-1" />
              Zeile hinzufügen
            </Button>
            <span className="text-xs text-muted-foreground">
              Tipp: Kopieren Sie Daten aus Excel und fügen Sie sie mit Strg+V ein
            </span>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={!hasValidRows || isImporting}
            >
              {isImporting ? 'Importiere...' : `${validRowCount} Kunde(n) importieren`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
