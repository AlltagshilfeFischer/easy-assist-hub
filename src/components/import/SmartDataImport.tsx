import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  Check,
  Plus,
  Trash2,
  Loader2,
  Upload,
  FileSpreadsheet,
  Copy,
  Scissors,
  Undo2,
  Redo2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export interface ColumnConfig {
  key: string;
  label: string;
  required?: boolean;
  width?: number;
  hint?: string;
  validate?: (value: string) => string | null;
  transform?: (value: string) => unknown;
}

export interface DataRow {
  id: string;
  [key: string]: unknown;
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

interface SelectionRange {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  row: number;
  col: number;
}

interface UndoStack<T> {
  past: T[][];
  future: T[][];
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
  aiParseFunction,
  aiParseResultKey,
}: SmartDataImportProps<T>) {
  // ─── Data state ───────────────────────────────────────────────────
  const [rows, setRows] = useState<T[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // ─── Selection state ──────────────────────────────────────────────
  const [activeCell, setActiveCell] = useState<CellPosition | null>(null);
  const [selectionStart, setSelectionStart] = useState<CellPosition | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<CellPosition | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectedCols, setSelectedCols] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);

  // ─── Edit state ───────────────────────────────────────────────────
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [editValue, setEditValue] = useState('');

  // ─── UI state ─────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiParsing, setAiParsing] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // ─── Refs ─────────────────────────────────────────────────────────
  const tableRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());
  const undoRef = useRef<UndoStack<T>>({ past: [], future: [] });
  // Track whether edit was started by keypress (replace mode) vs F2/dblclick (append mode)
  const editModeRef = useRef<'replace' | 'append'>('append');

  // ─── Init rows when dialog opens ─────────────────────────────────
  useEffect(() => {
    if (open && rows.length === 0) {
      setRows(Array.from({ length: initialRowCount }, createEmptyRow) as T[]);
    }
  }, [open, initialRowCount, createEmptyRow, rows.length]);

  // ─── Focus management ────────────────────────────────────────────
  // Re-focus the table div whenever edit mode ends or the dialog opens.
  // This ensures keyboard navigation and Ctrl+V paste always work.
  useEffect(() => {
    if (!editingCell && open) {
      tableRef.current?.focus({ preventScroll: true });
    }
  }, [editingCell, open]);

  // ─── Global mouseup to end drag selection ────────────────────────
  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // ─── Close context menu on outside click ────────────────────────
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    // Use timeout so the click that opened the menu doesn't immediately close it
    const t = setTimeout(() => window.addEventListener('click', close), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('click', close);
    };
  }, [contextMenu]);

  // ─── Validation ──────────────────────────────────────────────────
  const validateRow = useCallback((row: T): string[] => {
    const errors: string[] = [];
    for (const col of columns) {
      const value = String(row[col.key] ?? '');
      if (col.required && !value.trim()) {
        errors.push(`${col.label} erforderlich`);
      }
      if (col.validate && value.trim()) {
        const err = col.validate(value);
        if (err) errors.push(err);
      }
    }
    return errors;
  }, [columns]);

  // ─── Undo / Redo ─────────────────────────────────────────────────
  /**
   * Wrapper around setRows that saves the current state to the undo stack.
   * Use this for all user-driven data mutations.
   */
  const setRowsWithHistory = useCallback((updater: T[] | ((prev: T[]) => T[])) => {
    setRows(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      undoRef.current.past = [
        ...undoRef.current.past.slice(-49),
        prev.map(r => ({ ...r, errors: [...r.errors] })),
      ];
      undoRef.current.future = [];
      setCanUndo(true);
      setCanRedo(false);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setRows(prev => {
      const { past, future } = undoRef.current;
      if (past.length === 0) return prev;
      const previous = past[past.length - 1];
      undoRef.current.past = past.slice(0, -1);
      undoRef.current.future = [
        prev.map(r => ({ ...r, errors: [...r.errors] })),
        ...future.slice(0, 49),
      ];
      setCanUndo(undoRef.current.past.length > 0);
      setCanRedo(true);
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setRows(prev => {
      const { past, future } = undoRef.current;
      if (future.length === 0) return prev;
      const next = future[0];
      undoRef.current.past = [...past.slice(-49), prev.map(r => ({ ...r, errors: [...r.errors] }))];
      undoRef.current.future = future.slice(1);
      setCanUndo(true);
      setCanRedo(undoRef.current.future.length > 0);
      return next;
    });
  }, []);

  // ─── Selection helpers ────────────────────────────────────────────
  const clearSelectionModes = useCallback(() => {
    setSelectedRows(new Set());
    setSelectedCols(new Set());
  }, []);

  const getSelection = useCallback((): SelectionRange | null => {
    if (selectedCols.size > 0) {
      const arr = Array.from<number>(selectedCols).sort((a, b) => a - b);
      return { minRow: 0, maxRow: rows.length - 1, minCol: arr[0], maxCol: arr[arr.length - 1] };
    }
    if (selectedRows.size > 0) {
      const arr = Array.from<number>(selectedRows).sort((a, b) => a - b);
      return { minRow: arr[0], maxRow: arr[arr.length - 1], minCol: 0, maxCol: columns.length - 1 };
    }
    if (!selectionStart || !selectionEnd) return null;
    return {
      minRow: Math.min(selectionStart.row, selectionEnd.row),
      maxRow: Math.max(selectionStart.row, selectionEnd.row),
      minCol: Math.min(selectionStart.col, selectionEnd.col),
      maxCol: Math.max(selectionStart.col, selectionEnd.col),
    };
  }, [selectionStart, selectionEnd, selectedRows, selectedCols, rows.length, columns.length]);

  const isCellSelected = useCallback((row: number, col: number): boolean => {
    if (selectedCols.has(col)) return true;
    if (selectedRows.has(row)) return true;
    const sel = getSelection();
    if (!sel) return false;
    return row >= sel.minRow && row <= sel.maxRow && col >= sel.minCol && col <= sel.maxCol;
  }, [selectedCols, selectedRows, getSelection]);

  // ─── Scroll cell into view ────────────────────────────────────────
  const scrollCellIntoView = useCallback((row: number, col: number) => {
    const cell = cellRefs.current.get(`${row}-${col}`);
    cell?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, []);

  // ─── Cell update ─────────────────────────────────────────────────
  const updateCell = useCallback((rowIndex: number, colKey: string, value: string) => {
    setRowsWithHistory(prev => prev.map((row, i) => {
      if (i !== rowIndex) return row;
      const updated = { ...row, [colKey]: value } as T;
      updated.errors = validateRow(updated);
      return updated;
    }));
  }, [setRowsWithHistory, validateRow]);

  // ─── Edit lifecycle ───────────────────────────────────────────────
  const startEdit = useCallback((row: number, col: number, initialValue?: string) => {
    editModeRef.current = initialValue !== undefined ? 'replace' : 'append';
    setEditingCell({ row, col });
    setEditValue(initialValue ?? String(rows[row]?.[columns[col]?.key] ?? ''));
  }, [rows, columns]);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    updateCell(editingCell.row, columns[editingCell.col].key, editValue);
    setEditingCell(null);
  }, [editingCell, updateCell, columns, editValue]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  // ─── Fill operations ──────────────────────────────────────────────
  const fillDown = useCallback(() => {
    const sel = getSelection();
    if (!sel || sel.maxRow === sel.minRow) return;
    setRowsWithHistory(prev => prev.map((row, ri) => {
      if (ri <= sel.minRow || ri > sel.maxRow) return row;
      const updated = { ...row } as T;
      for (let ci = sel.minCol; ci <= sel.maxCol; ci++) {
        (updated as Record<string, unknown>)[columns[ci].key] =
          (prev[sel.minRow] as Record<string, unknown>)[columns[ci].key];
      }
      updated.errors = validateRow(updated);
      return updated;
    }));
  }, [getSelection, setRowsWithHistory, columns, validateRow]);

  const fillRight = useCallback(() => {
    const sel = getSelection();
    if (!sel || sel.maxCol === sel.minCol) return;
    setRowsWithHistory(prev => prev.map((row, ri) => {
      if (ri < sel.minRow || ri > sel.maxRow) return row;
      const updated = { ...row } as T;
      for (let ci = sel.minCol + 1; ci <= sel.maxCol; ci++) {
        (updated as Record<string, unknown>)[columns[ci].key] =
          (row as Record<string, unknown>)[columns[sel.minCol].key];
      }
      updated.errors = validateRow(updated);
      return updated;
    }));
  }, [getSelection, setRowsWithHistory, columns, validateRow]);

  // ─── Clipboard operations ─────────────────────────────────────────
  const copySelection = useCallback(() => {
    const sel = getSelection();
    if (!sel) {
      if (!activeCell) return;
      const value = String(rows[activeCell.row]?.[columns[activeCell.col]?.key] ?? '');
      navigator.clipboard.writeText(value);
      toast.success('Kopiert', { description: '1 Zelle kopiert' });
      return;
    }
    const lines: string[] = [];
    for (let r = sel.minRow; r <= sel.maxRow; r++) {
      if (selectedRows.size > 0 && !selectedRows.has(r)) continue;
      const cells: string[] = [];
      for (let c = sel.minCol; c <= sel.maxCol; c++) {
        if (selectedCols.size > 0 && !selectedCols.has(c)) continue;
        cells.push(String(rows[r]?.[columns[c]?.key] ?? ''));
      }
      if (cells.length > 0) lines.push(cells.join('\t'));
    }
    navigator.clipboard.writeText(lines.join('\n'));
    const cellCount = lines.reduce((sum, l) => sum + l.split('\t').length, 0);
    toast.success('Kopiert', { description: `${cellCount} Zelle(n) in Zwischenablage` });
  }, [getSelection, activeCell, rows, columns, selectedRows, selectedCols]);

  const cutSelection = useCallback(() => {
    copySelection();
    const sel = getSelection();
    if (!sel && activeCell) {
      updateCell(activeCell.row, columns[activeCell.col].key, '');
      return;
    }
    if (!sel) return;
    setRowsWithHistory(prev => prev.map((row, ri) => {
      if (ri < sel.minRow || ri > sel.maxRow) return row;
      if (selectedRows.size > 0 && !selectedRows.has(ri)) return row;
      const updated = { ...row } as T;
      for (let ci = sel.minCol; ci <= sel.maxCol; ci++) {
        if (selectedCols.size > 0 && !selectedCols.has(ci)) continue;
        (updated as Record<string, unknown>)[columns[ci].key] = '';
      }
      updated.errors = validateRow(updated);
      return updated;
    }));
  }, [copySelection, getSelection, activeCell, updateCell, setRowsWithHistory, columns, selectedRows, selectedCols, validateRow]);

  const selectAll = useCallback(() => {
    if (rows.length === 0) return;
    setSelectionStart({ row: 0, col: 0 });
    setSelectionEnd({ row: rows.length - 1, col: columns.length - 1 });
    setActiveCell({ row: 0, col: 0 });
    clearSelectionModes();
  }, [rows.length, columns.length, clearSelectionModes]);

  // ─── Clear cells in selection ─────────────────────────────────────
  const clearSelection = useCallback(() => {
    const sel = getSelection();
    const target = sel ?? (activeCell
      ? { minRow: activeCell.row, maxRow: activeCell.row, minCol: activeCell.col, maxCol: activeCell.col }
      : null);
    if (!target) return;
    setRowsWithHistory(prev => prev.map((row, ri) => {
      if (ri < target.minRow || ri > target.maxRow) return row;
      if (selectedRows.size > 0 && !selectedRows.has(ri)) return row;
      const updated = { ...row } as T;
      for (let ci = target.minCol; ci <= target.maxCol; ci++) {
        if (selectedCols.size > 0 && !selectedCols.has(ci)) continue;
        (updated as Record<string, unknown>)[columns[ci].key] = '';
      }
      updated.errors = validateRow(updated);
      return updated;
    }));
  }, [getSelection, activeCell, setRowsWithHistory, columns, selectedRows, selectedCols, validateRow]);

  // ─── Paste ───────────────────────────────────────────────────────
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    e.preventDefault();

    const startRow = activeCell?.row ?? 0;
    const startCol = activeCell?.col ?? 0;

    // Normalize Windows/Mac line endings, split into lines (keep lines with only tabs)
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    // Remove trailing empty line from copy
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    if (lines.length === 0) return;

    setRowsWithHistory(prev => {
      const next = [...prev];
      while (next.length < startRow + lines.length) next.push(createEmptyRow());
      lines.forEach((line, li) => {
        const cells = line.split('\t');
        const ri = startRow + li;
        cells.forEach((val, ci) => {
          const colIdx = startCol + ci;
          if (colIdx < columns.length) {
            (next[ri] as Record<string, unknown>)[columns[colIdx].key] = val.trimEnd();
          }
        });
        next[ri].errors = validateRow(next[ri]);
      });
      return next;
    });

    // Highlight pasted area
    const pastedCols = Math.max(...lines.map(l => l.split('\t').length));
    setSelectionStart({ row: startRow, col: startCol });
    setSelectionEnd({
      row: startRow + lines.length - 1,
      col: Math.min(startCol + pastedCols - 1, columns.length - 1),
    });
    clearSelectionModes();
    toast.success('Eingefügt', { description: `${lines.length} Zeile(n) eingefügt` });
  }, [activeCell, columns, createEmptyRow, validateRow, setRowsWithHistory, clearSelectionModes]);

  // Async paste from context menu (requires Permissions API)
  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !activeCell) return;
      const startRow = activeCell.row;
      const startCol = activeCell.col;
      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
      if (lines.length === 0) return;
      setRowsWithHistory(prev => {
        const next = [...prev];
        while (next.length < startRow + lines.length) next.push(createEmptyRow());
        lines.forEach((line, li) => {
          const cells = line.split('\t');
          const ri = startRow + li;
          cells.forEach((val, ci) => {
            const colIdx = startCol + ci;
            if (colIdx < columns.length) {
              (next[ri] as Record<string, unknown>)[columns[colIdx].key] = val.trimEnd();
            }
          });
          next[ri].errors = validateRow(next[ri]);
        });
        return next;
      });
      toast.success('Eingefügt', { description: `${lines.length} Zeile(n) eingefügt` });
    } catch {
      toast.error('Einfügen fehlgeschlagen', { description: 'Clipboard-Zugriff nicht erlaubt' });
    }
  }, [activeCell, columns, createEmptyRow, validateRow, setRowsWithHistory]);

  // ─── Row operations ───────────────────────────────────────────────
  const addRows = (count: number) => {
    setRows(prev => [...prev, ...Array.from({ length: count }, createEmptyRow)]);
  };

  const insertRowAt = useCallback((index: number, direction: 'above' | 'below') => {
    setRowsWithHistory(prev => {
      const next = [...prev];
      next.splice(direction === 'above' ? index : index + 1, 0, createEmptyRow());
      return next;
    });
  }, [setRowsWithHistory, createEmptyRow]);

  const removeSelectedRows = useCallback(() => {
    const toRemove = selectedRows.size > 0
      ? selectedRows
      : activeCell ? new Set([activeCell.row]) : new Set<number>();
    if (toRemove.size === 0) return;
    setRowsWithHistory(prev => {
      const filtered = prev.filter((_, i) => !toRemove.has(i));
      return filtered.length === 0 ? [createEmptyRow()] as T[] : filtered;
    });
    setSelectedRows(new Set());
    setActiveCell(null);
    setSelectionStart(null);
    setSelectionEnd(null);
  }, [selectedRows, activeCell, setRowsWithHistory, createEmptyRow]);

  const removeRow = useCallback((index: number) => {
    setRowsWithHistory(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, [setRowsWithHistory]);

  const clearAll = useCallback(() => {
    undoRef.current = { past: [], future: [] };
    setCanUndo(false);
    setCanRedo(false);
    setRows(Array.from({ length: initialRowCount }, createEmptyRow) as T[]);
    setActiveCell(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    setEditingCell(null);
    setSelectedRows(new Set());
    setSelectedCols(new Set());
  }, [initialRowCount, createEmptyRow]);

  // ─── Mouse event handlers ─────────────────────────────────────────
  const handleCellMouseDown = useCallback((row: number, col: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Don't interfere when clicking inside the currently editing cell – let the input handle it
    if (editingCell?.row === row && editingCell?.col === col) return;
    // Ensure the table div keeps focus so keyboard events and Ctrl+V work
    tableRef.current?.focus({ preventScroll: true });
    setContextMenu(null);
    if (e.shiftKey && activeCell) {
      setSelectionEnd({ row, col });
      clearSelectionModes();
    } else {
      setActiveCell({ row, col });
      setSelectionStart({ row, col });
      setSelectionEnd({ row, col });
      clearSelectionModes();
    }
    setEditingCell(null);
    setIsDragging(true);
  }, [activeCell, clearSelectionModes, editingCell]);

  const handleCellMouseEnter = useCallback((row: number, col: number) => {
    if (isDragging) setSelectionEnd({ row, col });
  }, [isDragging]);

  const handleCellContextMenu = useCallback((row: number, col: number, e: React.MouseEvent) => {
    e.preventDefault();
    // If right-clicked outside current selection, move selection there
    if (!isCellSelected(row, col)) {
      setActiveCell({ row, col });
      setSelectionStart({ row, col });
      setSelectionEnd({ row, col });
      clearSelectionModes();
    }
    setContextMenu({ x: e.clientX, y: e.clientY, row, col });
  }, [isCellSelected, clearSelectionModes]);

  const handleRowHeaderClick = useCallback((rowIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    tableRef.current?.focus({ preventScroll: true });
    setSelectedCols(new Set());
    setEditingCell(null);
    if (e.shiftKey && selectedRows.size > 0) {
      const existing = Array.from<number>(selectedRows);
      const from = Math.min(Math.min(...existing), rowIndex);
      const to = Math.max(Math.max(...existing), rowIndex);
      const next = new Set<number>();
      for (let i = from; i <= to; i++) next.add(i);
      setSelectedRows(next);
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(selectedRows);
      if (next.has(rowIndex)) next.delete(rowIndex); else next.add(rowIndex);
      setSelectedRows(next);
    } else {
      setSelectedRows(new Set([rowIndex]));
      setSelectionStart({ row: rowIndex, col: 0 });
      setSelectionEnd({ row: rowIndex, col: columns.length - 1 });
    }
    setActiveCell({ row: rowIndex, col: 0 });
  }, [selectedRows, columns.length]);

  const handleColHeaderClick = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    tableRef.current?.focus({ preventScroll: true });
    setSelectedRows(new Set());
    setEditingCell(null);
    if (e.shiftKey && selectedCols.size > 0) {
      const existing = Array.from<number>(selectedCols);
      const from = Math.min(Math.min(...existing), colIndex);
      const to = Math.max(Math.max(...existing), colIndex);
      const next = new Set<number>();
      for (let i = from; i <= to; i++) next.add(i);
      setSelectedCols(next);
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(selectedCols);
      if (next.has(colIndex)) next.delete(colIndex); else next.add(colIndex);
      setSelectedCols(next);
    } else {
      setSelectedCols(new Set([colIndex]));
      setSelectionStart({ row: 0, col: colIndex });
      setSelectionEnd({ row: rows.length - 1, col: colIndex });
    }
    setActiveCell({ row: 0, col: colIndex });
  }, [selectedCols, rows.length]);

  // ─── Keyboard handler ─────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const isCtrl = e.ctrlKey || e.metaKey;

    // Escape: close context menu → cancel edit → clear selection
    if (e.key === 'Escape') {
      e.preventDefault();
      if (contextMenu) { setContextMenu(null); return; }
      if (editingCell) { cancelEdit(); return; }
      clearSelectionModes();
      return;
    }

    // Global shortcuts (no active cell required)
    if (isCtrl && e.key === 'a') { e.preventDefault(); selectAll(); return; }
    if (isCtrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (isCtrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (isCtrl && e.key === 'c') { e.preventDefault(); copySelection(); return; }
    if (isCtrl && e.key === 'x') { e.preventDefault(); cutSelection(); return; }

    if (!activeCell) return;

    // ── Editing mode ──
    if (editingCell) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
        const dir = e.shiftKey ? -1 : 1;
        const next = { row: Math.min(Math.max(0, activeCell.row + dir), rows.length - 1), col: activeCell.col };
        setActiveCell(next); setSelectionStart(next); setSelectionEnd(next);
        clearSelectionModes();
        scrollCellIntoView(next.row, next.col);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitEdit();
        const nextCol = e.shiftKey ? activeCell.col - 1 : activeCell.col + 1;
        let next: CellPosition;
        if (nextCol < 0) {
          next = { row: Math.max(0, activeCell.row - 1), col: columns.length - 1 };
        } else if (nextCol >= columns.length) {
          next = { row: Math.min(rows.length - 1, activeCell.row + 1), col: 0 };
        } else {
          next = { row: activeCell.row, col: nextCol };
        }
        setActiveCell(next); setSelectionStart(next); setSelectionEnd(next);
        clearSelectionModes();
        scrollCellIntoView(next.row, next.col);
      }
      // All other keys: let the input handle them naturally
      return;
    }

    // ── Fill shortcuts ──
    if (isCtrl && e.key === 'd') { e.preventDefault(); fillDown(); return; }
    if (isCtrl && e.key === 'r') { e.preventDefault(); fillRight(); return; }

    // ── Navigation ──
    let newRow = activeCell.row;
    let newCol = activeCell.col;
    let handled = true;

    switch (e.key) {
      case 'ArrowUp':    newRow = isCtrl ? 0 : Math.max(0, activeCell.row - 1); break;
      case 'ArrowDown':  newRow = isCtrl ? rows.length - 1 : Math.min(rows.length - 1, activeCell.row + 1); break;
      case 'ArrowLeft':  newCol = isCtrl ? 0 : Math.max(0, activeCell.col - 1); break;
      case 'ArrowRight': newCol = isCtrl ? columns.length - 1 : Math.min(columns.length - 1, activeCell.col + 1); break;
      case 'Home': newCol = 0; if (isCtrl) newRow = 0; break;
      case 'End':  newCol = columns.length - 1; if (isCtrl) newRow = rows.length - 1; break;
      case 'PageUp':   newRow = Math.max(0, activeCell.row - 15); break;
      case 'PageDown': newRow = Math.min(rows.length - 1, activeCell.row + 15); break;
      case 'Tab':
        newCol = e.shiftKey ? activeCell.col - 1 : activeCell.col + 1;
        if (newCol < 0) { newCol = columns.length - 1; newRow = Math.max(0, activeCell.row - 1); }
        else if (newCol >= columns.length) { newCol = 0; newRow = Math.min(rows.length - 1, activeCell.row + 1); }
        break;
      case 'Enter':
        if (e.shiftKey) { newRow = Math.max(0, activeCell.row - 1); break; }
        // Enter without shift → start editing
        startEdit(activeCell.row, activeCell.col);
        return;
      case 'F2':
        e.preventDefault();
        startEdit(activeCell.row, activeCell.col);
        return;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        clearSelection();
        return;
      default:
        // Printable char → start replace-mode editing
        if (e.key.length === 1 && !isCtrl) {
          startEdit(activeCell.row, activeCell.col, e.key);
          clearSelectionModes();
          return;
        }
        handled = false;
    }

    if (!handled) return;
    e.preventDefault();

    const next = { row: newRow, col: newCol };
    if (e.shiftKey && (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End')) {
      setSelectionEnd(next);
      clearSelectionModes();
    } else {
      setSelectionStart(next);
      setSelectionEnd(next);
      clearSelectionModes();
    }
    setActiveCell(next);
    scrollCellIntoView(next.row, next.col);
  }, [
    activeCell, editingCell, contextMenu, rows.length, columns.length,
    cancelEdit, clearSelectionModes, clearSelection, commitEdit,
    copySelection, cutSelection, fillDown, fillRight,
    redo, scrollCellIntoView, selectAll, startEdit, undo,
    selectedRows, selectedCols,
  ]);

  // ─── AI parse ────────────────────────────────────────────────────
  const handleAiParse = async () => {
    if (!aiParseFunction || !aiText.trim()) return;
    setAiParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke(aiParseFunction, { body: { text: aiText } });
      if (error) throw error;

      const parsed: Record<string, string>[] = aiParseResultKey
        ? (data?.[aiParseResultKey] ?? [])
        : (Array.isArray(data) ? data : []);

      if (parsed.length === 0) {
        toast.error('Nichts erkannt', { description: 'Die KI konnte keine strukturierten Daten extrahieren.' });
        return;
      }

      const newDataRows = parsed.map(item => {
        const row = createEmptyRow();
        for (const col of columns) {
          if (item[col.key] !== undefined) {
            (row as Record<string, unknown>)[col.key] = String(item[col.key] ?? '');
          }
        }
        row.errors = validateRow(row);
        return row;
      });

      setRowsWithHistory(prev => {
        const firstEmpty = prev.findIndex(r =>
          columns.filter(c => c.required).every(c => !String(r[c.key] ?? '').trim())
        );
        const next = [...prev];
        if (firstEmpty === -1) return [...next, ...newDataRows] as T[];
        next.splice(firstEmpty, 0, ...newDataRows);
        return next as T[];
      });

      toast.success('KI-Import erfolgreich', { description: `${newDataRows.length} Datensätze erkannt` });
      setShowAiDialog(false);
      setAiText('');
    } catch (err: unknown) {
      toast.error('KI-Fehler', { description: err instanceof Error ? err.message : 'Unbekannter Fehler' });
    } finally {
      setAiParsing(false);
    }
  };

  // ─── Import ───────────────────────────────────────────────────────
  // Build effective rows including any uncommitted edit currently in the input
  const effectiveRows = editingCell
    ? rows.map((row, i) => {
        if (i !== editingCell.row) return row;
        const updated = { ...row, [columns[editingCell.col].key]: editValue } as T;
        updated.errors = validateRow(updated);
        return updated;
      })
    : rows;

  const validRows = effectiveRows.filter(row => {
    const hasRequired = columns.filter(c => c.required).every(c => String(row[c.key] ?? '').trim());
    return hasRequired && row.errors.length === 0;
  });

  const errorRows = effectiveRows.filter(row => {
    const hasAnyData = columns.some(c => String(row[c.key] ?? '').trim());
    return hasAnyData && row.errors.length > 0;
  });

  const handleImport = async () => {
    // Auto-commit any pending edit before importing
    if (editingCell) {
      updateCell(editingCell.row, columns[editingCell.col].key, editValue);
      setEditingCell(null);
    }
    if (validRows.length === 0) { toast.error('Keine gültigen Daten zum Importieren'); return; }
    setIsImporting(true);
    try {
      if (validRows.length > batchSize) {
        for (let i = 0; i < validRows.length; i += batchSize) {
          await onImport(validRows.slice(i, i + batchSize));
          toast.info('Fortschritt', { description: `${Math.min(i + batchSize, validRows.length)} / ${validRows.length} importiert` });
        }
      } else {
        await onImport(validRows);
      }
      toast.success('Import erfolgreich', { description: `${validRows.length} Datensätze importiert` });
      onOpenChange(false);
      setRows([]);
    } catch (err: unknown) {
      toast.error('Import fehlgeschlagen', { description: err instanceof Error ? err.message : 'Unbekannter Fehler' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setRows([]);
    setSelectedRows(new Set());
    setSelectedCols(new Set());
    setContextMenu(null);
    setEditingCell(null);
  };

  // ─── Selection summary ────────────────────────────────────────────
  const sel = getSelection();
  const selectionInfo = selectedRows.size > 0
    ? `${selectedRows.size} Zeile(n) markiert`
    : selectedCols.size > 0
    ? `${selectedCols.size} Spalte(n) markiert`
    : sel
    ? `${sel.maxRow - sel.minRow + 1} × ${sel.maxCol - sel.minCol + 1} Zellen`
    : null;

  // ─── Context menu helpers ─────────────────────────────────────────
  const closeContextMenu = () => setContextMenu(null);

  const ctxDeleteRows = useCallback(() => {
    if (!contextMenu) return;
    const toRemove = selectedRows.size > 0 ? selectedRows : new Set([contextMenu.row]);
    setRowsWithHistory(prev => {
      const filtered = prev.filter((_, i) => !toRemove.has(i));
      return filtered.length === 0 ? [createEmptyRow()] as T[] : filtered;
    });
    setSelectedRows(new Set());
    closeContextMenu();
  }, [contextMenu, selectedRows, setRowsWithHistory, createEmptyRow]);

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-[96vw] w-full max-h-[93vh] flex flex-col gap-0 p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="px-5 pt-4 pb-3 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs">{description}</DialogDescription>
          </DialogHeader>

          {/* Toolbar */}
          <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-muted/40 flex-shrink-0 flex-wrap">
            {/* Stats */}
            <Badge variant="secondary" className="h-6 gap-1 text-xs font-normal">
              <Check className="h-3 w-3 text-green-600" />
              {validRows.length} gültig
            </Badge>
            {errorRows.length > 0 && (
              <Badge variant="destructive" className="h-6 gap-1 text-xs font-normal">
                <AlertCircle className="h-3 w-3" />
                {errorRows.length} Fehler
              </Badge>
            )}
            {selectionInfo && (
              <Badge variant="outline" className="h-6 text-xs font-normal text-muted-foreground">
                {selectionInfo}
              </Badge>
            )}

            <div className="w-px h-5 bg-border mx-0.5 flex-shrink-0" />

            {/* Undo / Redo */}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={undo} disabled={!canUndo} title="Rückgängig (Strg+Z)">
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={redo} disabled={!canRedo} title="Wiederholen (Strg+Y)">
              <Redo2 className="h-3.5 w-3.5" />
            </Button>

            <div className="w-px h-5 bg-border mx-0.5 flex-shrink-0" />

            {/* Clipboard */}
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1.5" onClick={copySelection} title="Kopieren (Strg+C)">
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Kopieren</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1.5" onClick={cutSelection} title="Ausschneiden (Strg+X)">
              <Scissors className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ausschneiden</span>
            </Button>

            <div className="w-px h-5 bg-border mx-0.5 flex-shrink-0" />

            {/* Row ops */}
            {selectedRows.size > 0 && (
              <Button
                variant="ghost" size="sm"
                className="h-7 px-2 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={removeSelectedRows}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {selectedRows.size} löschen
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1.5" onClick={() => addRows(10)}>
              <Plus className="h-3.5 w-3.5" />
              10 Zeilen
            </Button>

            {/* AI Import */}
            {aiParseFunction && (
              <>
                <div className="w-px h-5 bg-border mx-0.5 flex-shrink-0" />
                <Button
                  variant="ghost" size="sm"
                  className="h-7 px-2 text-xs gap-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                  onClick={() => setShowAiDialog(true)}
                  title="Text mit KI analysieren und importieren"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  KI-Import
                </Button>
              </>
            )}

            <div className="flex-1" />

            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={clearAll}>
              Leeren
            </Button>

            {/* Keyboard hint */}
            <div className="text-[11px] text-muted-foreground hidden xl:flex items-center gap-2 pl-2 border-l">
              <span>Strg+C Kopieren</span>
              <span>Strg+V Einfügen</span>
              <span>Strg+Z Rückgängig</span>
              <span>Strg+D Ausfüllen</span>
              <span>Rechtsklick Menü</span>
            </div>
          </div>

          {/* Spreadsheet table */}
          <div className="flex-1 overflow-auto min-h-0 relative">
            <div
              ref={tableRef}
              className="focus-visible:outline-none h-full"
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
            >
              <table
                className="border-collapse text-sm"
                style={{ minWidth: columns.reduce((s, c) => s + (c.width ?? 100), 50) + 40 }}
              >
                <thead className="sticky top-0 z-20">
                  <tr>
                    {/* Corner: click to select all */}
                    <th
                      className="w-10 min-w-10 px-2 py-1.5 text-center text-muted-foreground bg-muted border-r border-b cursor-pointer hover:bg-primary/10 select-none text-xs sticky left-0 z-30"
                      onClick={() => selectAll()}
                      title="Alles auswählen (Strg+A)"
                    >
                      #
                    </th>
                    {columns.map((col, ci) => (
                      <th
                        key={col.key}
                        className={cn(
                          'px-2 py-1.5 text-left font-medium whitespace-nowrap border-r border-b cursor-pointer select-none transition-colors',
                          'bg-muted hover:bg-primary/10',
                          selectedCols.has(ci) && 'bg-primary/20 text-primary',
                        )}
                        style={{ minWidth: col.width ?? 100 }}
                        onMouseDown={(e) => handleColHeaderClick(ci, e)}
                        title={`Spalte auswählen: ${col.label}. Shift+Klick zum Erweitern, Strg+Klick für Mehrfachauswahl.`}
                      >
                        <div className="flex items-center gap-1 text-xs leading-none">
                          {col.label}
                          {col.required && <span className="text-destructive font-bold">*</span>}
                        </div>
                        {col.hint && (
                          <div className="text-[10px] font-normal text-muted-foreground mt-0.5 leading-none">{col.hint}</div>
                        )}
                      </th>
                    ))}
                    {/* Spacer for delete buttons */}
                    <th className="w-8 bg-muted border-b" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => {
                    const isRowSel = selectedRows.has(ri);
                    const hasAnyData = columns.some(c => String(row[c.key] ?? '').trim());
                    const rowHasError = hasAnyData && row.errors.length > 0;

                    return (
                      <tr key={row.id} className="group/row">
                        {/* Row number header */}
                        <td
                          className={cn(
                            'px-0 py-0 text-center text-xs border-r border-b cursor-pointer select-none w-10 min-w-10 sticky left-0 z-10',
                            'hover:bg-primary/20 bg-muted/60 text-muted-foreground',
                            isRowSel && 'bg-primary/25 text-primary font-semibold',
                            rowHasError && !isRowSel && 'bg-destructive/10',
                          )}
                          onMouseDown={(e) => handleRowHeaderClick(ri, e)}
                          title="Zeile auswählen. Shift+Klick zum Erweitern, Strg+Klick für Mehrfachauswahl."
                        >
                          <div className="min-h-[28px] flex items-center justify-center px-1">
                            {isRowSel
                              ? <Check className="h-3 w-3" />
                              : rowHasError
                              ? <AlertCircle className="h-3 w-3 text-destructive" />
                              : ri + 1
                            }
                          </div>
                        </td>

                        {/* Data cells */}
                        {columns.map((col, ci) => {
                          const isActive = activeCell?.row === ri && activeCell?.col === ci;
                          const isSelected = isCellSelected(ri, ci);
                          const isEditing = editingCell?.row === ri && editingCell?.col === ci;
                          const value = String(row[col.key] ?? '');

                          return (
                            <td
                              key={col.key}
                              ref={el => {
                                const key = `${ri}-${ci}`;
                                if (el) cellRefs.current.set(key, el);
                                else cellRefs.current.delete(key);
                              }}
                              className={cn(
                                'border-r border-b relative cursor-cell p-0 transition-colors',
                                isSelected && !isActive && 'bg-primary/10',
                                isActive && 'ring-2 ring-inset ring-primary z-10 bg-background',
                                !isActive && !isSelected && rowHasError && col.required && !value && 'bg-destructive/8',
                              )}
                              style={{ minWidth: col.width ?? 100 }}
                              onMouseDown={(e) => handleCellMouseDown(ri, ci, e)}
                              onMouseEnter={() => handleCellMouseEnter(ri, ci)}
                              onClick={(e) => {
                                // Single click enters edit mode directly (no double-click needed)
                                // Skip if modifier keys held (used for range selection)
                                if (e.shiftKey || e.ctrlKey || e.metaKey) return;
                                if (editingCell?.row !== ri || editingCell?.col !== ci) {
                                  startEdit(ri, ci);
                                  clearSelectionModes();
                                }
                              }}
                              onContextMenu={(e) => handleCellContextMenu(ri, ci, e)}
                            >
                              {isEditing ? (
                                <input
                                  ref={el => {
                                    inputRef.current = el;
                                    if (el) {
                                      el.focus();
                                      if (editModeRef.current === 'append') {
                                        el.setSelectionRange(el.value.length, el.value.length);
                                      }
                                    }
                                  }}
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={commitEdit}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1 bg-white border-0 focus:outline-none focus:ring-0 text-sm min-h-[28px]"
                                  style={{ minWidth: (col.width ?? 100) - 2 }}
                                />
                              ) : (
                                <div className="px-2 py-1 truncate min-h-[28px] flex items-center text-sm leading-tight">
                                  {value}
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* Per-row delete button */}
                        <td className="border-b w-8 p-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            tabIndex={-1}
                            className="h-[28px] w-8 rounded-none opacity-0 group-hover/row:opacity-60 hover:!opacity-100 hover:text-destructive"
                            onClick={() => removeRow(ri)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Add-more-rows footer row */}
                  <tr>
                    <td
                      colSpan={columns.length + 2}
                      className="px-4 py-2 text-xs text-muted-foreground cursor-pointer hover:bg-muted/40 border-b text-center select-none"
                      onClick={() => addRows(10)}
                    >
                      + 10 weitere Zeilen hinzufügen
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Validation error summary */}
          {errorRows.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-destructive bg-destructive/5 border-t flex-shrink-0">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {errorRows.length} Zeile(n) haben Validierungsfehler und werden beim Import übersprungen.
              Fahren Sie über die Zeilennummer für Details.
            </div>
          )}

          {/* Footer */}
          <DialogFooter className="px-5 py-3 border-t bg-muted/20 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={handleClose}>
              Abbrechen
            </Button>
            <Button size="sm" onClick={handleImport} disabled={isImporting || validRows.length === 0}>
              {isImporting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importiere...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" />{validRows.length} Datensätze importieren</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Context Menu (Portal) ────────────────────────────────── */}
      {contextMenu && createPortal(
        <div
          className="fixed z-[300] bg-popover border rounded-md shadow-lg py-1 min-w-[195px] text-sm select-none"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-accent flex items-center gap-2"
            onClick={() => { startEdit(contextMenu.row, contextMenu.col); closeContextMenu(); }}
          >
            Bearbeiten
            <kbd className="ml-auto text-[10px] text-muted-foreground bg-muted px-1 rounded">F2</kbd>
          </button>

          <div className="h-px bg-border my-1" />

          <button
            className="w-full px-3 py-1.5 text-left hover:bg-accent flex items-center gap-2"
            onClick={() => { copySelection(); closeContextMenu(); }}
          >
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            Kopieren
            <kbd className="ml-auto text-[10px] text-muted-foreground bg-muted px-1 rounded">Strg+C</kbd>
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-accent flex items-center gap-2"
            onClick={() => { cutSelection(); closeContextMenu(); }}
          >
            <Scissors className="h-3.5 w-3.5 text-muted-foreground" />
            Ausschneiden
            <kbd className="ml-auto text-[10px] text-muted-foreground bg-muted px-1 rounded">Strg+X</kbd>
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-accent flex items-center gap-2"
            onClick={() => { pasteFromClipboard(); closeContextMenu(); }}
          >
            Einfügen
            <kbd className="ml-auto text-[10px] text-muted-foreground bg-muted px-1 rounded">Strg+V</kbd>
          </button>

          <div className="h-px bg-border my-1" />

          <button
            className="w-full px-3 py-1.5 text-left hover:bg-accent"
            onClick={() => { clearSelection(); closeContextMenu(); }}
          >
            Inhalt löschen
            <kbd className="ml-1 text-[10px] text-muted-foreground bg-muted px-1 rounded">Del</kbd>
          </button>

          <div className="h-px bg-border my-1" />

          <button
            className="w-full px-3 py-1.5 text-left hover:bg-accent"
            onClick={() => { insertRowAt(contextMenu.row, 'above'); closeContextMenu(); }}
          >
            Zeile oben einfügen
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-accent"
            onClick={() => { insertRowAt(contextMenu.row, 'below'); closeContextMenu(); }}
          >
            Zeile unten einfügen
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-accent text-destructive"
            onClick={ctxDeleteRows}
          >
            <Trash2 className="h-3.5 w-3.5 inline mr-2" />
            {selectedRows.size > 1 ? `${selectedRows.size} Zeilen löschen` : 'Zeile löschen'}
          </button>

          <div className="h-px bg-border my-1" />

          <button
            className="w-full px-3 py-1.5 text-left hover:bg-accent flex items-center gap-2"
            onClick={() => { fillDown(); closeContextMenu(); }}
          >
            Nach unten ausfüllen
            <kbd className="ml-auto text-[10px] text-muted-foreground bg-muted px-1 rounded">Strg+D</kbd>
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-accent flex items-center gap-2"
            onClick={() => { fillRight(); closeContextMenu(); }}
          >
            Nach rechts ausfüllen
            <kbd className="ml-auto text-[10px] text-muted-foreground bg-muted px-1 rounded">Strg+R</kbd>
          </button>
        </div>,
        document.body,
      )}

      {/* ─── AI Parse Dialog ────────────────────────────────────── */}
      {aiParseFunction && (
        <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                KI-Datenimport
              </DialogTitle>
              <DialogDescription>
                Fügen Sie beliebigen Text ein (E-Mail, Word, PDF, Liste) – die KI erkennt die Daten automatisch und trägt sie in die Tabelle ein.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Text hier einfügen oder tippen..."
              className="min-h-[200px] font-mono text-sm resize-y"
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAiDialog(false); setAiText(''); }}>
                Abbrechen
              </Button>
              <Button
                onClick={handleAiParse}
                disabled={aiParsing || !aiText.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {aiParsing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analysiere...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" />Mit KI analysieren</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
