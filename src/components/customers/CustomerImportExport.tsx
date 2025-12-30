import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Upload, AlertCircle, Check, Plus, Trash2, X, Sparkles, Loader2, Edit2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TimeWindow {
  wochentag: number;
  von: string;
  bis: string;
}

interface CustomerTimeWindows {
  customerId: string;
  customerName: string;
  originalText: string;
  windows: TimeWindow[];
  loading?: boolean;
  error?: string;
}

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
  zeitfenster_text: string;
  errors: string[];
}

const WEEKDAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

interface CustomerImportExportProps {
  customers: any[];
}

interface CellPosition {
  row: number;
  col: number;
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
  { key: 'zeitfenster_text', label: 'Zeitfenster (KI)', required: false, width: 200, hint: 'z.B. Mo-Fr 8-12', isAI: true },
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
  kategorie: '',
  pflegekasse: '',
  versichertennummer: '',
  zeitfenster_text: '',
  errors: [],
});

const createInitialRows = (count: number) => Array.from({ length: count }, createEmptyRow);

export function CustomerImportExport({ customers }: CustomerImportExportProps) {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [rows, setRows] = useState<CustomerRow[]>(createInitialRows(20));
  const [isImporting, setIsImporting] = useState(false);
  const [activeCell, setActiveCell] = useState<CellPosition | null>(null);
  const [selectionStart, setSelectionStart] = useState<CellPosition | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<CellPosition | null>(null);
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [editValue, setEditValue] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tableRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // State for AI time window processing
  const [showTimeWindowDialog, setShowTimeWindowDialog] = useState(false);
  const [timeWindowSuggestions, setTimeWindowSuggestions] = useState<CustomerTimeWindows[]>([]);
  const [processingTimeWindows, setProcessingTimeWindows] = useState(false);
  const [editingTimeWindow, setEditingTimeWindow] = useState<{customerIndex: number; windowIndex: number} | null>(null);
  const [editTimeWindowForm, setEditTimeWindowForm] = useState<TimeWindow | null>(null);
  const [insertedCustomerIds, setInsertedCustomerIds] = useState<Map<string, string>>(new Map());

  // Focus input when editing
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const validateRow = (row: CustomerRow): string[] => {
    const errors: string[] = [];
    if (!row.vorname.trim()) errors.push('Vorname erforderlich');
    if (!row.nachname.trim()) errors.push('Nachname erforderlich');
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push('Ungültige E-Mail');
    if (row.pflegegrad && (isNaN(Number(row.pflegegrad)) || Number(row.pflegegrad) < 0 || Number(row.pflegegrad) > 5)) errors.push('Pflegegrad 0-5');
    if (row.plz && !/^\d{5}$/.test(row.plz)) errors.push('PLZ 5 Ziffern');
    if (row.geburtsdatum) {
      const match = row.geburtsdatum.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (!match) errors.push('Datum: TT.MM.JJJJ');
    }
    return errors;
  };

  const updateCell = (rowIndex: number, colKey: string, value: string) => {
    setRows(prev => prev.map((row, i) => {
      if (i === rowIndex) {
        const updated = { ...row, [colKey]: value };
        updated.errors = validateRow(updated);
        return updated;
      }
      return row;
    }));
  };

  const getSelection = (): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null => {
    if (!selectionStart || !selectionEnd) return null;
    return {
      minRow: Math.min(selectionStart.row, selectionEnd.row),
      maxRow: Math.max(selectionStart.row, selectionEnd.row),
      minCol: Math.min(selectionStart.col, selectionEnd.col),
      maxCol: Math.max(selectionStart.col, selectionEnd.col),
    };
  };

  const isCellSelected = (row: number, col: number): boolean => {
    const sel = getSelection();
    if (!sel) return false;
    return row >= sel.minRow && row <= sel.maxRow && col >= sel.minCol && col <= sel.maxCol;
  };

  const isCellActive = (row: number, col: number): boolean => {
    return activeCell?.row === row && activeCell?.col === col;
  };

  const handleCellClick = (row: number, col: number, e: React.MouseEvent) => {
    if (e.shiftKey && activeCell) {
      // Extend selection
      setSelectionEnd({ row, col });
    } else {
      // Single select
      setActiveCell({ row, col });
      setSelectionStart({ row, col });
      setSelectionEnd({ row, col });
    }
    setEditingCell(null);
  };

  const handleCellDoubleClick = (row: number, col: number) => {
    setEditingCell({ row, col });
    setEditValue((rows[row] as any)[COLUMNS[col].key] || '');
  };

  const commitEdit = () => {
    if (editingCell) {
      updateCell(editingCell.row, COLUMNS[editingCell.col].key, editValue);
      setEditingCell(null);
    }
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!activeCell) return;

    // Handle editing mode
    if (editingCell) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
        // Move down
        if (activeCell.row < rows.length - 1) {
          const newPos = { row: activeCell.row + 1, col: activeCell.col };
          setActiveCell(newPos);
          setSelectionStart(newPos);
          setSelectionEnd(newPos);
        }
      } else if (e.key === 'Escape') {
        setEditingCell(null);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitEdit();
        const newCol = e.shiftKey ? activeCell.col - 1 : activeCell.col + 1;
        if (newCol >= 0 && newCol < COLUMNS.length) {
          const newPos = { row: activeCell.row, col: newCol };
          setActiveCell(newPos);
          setSelectionStart(newPos);
          setSelectionEnd(newPos);
        }
      }
      return;
    }

    // Navigation in non-editing mode
    let newRow = activeCell.row;
    let newCol = activeCell.col;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        newRow = Math.max(0, activeCell.row - 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        newRow = Math.min(rows.length - 1, activeCell.row + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newCol = Math.max(0, activeCell.col - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        newCol = Math.min(COLUMNS.length - 1, activeCell.col + 1);
        break;
      case 'Tab':
        e.preventDefault();
        newCol = e.shiftKey ? activeCell.col - 1 : activeCell.col + 1;
        if (newCol < 0) {
          newCol = COLUMNS.length - 1;
          newRow = Math.max(0, activeCell.row - 1);
        } else if (newCol >= COLUMNS.length) {
          newCol = 0;
          newRow = Math.min(rows.length - 1, activeCell.row + 1);
        }
        break;
      case 'Enter':
        e.preventDefault();
        handleCellDoubleClick(activeCell.row, activeCell.col);
        return;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        // Clear selected cells
        const sel = getSelection();
        if (sel) {
          setRows(prev => prev.map((row, ri) => {
            if (ri >= sel.minRow && ri <= sel.maxRow) {
              const updated = { ...row };
              for (let ci = sel.minCol; ci <= sel.maxCol; ci++) {
                (updated as any)[COLUMNS[ci].key] = '';
              }
              updated.errors = validateRow(updated);
              return updated;
            }
            return row;
          }));
        }
        return;
      case 'F2':
        e.preventDefault();
        handleCellDoubleClick(activeCell.row, activeCell.col);
        return;
      default:
        // Start typing to edit
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          setEditingCell(activeCell);
          setEditValue(e.key);
          return;
        }
    }

    const newPos = { row: newRow, col: newCol };
    if (e.shiftKey && (e.key.startsWith('Arrow'))) {
      setSelectionEnd(newPos);
    } else {
      setSelectionStart(newPos);
      setSelectionEnd(newPos);
    }
    setActiveCell(newPos);
  }, [activeCell, editingCell, rows, editValue]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData.getData('text');
    if (!clipboardData) return;
    e.preventDefault();

    const lines = clipboardData.split('\n').filter(line => line.trim());
    if (lines.length === 0) return;

    const startRow = activeCell?.row ?? 0;
    const startCol = activeCell?.col ?? 0;

    setRows(prev => {
      const newRows = [...prev];
      
      // Ensure we have enough rows
      while (newRows.length < startRow + lines.length) {
        newRows.push(createEmptyRow());
      }

      lines.forEach((line, lineIndex) => {
        const cells = line.split('\t');
        const rowIndex = startRow + lineIndex;
        
        cells.forEach((cellValue, cellIndex) => {
          const colIndex = startCol + cellIndex;
          if (colIndex < COLUMNS.length && rowIndex < newRows.length) {
            (newRows[rowIndex] as any)[COLUMNS[colIndex].key] = cellValue.trim();
          }
        });
        
        newRows[rowIndex].errors = validateRow(newRows[rowIndex]);
      });

      return newRows;
    });

    toast({
      title: 'Daten eingefügt',
      description: `${lines.length} Zeile(n) eingefügt`,
    });
  }, [activeCell, toast]);

  const addRows = (count: number) => {
    setRows(prev => [...prev, ...createInitialRows(count)]);
  };

  const removeRow = (index: number) => {
    setRows(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearAll = () => {
    setRows(createInitialRows(20));
    setActiveCell(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    setEditingCell(null);
  };

  const validRowCount = rows.filter(row => 
    row.vorname.trim() && row.nachname.trim() && row.errors.length === 0
  ).length;

  const errorRowCount = rows.filter(row => 
    (row.vorname.trim() || row.nachname.trim()) && row.errors.length > 0
  ).length;

  const hasValidRows = validRowCount > 0;

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
      toast({ title: 'Keine gültigen Daten', variant: 'destructive' });
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

      const { data: insertedData, error } = await supabase
        .from('kunden')
        .insert(customersToInsert)
        .select('id, vorname, nachname');
      
      if (error) throw error;

      // Map row IDs to inserted customer IDs
      const customerIdMap = new Map<string, string>();
      validRows.forEach((row, idx) => {
        if (insertedData && insertedData[idx]) {
          customerIdMap.set(row.id, insertedData[idx].id);
        }
      });
      setInsertedCustomerIds(customerIdMap);

      // Check if any rows have time window text
      const rowsWithTimeWindows = validRows.filter(row => row.zeitfenster_text.trim());
      
      if (rowsWithTimeWindows.length > 0) {
        toast({
          title: 'Kunden importiert',
          description: `${customersToInsert.length} Kunde(n) importiert. Verarbeite Zeitfenster...`,
        });
        
        // Start AI time window processing
        await processTimeWindows(rowsWithTimeWindows, customerIdMap, insertedData || []);
      } else {
        toast({
          title: 'Import erfolgreich',
          description: `${customersToInsert.length} Kunde(n) importiert.`,
        });
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        setShowImportDialog(false);
        setRows(createInitialRows(20));
      }
    } catch (error: any) {
      toast({
        title: 'Import fehlgeschlagen',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const processTimeWindows = async (
    rowsWithTimeWindows: CustomerRow[], 
    customerIdMap: Map<string, string>,
    insertedData: { id: string; vorname: string; nachname: string }[]
  ) => {
    setProcessingTimeWindows(true);
    setShowTimeWindowDialog(true);
    
    // Initialize suggestions with loading state
    const initialSuggestions: CustomerTimeWindows[] = rowsWithTimeWindows.map(row => {
      const customerId = customerIdMap.get(row.id) || '';
      return {
        customerId,
        customerName: `${row.vorname} ${row.nachname}`,
        originalText: row.zeitfenster_text,
        windows: [],
        loading: true,
      };
    });
    setTimeWindowSuggestions(initialSuggestions);

    // Process each row sequentially to avoid overwhelming the API
    for (let i = 0; i < rowsWithTimeWindows.length; i++) {
      const row = rowsWithTimeWindows[i];
      try {
        const { data, error } = await supabase.functions.invoke('parse-time-windows', {
          body: { text: row.zeitfenster_text }
        });

        if (error) throw error;

        setTimeWindowSuggestions(prev => prev.map((s, idx) => {
          if (idx === i) {
            return {
              ...s,
              windows: data?.windows || [],
              loading: false,
              error: (!data?.windows || data.windows.length === 0) ? 'Keine Zeitfenster erkannt' : undefined,
            };
          }
          return s;
        }));
      } catch (error: any) {
        console.error('Error parsing time windows:', error);
        setTimeWindowSuggestions(prev => prev.map((s, idx) => {
          if (idx === i) {
            return {
              ...s,
              loading: false,
              error: error.message?.includes('Rate limit') 
                ? 'Rate Limit erreicht' 
                : error.message?.includes('credits')
                ? 'Keine Credits'
                : 'Fehler bei KI-Verarbeitung',
            };
          }
          return s;
        }));
      }
      
      // Small delay between requests
      if (i < rowsWithTimeWindows.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    setProcessingTimeWindows(false);
  };

  const startEditTimeWindow = (customerIndex: number, windowIndex: number) => {
    setEditingTimeWindow({ customerIndex, windowIndex });
    setEditTimeWindowForm({ ...timeWindowSuggestions[customerIndex].windows[windowIndex] });
  };

  const cancelEditTimeWindow = () => {
    setEditingTimeWindow(null);
    setEditTimeWindowForm(null);
  };

  const saveEditTimeWindow = () => {
    if (editingTimeWindow && editTimeWindowForm) {
      setTimeWindowSuggestions(prev => prev.map((s, cIdx) => {
        if (cIdx === editingTimeWindow.customerIndex) {
          const updatedWindows = [...s.windows];
          updatedWindows[editingTimeWindow.windowIndex] = editTimeWindowForm;
          return { ...s, windows: updatedWindows };
        }
        return s;
      }));
      setEditingTimeWindow(null);
      setEditTimeWindowForm(null);
    }
  };

  const removeTimeWindow = (customerIndex: number, windowIndex: number) => {
    setTimeWindowSuggestions(prev => prev.map((s, cIdx) => {
      if (cIdx === customerIndex) {
        return { ...s, windows: s.windows.filter((_, wIdx) => wIdx !== windowIndex) };
      }
      return s;
    }));
  };

  const confirmAllTimeWindows = async () => {
    setProcessingTimeWindows(true);
    
    try {
      // Insert all time windows for all customers
      for (const suggestion of timeWindowSuggestions) {
        if (suggestion.windows.length > 0 && suggestion.customerId) {
          const timeWindowsToInsert = suggestion.windows.map(w => ({
            kunden_id: suggestion.customerId,
            wochentag: w.wochentag,
            von: w.von,
            bis: w.bis,
          }));
          
          const { error } = await supabase.from('kunden_zeitfenster').insert(timeWindowsToInsert);
          if (error) {
            console.error('Error inserting time windows:', error);
          }
        }
      }
      
      toast({
        title: 'Zeitfenster gespeichert',
        description: `Zeitfenster für ${timeWindowSuggestions.filter(s => s.windows.length > 0).length} Kunde(n) gespeichert.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowTimeWindowDialog(false);
      setShowImportDialog(false);
      setRows(createInitialRows(20));
      setTimeWindowSuggestions([]);
    } catch (error: any) {
      toast({
        title: 'Fehler beim Speichern',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessingTimeWindows(false);
    }
  };

  const skipTimeWindows = () => {
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    setShowTimeWindowDialog(false);
    setShowImportDialog(false);
    setRows(createInitialRows(20));
    setTimeWindowSuggestions([]);
    toast({
      title: 'Import abgeschlossen',
      description: 'Kunden importiert ohne Zeitfenster.',
    });
  };

  const escapeCSVField = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExport = () => {
    if (!customers || customers.length === 0) {
      toast({ title: 'Keine Daten', variant: 'destructive' });
      return;
    }

    const headers = COLUMNS.map(col => escapeCSVField(col.label)).join(',');
    const dataRows = customers.map((customer: any) => {
      return COLUMNS.map(col => {
        const value = customer[col.key];
        if (col.key === 'geburtsdatum' && value) {
          const date = new Date(value);
          return escapeCSVField(`${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`);
        }
        return escapeCSVField(value);
      }).join(',');
    }).join('\n');

    const csvContent = `${headers}\n${dataRows}`;
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kunden_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast({ title: 'Export erfolgreich', description: `${customers.length} Kunde(n) exportiert.` });
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
        <DialogContent className="max-w-[95vw] w-full max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Kunden importieren</DialogTitle>
            <DialogDescription>
              Klicken Sie in eine Zelle und tippen Sie oder fügen Sie Daten aus Excel ein (Strg+V). 
              Navigation: Pfeiltasten, Tab, Enter. Shift+Klick für Mehrfachauswahl.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-4 flex-wrap text-sm px-6 py-2 border-b bg-muted/30">
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              * Pflichtfeld
            </Badge>
            {validRowCount > 0 && (
              <div className="flex items-center gap-1 text-green-600">
                <Check className="h-4 w-4" />
                {validRowCount} gültig
              </div>
            )}
            {errorRowCount > 0 && (
              <div className="flex items-center gap-1 text-red-600">
                <AlertCircle className="h-4 w-4" />
                {errorRowCount} fehlerhaft
              </div>
            )}
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => addRows(10)}>
              <Plus className="h-4 w-4 mr-1" />
              10 Zeilen
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X className="h-4 w-4 mr-1" />
              Leeren
            </Button>
          </div>

          <div 
            ref={tableRef}
            className="flex-1 overflow-auto select-none"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
          >
            <table className="w-full text-sm border-collapse" style={{ minWidth: 'max-content' }}>
              <thead className="sticky top-0 z-20 bg-muted">
                <tr>
                  <th className="p-0 w-10 border-r border-b bg-muted text-center text-xs text-muted-foreground">#</th>
                  {COLUMNS.map((col, colIndex) => (
                    <th 
                      key={col.key} 
                      className={`p-2 text-left font-medium text-xs border-r border-b whitespace-nowrap ${(col as any).isAI ? 'bg-purple-100' : 'bg-muted'}`}
                      style={{ minWidth: col.width }}
                    >
                      <div className="flex items-center gap-1">
                        {(col as any).isAI && <Sparkles className="h-3 w-3 text-purple-500" />}
                        {col.label}
                        {col.required && <span className="text-red-500">*</span>}
                      </div>
                    </th>
                  ))}
                  <th className="p-2 w-16 border-b bg-muted text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => {
                  const hasContent = row.vorname.trim() || row.nachname.trim();
                  const hasErrors = row.errors.length > 0;
                  const isValid = hasContent && !hasErrors;
                  
                  return (
                    <tr key={row.id} className="group">
                      <td className="p-0 text-center text-xs text-muted-foreground border-r border-b bg-muted/50 relative">
                        <span className="group-hover:hidden">{rowIndex + 1}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 hidden group-hover:flex absolute inset-0 m-auto text-muted-foreground hover:text-destructive"
                          onClick={() => removeRow(rowIndex)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                      {COLUMNS.map((col, colIndex) => {
                        const isActive = isCellActive(rowIndex, colIndex);
                        const isSelected = isCellSelected(rowIndex, colIndex);
                        const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
                        const cellValue = (row as any)[col.key] || '';
                        const isAICol = (col as any).isAI;
                        
                        return (
                          <td
                            key={col.key}
                            className={`p-0 border-r border-b relative cursor-cell
                              ${isSelected && !isActive ? 'bg-primary/10' : ''}
                              ${isActive ? 'ring-2 ring-primary ring-inset z-10' : ''}
                              ${isAICol ? 'bg-purple-50/50' : ''}
                              ${hasErrors && hasContent && col.required && !cellValue ? 'bg-red-50' : ''}
                            `}
                            style={{ minWidth: col.width }}
                            onClick={(e) => handleCellClick(rowIndex, colIndex, e)}
                            onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                          >
                            {isEditing ? (
                              <input
                                ref={inputRef}
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                                className="w-full h-full px-2 py-1 text-sm border-none outline-none bg-white"
                                style={{ minHeight: 28 }}
                              />
                            ) : (
                              <div className="px-2 py-1 text-sm truncate min-h-[28px] flex items-center">
                                {cellValue}
                                {isAICol && cellValue && (
                                  <Sparkles className="h-3 w-3 text-purple-400 ml-1 flex-shrink-0" />
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-1 border-b text-center">
                        {hasContent && (
                          isValid ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <div className="group/err relative inline-flex">
                              <AlertCircle className="h-4 w-4 text-red-500 cursor-help" />
                              <div className="absolute right-0 top-6 z-30 hidden group-hover/err:block bg-popover border rounded-md p-2 shadow-lg min-w-[150px] text-left">
                                <ul className="text-xs text-red-600 space-y-0.5">
                                  {row.errors.map((err, i) => (
                                    <li key={i}>• {err}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/30">
            <div className="flex-1 text-xs text-muted-foreground">
              Pfeiltasten: Navigation • Enter/F2: Bearbeiten • Tab: Nächste Zelle • Del: Löschen • Shift+Klick: Auswahl
            </div>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleImport} disabled={!hasValidRows || isImporting}>
              {isImporting ? 'Importiere...' : `${validRowCount} Kunde(n) importieren`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Time Window Suggestions Dialog */}
      <Dialog open={showTimeWindowDialog} onOpenChange={setShowTimeWindowDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              KI-Zeitfenster Vorschläge
            </DialogTitle>
            <DialogDescription>
              Überprüfen und bestätigen Sie die erkannten Zeitfenster für jeden Kunden
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {timeWindowSuggestions.map((suggestion, customerIndex) => (
                <div 
                  key={suggestion.customerId || customerIndex} 
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{suggestion.customerName}</h4>
                      <p className="text-sm text-muted-foreground">
                        Eingabe: "{suggestion.originalText}"
                      </p>
                    </div>
                    {suggestion.loading && (
                      <div className="flex items-center gap-2 text-purple-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Verarbeite...</span>
                      </div>
                    )}
                    {suggestion.error && (
                      <Badge variant="destructive">{suggestion.error}</Badge>
                    )}
                  </div>

                  {suggestion.windows.length > 0 && (
                    <div className="space-y-2">
                      {suggestion.windows.map((window, windowIndex) => {
                        const isEditingThis = editingTimeWindow?.customerIndex === customerIndex && editingTimeWindow?.windowIndex === windowIndex;
                        
                        return (
                          <div key={windowIndex} className="border rounded-md p-3 bg-muted/30">
                            {isEditingThis && editTimeWindowForm ? (
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-xs">Wochentag</Label>
                                  <select
                                    className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                                    value={editTimeWindowForm.wochentag}
                                    onChange={(e) => setEditTimeWindowForm(prev => prev ? { ...prev, wochentag: parseInt(e.target.value) } : null)}
                                  >
                                    {WEEKDAY_NAMES.map((name, idx) => (
                                      <option key={idx} value={idx}>{name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label className="text-xs">Von</Label>
                                    <Input
                                      type="time"
                                      value={editTimeWindowForm.von}
                                      onChange={(e) => setEditTimeWindowForm(prev => prev ? { ...prev, von: e.target.value } : null)}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Bis</Label>
                                    <Input
                                      type="time"
                                      value={editTimeWindowForm.bis}
                                      onChange={(e) => setEditTimeWindowForm(prev => prev ? { ...prev, bis: e.target.value } : null)}
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={saveEditTimeWindow}>
                                    <Check className="h-4 w-4 mr-1" />
                                    Speichern
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={cancelEditTimeWindow}>
                                    <X className="h-4 w-4 mr-1" />
                                    Abbrechen
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm">
                                    {WEEKDAY_NAMES[window.wochentag]}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {window.von} - {window.bis} Uhr
                                  </p>
                                </div>
                                <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEditTimeWindow(customerIndex, windowIndex)}>
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-destructive" onClick={() => removeTimeWindow(customerIndex, windowIndex)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!suggestion.loading && suggestion.windows.length === 0 && !suggestion.error && (
                    <p className="text-sm text-muted-foreground italic">Keine Zeitfenster erkannt</p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4 border-t">
            <div className="flex-1 text-xs text-muted-foreground">
              {processingTimeWindows 
                ? 'Zeitfenster werden verarbeitet...' 
                : `${timeWindowSuggestions.filter(s => s.windows.length > 0).length} Kunde(n) mit Zeitfenstern`
              }
            </div>
            <Button variant="outline" onClick={skipTimeWindows} disabled={processingTimeWindows}>
              Überspringen
            </Button>
            <Button 
              onClick={confirmAllTimeWindows} 
              disabled={processingTimeWindows || timeWindowSuggestions.every(s => s.windows.length === 0)}
            >
              {processingTimeWindows ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verarbeite...
                </>
              ) : (
                'Zeitfenster speichern'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
