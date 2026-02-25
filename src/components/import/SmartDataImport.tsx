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
import { AlertCircle, Check, Plus, Trash2, Loader2, Upload, FileSpreadsheet, Copy, ClipboardPaste } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface ColumnConfig {
  key: string;
  label: string;
  required?: boolean;
  width?: number;
  hint?: string;
  validate?: (value: string) => string | null;
  transform?: (value: string) => any;
}

export interface DataRow {
  id: string;
  [key: string]: any;
  errors: string[];
}

interface SmartDataImportProps<T extends DataRow> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  columns: ColumnConfig[];
  onImport: (rows: T[]) => Promise<void>;
  createEmptyRow: () => T;
  initialRowCount?: number;
  batchSize?: number;
  aiParseFunction?: string;
  aiParseResultKey?: string;
}

interface CellPosition {
  row: number;
  col: number;
}

export function SmartDataImport<T extends DataRow>({
  open,
  onOpenChange,
  title,
  description,
  columns,
  onImport,
  createEmptyRow,
  initialRowCount = 20,
  batchSize = 100,
}: SmartDataImportProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [activeCell, setActiveCell] = useState<CellPosition | null>(null);
  const [selectionStart, setSelectionStart] = useState<CellPosition | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<CellPosition | null>(null);
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const tableRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize empty rows when opening
  useEffect(() => {
    if (open && rows.length === 0) {
      setRows(Array.from({ length: initialRowCount }, createEmptyRow) as T[]);
    }
  }, [open, initialRowCount, createEmptyRow]);

  // Focus input when editing
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Mouse up listener for drag selection
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging) setIsDragging(false);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging]);

  const validateRow = useCallback((row: T): string[] => {
    const errors: string[] = [];
    for (const col of columns) {
      const value = row[col.key] || '';
      if (col.required && !value.trim()) {
        errors.push(`${col.label} erforderlich`);
      }
      if (col.validate && value.trim()) {
        const error = col.validate(value);
        if (error) errors.push(error);
      }
    }
    return errors;
  }, [columns]);

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

  const getSelection = useCallback((): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null => {
    if (!selectionStart || !selectionEnd) return null;
    return {
      minRow: Math.min(selectionStart.row, selectionEnd.row),
      maxRow: Math.max(selectionStart.row, selectionEnd.row),
      minCol: Math.min(selectionStart.col, selectionEnd.col),
      maxCol: Math.max(selectionStart.col, selectionEnd.col),
    };
  }, [selectionStart, selectionEnd]);

  const isCellSelected = (row: number, col: number): boolean => {
    // Check row-level selection
    if (selectedRows.has(row)) return true;
    const sel = getSelection();
    if (!sel) return false;
    return row >= sel.minRow && row <= sel.maxRow && col >= sel.minCol && col <= sel.maxCol;
  };

  const handleCellMouseDown = (row: number, col: number, e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    
    if (e.shiftKey && activeCell) {
      setSelectionEnd({ row, col });
    } else {
      setActiveCell({ row, col });
      setSelectionStart({ row, col });
      setSelectionEnd({ row, col });
      setSelectedRows(new Set());
    }
    setEditingCell(null);
    setIsDragging(true);
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    if (isDragging) {
      setSelectionEnd({ row, col });
    }
  };

  const handleRowHeaderClick = (rowIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (e.shiftKey && selectedRows.size > 0) {
      // Extend row selection
      const existing = Array.from(selectedRows);
      const minExisting = Math.min(...existing);
      const maxExisting = Math.max(...existing);
      const newSet = new Set(selectedRows);
      const from = Math.min(minExisting, rowIndex);
      const to = Math.max(maxExisting, rowIndex);
      for (let i = from; i <= to; i++) newSet.add(i);
      setSelectedRows(newSet);
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle single row
      const newSet = new Set(selectedRows);
      if (newSet.has(rowIndex)) newSet.delete(rowIndex);
      else newSet.add(rowIndex);
      setSelectedRows(newSet);
    } else {
      // Select single row
      setSelectedRows(new Set([rowIndex]));
      setSelectionStart({ row: rowIndex, col: 0 });
      setSelectionEnd({ row: rowIndex, col: columns.length - 1 });
    }
    setActiveCell({ row: rowIndex, col: 0 });
    setEditingCell(null);
  };

  const handleCellDoubleClick = (row: number, col: number) => {
    setEditingCell({ row, col });
    setEditValue(rows[row][columns[col].key] || '');
  };

  const commitEdit = () => {
    if (editingCell) {
      updateCell(editingCell.row, columns[editingCell.col].key, editValue);
      setEditingCell(null);
    }
  };

  // Copy selection to clipboard
  const copySelection = useCallback(() => {
    let sel = getSelection();

    // If rows are selected, use full row range
    if (selectedRows.size > 0) {
      const rowArr = Array.from(selectedRows).sort((a, b) => a - b);
      sel = { minRow: rowArr[0], maxRow: rowArr[rowArr.length - 1], minCol: 0, maxCol: columns.length - 1 };
    }

    if (!sel) {
      if (activeCell) {
        const value = rows[activeCell.row]?.[columns[activeCell.col]?.key] || '';
        navigator.clipboard.writeText(value);
        toast({ title: 'Kopiert', description: '1 Zelle kopiert' });
      }
      return;
    }

    const lines: string[] = [];
    for (let r = sel.minRow; r <= sel.maxRow; r++) {
      // Skip rows not in selectedRows if row selection is active
      if (selectedRows.size > 0 && !selectedRows.has(r)) continue;
      const cells: string[] = [];
      for (let c = sel.minCol; c <= sel.maxCol; c++) {
        cells.push(rows[r]?.[columns[c]?.key] || '');
      }
      lines.push(cells.join('\t'));
    }
    const text = lines.join('\n');
    navigator.clipboard.writeText(text);
    
    const cellCount = lines.length * (sel.maxCol - sel.minCol + 1);
    toast({ title: 'Kopiert', description: `${cellCount} Zelle(n) kopiert` });
  }, [getSelection, selectedRows, activeCell, rows, columns, toast]);

  // Cut selection
  const cutSelection = useCallback(() => {
    copySelection();
    
    let sel = getSelection();
    if (selectedRows.size > 0) {
      const rowArr = Array.from(selectedRows).sort((a, b) => a - b);
      sel = { minRow: rowArr[0], maxRow: rowArr[rowArr.length - 1], minCol: 0, maxCol: columns.length - 1 };
    }

    if (!sel && activeCell) {
      updateCell(activeCell.row, columns[activeCell.col].key, '');
      return;
    }

    if (sel) {
      setRows(prev => prev.map((row, ri) => {
        if (ri >= sel!.minRow && ri <= sel!.maxRow && (selectedRows.size === 0 || selectedRows.has(ri))) {
          const updated = { ...row } as any;
          for (let ci = sel!.minCol; ci <= sel!.maxCol; ci++) {
            updated[columns[ci].key] = '';
          }
          updated.errors = validateRow(updated);
          return updated as T;
        }
        return row;
      }));
    }
  }, [copySelection, getSelection, selectedRows, activeCell, columns, validateRow]);

  // Select all
  const selectAll = useCallback(() => {
    if (rows.length === 0) return;
    setSelectionStart({ row: 0, col: 0 });
    setSelectionEnd({ row: rows.length - 1, col: columns.length - 1 });
    setActiveCell({ row: 0, col: 0 });
    setSelectedRows(new Set());
  }, [rows.length, columns.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Global shortcuts (work even without activeCell)
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      selectAll();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      copySelection();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
      e.preventDefault();
      cutSelection();
      return;
    }

    if (!activeCell) return;

    if (editingCell) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
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
        if (newCol >= 0 && newCol < columns.length) {
          const newPos = { row: activeCell.row, col: newCol };
          setActiveCell(newPos);
          setSelectionStart(newPos);
          setSelectionEnd(newPos);
        }
      }
      return;
    }

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
        newCol = Math.min(columns.length - 1, activeCell.col + 1);
        break;
      case 'Tab':
        e.preventDefault();
        newCol = e.shiftKey ? activeCell.col - 1 : activeCell.col + 1;
        if (newCol < 0) {
          newCol = columns.length - 1;
          newRow = Math.max(0, activeCell.row - 1);
        } else if (newCol >= columns.length) {
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
        // Delete selected rows content
        if (selectedRows.size > 0) {
          setRows(prev => prev.map((row, ri) => {
            if (selectedRows.has(ri)) {
              const updated = { ...row } as any;
              for (const col of columns) updated[col.key] = '';
              updated.errors = validateRow(updated);
              return updated as T;
            }
            return row;
          }));
          return;
        }
        const sel = getSelection();
        if (sel) {
          setRows(prev => prev.map((row, ri) => {
            if (ri >= sel.minRow && ri <= sel.maxRow) {
              const updated = { ...row } as any;
              for (let ci = sel.minCol; ci <= sel.maxCol; ci++) {
                updated[columns[ci].key] = '';
              }
              updated.errors = validateRow(updated);
              return updated as T;
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
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          setEditingCell(activeCell);
          setEditValue(e.key);
          setSelectedRows(new Set());
          return;
        }
    }

    const newPos = { row: newRow, col: newCol };
    if (e.shiftKey && (e.key.startsWith('Arrow'))) {
      setSelectionEnd(newPos);
    } else {
      setSelectionStart(newPos);
      setSelectionEnd(newPos);
      setSelectedRows(new Set());
    }
    setActiveCell(newPos);
  }, [activeCell, editingCell, rows, columns, validateRow, editValue, selectAll, copySelection, cutSelection, getSelection, selectedRows]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData.getData('text');
    if (!clipboardData) return;
    e.preventDefault();

    const startRow = activeCell?.row ?? 0;
    const startCol = activeCell?.col ?? 0;

    const lines = clipboardData.split('\n').filter(line => line.trim());

    setRows(prev => {
      const newRows = [...prev];
      
      while (newRows.length < startRow + lines.length) {
        newRows.push(createEmptyRow());
      }

      lines.forEach((line, lineIndex) => {
        const cells = line.split('\t');
        const rowIndex = startRow + lineIndex;
        
        cells.forEach((cellValue, cellIndex) => {
          const colIndex = startCol + cellIndex;
          if (colIndex < columns.length && rowIndex < newRows.length) {
            (newRows[rowIndex] as any)[columns[colIndex].key] = cellValue.trim();
          }
        });
        
        newRows[rowIndex].errors = validateRow(newRows[rowIndex]);
      });

      return newRows;
    });

    // Select the pasted area
    setSelectionStart({ row: startRow, col: startCol });
    const pastedRows = lines.length;
    const pastedCols = Math.max(...lines.map(l => l.split('\t').length));
    setSelectionEnd({ 
      row: Math.min(startRow + pastedRows - 1, rows.length + pastedRows - 1), 
      col: Math.min(startCol + pastedCols - 1, columns.length - 1) 
    });
    setSelectedRows(new Set());

    toast({
      title: 'Daten eingefügt',
      description: `${lines.length} Zeile(n) eingefügt`,
    });
  }, [activeCell, columns, createEmptyRow, toast, validateRow, rows.length]);

  const addRows = (count: number) => {
    setRows(prev => [...prev, ...Array.from({ length: count }, createEmptyRow)]);
  };

  const removeSelectedRows = () => {
    if (selectedRows.size === 0) return;
    setRows(prev => {
      const filtered = prev.filter((_, i) => !selectedRows.has(i));
      return filtered.length === 0 ? Array.from({ length: 5 }, createEmptyRow) as T[] : filtered;
    });
    setSelectedRows(new Set());
    setActiveCell(null);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const removeRow = (index: number) => {
    setRows(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearAll = () => {
    setRows(Array.from({ length: initialRowCount }, createEmptyRow) as T[]);
    setActiveCell(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    setEditingCell(null);
    setSelectedRows(new Set());
  };

  const validRows = rows.filter(row => {
    const hasRequiredData = columns.filter(c => c.required).every(c => row[c.key]?.trim());
    return hasRequiredData && row.errors.length === 0;
  });

  const errorRows = rows.filter(row => {
    const hasAnyData = columns.some(c => row[c.key]?.trim());
    return hasAnyData && row.errors.length > 0;
  });

  const handleImport = async () => {
    if (validRows.length === 0) {
      toast({ title: 'Keine gültigen Daten', variant: 'destructive' });
      return;
    }

    setIsImporting(true);

    try {
      if (validRows.length > batchSize) {
        for (let i = 0; i < validRows.length; i += batchSize) {
          const batch = validRows.slice(i, i + batchSize);
          await onImport(batch);
          toast({
            title: 'Fortschritt',
            description: `${Math.min(i + batchSize, validRows.length)} / ${validRows.length} importiert`,
          });
        }
      } else {
        await onImport(validRows);
      }

      toast({
        title: 'Import erfolgreich',
        description: `${validRows.length} Datensätze importiert.`,
      });

      onOpenChange(false);
      setRows([]);
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

  const handleClose = () => {
    onOpenChange(false);
    setRows([]);
    setSelectedRows(new Set());
  };

  const sel = getSelection();
  const selectionInfo = selectedRows.size > 0
    ? `${selectedRows.size} Zeile(n) ausgewählt`
    : sel
      ? `${sel.maxRow - sel.minRow + 1}×${sel.maxCol - sel.minCol + 1} ausgewählt`
      : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Stats & Actions Bar */}
        <div className="flex items-center gap-2 py-2 border-b flex-wrap">
          <Badge variant="secondary" className="gap-1">
            <Check className="h-3 w-3" />
            {validRows.length} gültig
          </Badge>
          {errorRows.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              {errorRows.length} Fehler
            </Badge>
          )}
          {selectionInfo && (
            <Badge variant="outline" className="gap-1 text-xs">
              {selectionInfo}
            </Badge>
          )}
          <div className="text-xs text-muted-foreground hidden sm:block">
            Strg+C Kopieren · Strg+V Einfügen · Strg+A Alles · Shift+Klick Bereich
          </div>
          <div className="flex-1" />
          {selectedRows.size > 0 && (
            <Button variant="destructive" size="sm" onClick={removeSelectedRows}>
              <Trash2 className="h-3 w-3 mr-1" />
              {selectedRows.size} Zeilen löschen
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={copySelection} title="Auswahl kopieren (Strg+C)">
            <Copy className="h-3 w-3 mr-1" />
            Kopieren
          </Button>
          <Button variant="outline" size="sm" onClick={() => addRows(10)}>
            <Plus className="h-3 w-3 mr-1" />
            10 Zeilen
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Alles löschen
          </Button>
        </div>

        {/* Table */}
        <div className="flex-1 border rounded-md overflow-auto min-h-0 select-none">
          <div
            ref={tableRef}
            className="focus:outline-none"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
          >
            <table className="border-collapse text-sm" style={{ minWidth: columns.reduce((sum, c) => sum + (c.width || 100), 60) }}>
              <thead className="sticky top-0 bg-muted z-10">
                <tr>
                  <th 
                    className="w-10 px-2 py-2 text-center text-muted-foreground cursor-pointer hover:bg-primary/10"
                    onClick={() => selectAll()}
                    title="Alles auswählen"
                  >
                    #
                  </th>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      className="px-2 py-2 text-left font-medium whitespace-nowrap"
                      style={{ minWidth: col.width || 100 }}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.required && <span className="text-destructive">*</span>}
                      </div>
                      {col.hint && (
                        <div className="text-xs font-normal text-muted-foreground">{col.hint}</div>
                      )}
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => {
                  const isRowSelected = selectedRows.has(rowIndex);
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-t hover:bg-muted/30",
                        row.errors.length > 0 && "bg-destructive/5",
                        isRowSelected && "bg-primary/10"
                      )}
                    >
                      <td 
                        className={cn(
                          "px-2 py-1 text-center text-muted-foreground text-xs cursor-pointer hover:bg-primary/20 border-r",
                          isRowSelected && "bg-primary/20 font-bold text-primary"
                        )}
                        onMouseDown={(e) => handleRowHeaderClick(rowIndex, e)}
                      >
                        {rowIndex + 1}
                      </td>
                      {columns.map((col, colIndex) => {
                        const isActive = activeCell?.row === rowIndex && activeCell?.col === colIndex;
                        const isSelected = isCellSelected(rowIndex, colIndex);
                        const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
                        const value = row[col.key] || '';

                        return (
                          <td
                            key={col.key}
                            className={cn(
                              "px-1 py-0.5 border-r cursor-cell relative",
                              isActive && "ring-2 ring-primary ring-inset",
                              isSelected && !isActive && "bg-primary/10"
                            )}
                            onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                            onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                            onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                          >
                            {isEditing ? (
                              <input
                                ref={inputRef}
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                                className="w-full px-1 py-0.5 bg-background border-0 focus:outline-none focus:ring-0"
                              />
                            ) : (
                              <div className="px-1 py-0.5 truncate min-h-[24px]">
                                {value}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 hover:opacity-100"
                          onClick={() => removeRow(rowIndex)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Error Summary */}
        {errorRows.length > 0 && (
          <div className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {errorRows.length} Zeile(n) haben Fehler und werden nicht importiert
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting || validRows.length === 0}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importiere...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {validRows.length} importieren
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
