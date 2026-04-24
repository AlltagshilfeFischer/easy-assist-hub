import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { generateUUID } from '@/lib/uuid';
import { Button } from '@/components/ui/button';
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
import {
  Download,
  Upload,
  AlertCircle,
  Check,
  Plus,
  Trash2,
  X,
  FileDown,
  Loader2,
  Users,
  ChevronDown,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useEmployees } from '@/hooks/useEmployees';

// ─── Template-Spalten (Reihenfolge = Vorlage) ─────────────────────────────────

interface ColumnDef {
  key: keyof CustomerRow;
  label: string;
  required?: boolean;
  width: number;
  hint?: string;
  validate?: (v: string) => string | null;
}

const COLUMNS: ColumnDef[] = [
  { key: 'vorname', label: 'Vorname', required: true, width: 110 },
  { key: 'nachname', label: 'Nachname', required: true, width: 120 },
  { key: 'mitarbeiter_name', label: 'Mitarbeiter', width: 130 },
  {
    key: 'pflegegrad',
    label: 'Pflegegrad',
    width: 90,
    hint: '0–5',
    validate: (v) =>
      v && (isNaN(Number(v)) || Number(v) < 0 || Number(v) > 5)
        ? 'Pflegegrad 0–5'
        : null,
  },
  { key: 'strasse', label: 'Straße', width: 150 },
  {
    key: 'plz',
    label: 'PLZ',
    width: 75,
    validate: (v) => (v && !/^\d{5}$/.test(v) ? 'PLZ: 5 Ziffern' : null),
  },
  { key: 'stadt', label: 'Stadt', width: 110 },
  { key: 'stadtteil', label: 'Stadtteil', width: 100 },
  {
    key: 'geburtsdatum',
    label: 'Geburtsdatum',
    width: 120,
    hint: 'TT.MM.JJJJ',
    validate: (v) =>
      v && !/^(\d{2})\.(\d{2})\.(\d{4})$/.test(v) ? 'Datum: TT.MM.JJJJ' : null,
  },
  { key: 'pflegekasse', label: 'Pflegekasse', width: 130 },
  { key: 'versichertennummer', label: 'Versichertennr.', width: 130 },
  {
    key: 'verhinderungspflege',
    label: 'Verhinderungspflege',
    width: 155,
    hint: 'Ja/Nein/Beantragt',
    validate: (v) =>
      v && !['ja', 'nein', 'beantragt'].includes(v.toLowerCase())
        ? 'Ja / Nein / Beantragt'
        : null,
  },
  { key: 'telefonnr', label: 'Telefon', width: 130 },
  {
    key: 'kasse_privat',
    label: 'Kasse/Privat',
    width: 110,
    hint: 'Kasse/Privat/Beides',
    validate: (v) =>
      v && !['kasse', 'privat', 'beides'].includes(v.toLowerCase())
        ? 'Kasse / Privat / Beides'
        : null,
  },
  {
    key: 'kopie_lw',
    label: 'Kopie LW',
    width: 85,
    hint: 'Ja/Nein',
    validate: (v) =>
      v && !['ja', 'nein'].includes(v.toLowerCase()) ? 'Ja / Nein' : null,
  },
  {
    key: 'status',
    label: 'Status',
    width: 90,
    hint: 'Aktiv/Inaktiv',
    validate: (v) =>
      v && !['aktiv', 'inaktiv'].includes(v.toLowerCase()) ? 'Aktiv / Inaktiv' : null,
  },
  {
    key: 'stunden',
    label: 'Stunden',
    width: 85,
    hint: 'z.B. 8,5',
    validate: (v) => {
      if (!v) return null;
      const n = parseFloat(v.replace(',', '.'));
      return isNaN(n) ? 'Zahl, z.B. 8,5' : null;
    },
  },
  { key: 'tage', label: 'Tage', width: 110, hint: 'z.B. Mo, Mi, Fr' },
  { key: 'sonstiges', label: 'Sonstiges', width: 150 },
  {
    key: 'angehoerige',
    label: 'Angehörige/Ansprechpartner',
    width: 220,
    hint: 'Name|Beziehung|Tel; ...',
  },
];

// Spalten die in der Tabelle ausgeblendet werden (seltene Fehler, viel Breite)
const HIDDEN_IN_REVIEW = new Set<string>(['tage', 'sonstiges', 'angehoerige']);
const REVIEW_COLUMNS = COLUMNS.filter((c) => !HIDDEN_IN_REVIEW.has(c.key as string));

// Map from template header labels → column keys (für CSV/XLSX-Import)
const HEADER_MAP: Record<string, keyof CustomerRow> = {
  'Vorname': 'vorname',
  'Nachname': 'nachname',
  'Mitarbeiter': 'mitarbeiter_name',
  'Pflegegrad': 'pflegegrad',
  'Straße': 'strasse',
  'Strasse': 'strasse',
  'PLZ': 'plz',
  'Stadt': 'stadt',
  'Stadtteil': 'stadtteil',
  'Geburtsdatum': 'geburtsdatum',
  'Pflegekasse': 'pflegekasse',
  'Versichertennummer': 'versichertennummer',
  'Versichertennr.': 'versichertennummer',
  'Verhinderungspflege': 'verhinderungspflege',
  'Telefon': 'telefonnr',
  'Teiefon': 'telefonnr',
  'Kasse/Privat': 'kasse_privat',
  'Kopie LW': 'kopie_lw',
  'Status': 'status',
  'Stunden': 'stunden',
  'Tage': 'tage',
  'Sonstiges': 'sonstiges',
  'Angehörige/Ansprechpartner': 'angehoerige',
  'Angehoerige/Ansprechpartner': 'angehoerige',
};

// ─── Typen ─────────────────────────────────────────────────────────────────────

interface CustomerRow {
  id: string;
  vorname: string;
  nachname: string;
  mitarbeiter_name: string;
  pflegegrad: string;
  strasse: string;
  plz: string;
  stadt: string;
  stadtteil: string;
  geburtsdatum: string;
  pflegekasse: string;
  versichertennummer: string;
  verhinderungspflege: string;
  telefonnr: string;
  kasse_privat: string;
  kopie_lw: string;
  status: string;
  stunden: string;
  tage: string;
  sonstiges: string;
  angehoerige: string;
  errors: string[];
  warnings: string[];
}

interface CellPosition {
  row: number;
  col: number;
}

interface CustomerImportExportProps {
  customers: any[];
}

// ─── Hilfsfunktionen ───────────────────────────────────────────────────────────

const createEmptyRow = (): CustomerRow => ({
  id: generateUUID(),
  vorname: '',
  nachname: '',
  mitarbeiter_name: '',
  pflegegrad: '',
  strasse: '',
  plz: '',
  stadt: '',
  stadtteil: '',
  geburtsdatum: '',
  pflegekasse: '',
  versichertennummer: '',
  verhinderungspflege: '',
  telefonnr: '',
  kasse_privat: '',
  kopie_lw: '',
  status: '',
  stunden: '',
  tage: '',
  sonstiges: '',
  angehoerige: '',
  errors: [],
  warnings: [],
});

const createInitialRows = (count: number): CustomerRow[] =>
  Array.from({ length: count }, createEmptyRow);

const parseGermanDate = (dateStr: string): string | null => {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

const formatDateToGerman = (isoDate: string | null): string => {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

const escapeCSV = (v: string | number | boolean | null | undefined): string => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

// ─── Haupt-Komponente ──────────────────────────────────────────────────────────

export function CustomerImportExport({ customers }: CustomerImportExportProps) {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [rows, setRows] = useState<CustomerRow[]>(createInitialRows(20));
  const [isImporting, setIsImporting] = useState(false);
  const [activeCell, setActiveCell] = useState<CellPosition | null>(null);
  const [selectionStart, setSelectionStart] = useState<CellPosition | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<CellPosition | null>(null);
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [editValue, setEditValue] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [showValidRows, setShowValidRows] = useState(false);
  // csvName (lowercase) → employee ID oder '' (= nicht zuordnen)
  const [mitarbeiterMappings, setMitarbeiterMappings] = useState<Record<string, string>>({});
  const tableRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: employees = [] } = useEmployees({ includeInactive: true });

  // Mitarbeiter-Name → ID Map (Vorname + Nachname)
  const employeeNameMap = useMemo(
    () =>
      new Map<string, string>(
        employees.map((e) => [`${e.vorname} ${e.nachname}`.toLowerCase().trim(), e.id]),
      ),
    [employees],
  );

  // Eindeutige Mitarbeiter-Namen, die noch weder automatisch noch manuell aufgelöst wurden
  const unmatchedMitarbeiterNames = useMemo(() => {
    const names = new Set<string>();
    for (const row of rows) {
      const raw = row.mitarbeiter_name.trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!employeeNameMap.has(key) && !mitarbeiterMappings[key]) names.add(raw);
    }
    return Array.from(names).sort();
  }, [rows, employeeNameMap, mitarbeiterMappings]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // ─── Validierung ──────────────────────────────────────────────────────────────

  const validateRow = (row: CustomerRow): { errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!row.vorname.trim()) errors.push('Vorname fehlt');
    if (!row.nachname.trim()) errors.push('Nachname fehlt');

    for (const col of COLUMNS) {
      if (!col.validate) continue;
      const val = (row as Record<string, string>)[col.key as string] as string;
      const msg = col.validate(val);
      if (msg) errors.push(msg);
    }

    if (row.mitarbeiter_name.trim()) {
      const key = row.mitarbeiter_name.toLowerCase().trim();
      if (!employeeNameMap.has(key)) {
        warnings.push(`Mitarbeiter "${row.mitarbeiter_name}" nicht gefunden`);
      }
    }

    return { errors, warnings };
  };

  const updateCell = (rowIndex: number, colKey: keyof CustomerRow, value: string) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row;
        const updated = { ...row, [colKey]: value };
        const { errors, warnings } = validateRow(updated);
        return { ...updated, errors, warnings };
      }),
    );
  };

  // ─── Selektion ─────────────────────────────────────────────────────────────────

  const getSelection = () => {
    if (!selectionStart || !selectionEnd) return null;
    return {
      minRow: Math.min(selectionStart.row, selectionEnd.row),
      maxRow: Math.max(selectionStart.row, selectionEnd.row),
      minCol: Math.min(selectionStart.col, selectionEnd.col),
      maxCol: Math.max(selectionStart.col, selectionEnd.col),
    };
  };

  const isCellSelected = (row: number, col: number) => {
    const sel = getSelection();
    return sel ? row >= sel.minRow && row <= sel.maxRow && col >= sel.minCol && col <= sel.maxCol : false;
  };

  // ─── Keyboard / Maus ──────────────────────────────────────────────────────────

  const handleCellClick = (row: number, col: number, e: React.MouseEvent) => {
    if (e.shiftKey && activeCell) {
      setSelectionEnd({ row, col });
    } else {
      setActiveCell({ row, col });
      setSelectionStart({ row, col });
      setSelectionEnd({ row, col });
    }
    setEditingCell(null);
  };

  const handleCellDoubleClick = (row: number, col: number) => {
    setEditingCell({ row, col });
    setEditValue((rows[row] as Record<string, string>)[REVIEW_COLUMNS[col].key as string] || '');
  };

  const commitEdit = () => {
    if (editingCell) {
      updateCell(editingCell.row, REVIEW_COLUMNS[editingCell.col].key, editValue);
      setEditingCell(null);
    }
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!activeCell) return;

      if (editingCell) {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitEdit();
          if (activeCell.row < rows.length - 1) {
            const p = { row: activeCell.row + 1, col: activeCell.col };
            setActiveCell(p);
            setSelectionStart(p);
            setSelectionEnd(p);
          }
        } else if (e.key === 'Escape') {
          setEditingCell(null);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          commitEdit();
          const nc = e.shiftKey ? activeCell.col - 1 : activeCell.col + 1;
          if (nc >= 0 && nc < REVIEW_COLUMNS.length) {
            const p = { row: activeCell.row, col: nc };
            setActiveCell(p);
            setSelectionStart(p);
            setSelectionEnd(p);
          }
        }
        return;
      }

      let nr = activeCell.row;
      let nc = activeCell.col;

      switch (e.key) {
        case 'ArrowUp': e.preventDefault(); nr = Math.max(0, nr - 1); break;
        case 'ArrowDown': e.preventDefault(); nr = Math.min(rows.length - 1, nr + 1); break;
        case 'ArrowLeft': e.preventDefault(); nc = Math.max(0, nc - 1); break;
        case 'ArrowRight': e.preventDefault(); nc = Math.min(REVIEW_COLUMNS.length - 1, nc + 1); break;
        case 'Tab':
          e.preventDefault();
          nc = e.shiftKey ? nc - 1 : nc + 1;
          if (nc < 0) { nc = REVIEW_COLUMNS.length - 1; nr = Math.max(0, nr - 1); }
          else if (nc >= REVIEW_COLUMNS.length) { nc = 0; nr = Math.min(rows.length - 1, nr + 1); }
          break;
        case 'Enter':
          e.preventDefault();
          handleCellDoubleClick(activeCell.row, activeCell.col);
          return;
        case 'Delete':
        case 'Backspace': {
          e.preventDefault();
          const sel = getSelection();
          if (sel) {
            setRows((prev) =>
              prev.map((row, ri) => {
                if (ri < sel.minRow || ri > sel.maxRow) return row;
                const updated = { ...row };
                for (let ci = sel.minCol; ci <= sel.maxCol; ci++) {
                  (updated as Record<string, string>)[REVIEW_COLUMNS[ci].key as string] = '';
                }
                const { errors, warnings } = validateRow(updated);
                return { ...updated, errors, warnings };
              }),
            );
          }
          return;
        }
        case 'F2':
          e.preventDefault();
          handleCellDoubleClick(activeCell.row, activeCell.col);
          return;
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            setEditingCell(activeCell);
            setEditValue(e.key);
            return;
          }
      }

      const p = { row: nr, col: nc };
      if (e.shiftKey && e.key.startsWith('Arrow')) {
        setSelectionEnd(p);
      } else {
        setSelectionStart(p);
        setSelectionEnd(p);
      }
      setActiveCell(p);
    },
    [activeCell, editingCell, rows, editValue],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const text = e.clipboardData.getData('text');
      if (!text) return;
      e.preventDefault();

      const lines = text.split('\n').filter((l) => l.trim());
      const startRow = activeCell?.row ?? 0;
      const startCol = activeCell?.col ?? 0;

      setRows((prev) => {
        const next = [...prev];
        while (next.length < startRow + lines.length) next.push(createEmptyRow());

        lines.forEach((line, li) => {
          const cells = line.split('\t');
          const ri = startRow + li;
          cells.forEach((val, ci) => {
            const colIdx = startCol + ci;
            if (colIdx < REVIEW_COLUMNS.length) {
              (next[ri] as Record<string, string>)[REVIEW_COLUMNS[colIdx].key as string] = val.trim();
            }
          });
          const { errors, warnings } = validateRow(next[ri]);
          next[ri] = { ...next[ri], errors, warnings };
        });

        return next;
      });

      toast.success(`${lines.length} Zeile(n) eingefügt`);
    },
    [activeCell],
  );

  // ─── Datei-Upload (CSV + XLSX) ─────────────────────────────────────────────────

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: (result) => populateFromParsed(result.data as Record<string, string>[]),
        error: (err) => toast.error(`CSV-Fehler: ${err.message}`),
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const wb = XLSX.read(ev.target?.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
          populateFromParsed(data);
        } catch (err: unknown) {
          toast.error(`Excel-Fehler: ${(err as Error).message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error('Nur CSV oder XLSX/XLS erlaubt');
    }
  };

  const populateFromParsed = (data: Record<string, string>[]) => {
    if (!data.length) {
      toast.error('Datei ist leer oder hat kein erkennbares Format');
      return;
    }

    const mapped: CustomerRow[] = data.map((rawRow) => {
      const row = createEmptyRow();
      for (const [header, value] of Object.entries(rawRow)) {
        const trimmedHeader = header.trim();
        const key = HEADER_MAP[trimmedHeader];
        if (key) {
          (row as Record<string, string>)[key as string] = String(value ?? '').trim();
        }
      }
      const { errors, warnings } = validateRow(row);
      return { ...row, errors, warnings };
    });

    // Auffüllen auf mindestens 20 Zeilen
    while (mapped.length < 20) mapped.push(createEmptyRow());
    setRows(mapped);
    setMitarbeiterMappings({});
    setActiveCell(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    toast.success(`${data.length} Zeile(n) aus Datei geladen`);
  };

  // ─── Template-Download ────────────────────────────────────────────────────────

  const handleTemplateDownload = () => {
    const headers = COLUMNS.map((c) => c.label);
    const ws = XLSX.utils.aoa_to_sheet([headers]);

    // Spaltenbreiten setzen
    ws['!cols'] = COLUMNS.map((c) => ({ wch: Math.round(c.width / 7) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kunden-Vorlage');
    XLSX.writeFile(wb, 'kunden_vorlage.xlsx');
  };

  // ─── Zeilen-Verwaltung ────────────────────────────────────────────────────────

  const addRows = (count: number) =>
    setRows((prev) => [...prev, ...createInitialRows(count)]);

  const removeRow = (index: number) =>
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

  const clearAll = () => {
    setRows(createInitialRows(20));
    setMitarbeiterMappings({});
    setActiveCell(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    setEditingCell(null);
    setImportErrors([]);
  };

  // ─── Import ───────────────────────────────────────────────────────────────────

  const validRowCount = rows.filter(
    (r) => r.vorname.trim() && r.nachname.trim() && r.errors.length === 0,
  ).length;

  const errorRowCount = rows.filter(
    (r) => (r.vorname.trim() || r.nachname.trim()) && r.errors.length > 0,
  ).length;

  const handleImport = async () => {
    setImportErrors([]);

    const filledRows = rows.filter((r) => r.vorname.trim() || r.nachname.trim());

    // Validierungsfehler → Abbruch
    const errorLines: string[] = [];
    filledRows.forEach((row, idx) => {
      if (row.errors.length > 0) {
        errorLines.push(`Zeile ${idx + 1} (${row.vorname} ${row.nachname}): ${row.errors.join(', ')}`);
      }
    });

    if (errorLines.length > 0) {
      setImportErrors(errorLines);
      return;
    }

    const validRows = filledRows.filter((r) => r.errors.length === 0);
    if (!validRows.length) {
      toast.error('Keine gültigen Daten vorhanden');
      return;
    }

    setIsImporting(true);

    try {
      // Vorhandene Kunden laden für Duplikat-Check
      const { data: existingCustomers, error: fetchErr } = await supabase
        .from('kunden')
        .select('vorname, nachname, geburtsdatum');
      if (fetchErr) throw fetchErr;

      const existingSet = new Set(
        (existingCustomers ?? []).map((c) =>
          `${c.vorname?.toLowerCase()}|${c.nachname?.toLowerCase()}|${c.geburtsdatum ?? ''}`,
        ),
      );

      const skipped: string[] = [];
      const toInsert: Parameters<ReturnType<typeof supabase.from>['insert']>[0][] = [];

      for (const row of validRows) {
        const geb = parseGermanDate(row.geburtsdatum);
        const dupKey = `${row.vorname.toLowerCase()}|${row.nachname.toLowerCase()}|${geb ?? ''}`;

        if (existingSet.has(dupKey)) {
          skipped.push(`${row.vorname} ${row.nachname} (Duplikat übersprungen)`);
          continue;
        }

        // Mitarbeiter-ID auflösen: erst manuelle Zuordnung, dann exakter Name-Match
        const maKey = row.mitarbeiter_name.toLowerCase().trim();
        const mitarbeiterId = maKey
          ? (mitarbeiterMappings[maKey] || employeeNameMap.get(maKey) || null)
          : null;

        // Verhinderungspflege mappen
        const verhNorm = row.verhinderungspflege.toLowerCase().trim();
        const verhAktiv = verhNorm === 'ja';
        const verhBeantragt = verhNorm === 'beantragt';

        // Stunden parsen
        const stundenRaw = row.stunden.replace(',', '.');
        const stunden = stundenRaw ? parseFloat(stundenRaw) : null;

        toInsert.push({
          vorname: row.vorname.trim(),
          nachname: row.nachname.trim(),
          mitarbeiter: mitarbeiterId,
          pflegegrad: row.pflegegrad ? parseInt(row.pflegegrad, 10) : null,
          strasse: row.strasse.trim() || null,
          plz: row.plz.trim() || null,
          stadt: row.stadt.trim() || null,
          stadtteil: row.stadtteil.trim() || null,
          geburtsdatum: geb,
          pflegekasse: row.pflegekasse.trim() || null,
          versichertennummer: row.versichertennummer.trim() || null,
          verhinderungspflege_aktiv: verhAktiv || null,
          verhinderungspflege_beantragt: verhBeantragt || null,
          telefonnr: row.telefonnr.trim() || null,
          kasse_privat: row.kasse_privat.trim() || null,
          kopie_lw: row.kopie_lw.trim() || null,
          aktiv: row.status.toLowerCase().trim() !== 'inaktiv',
          stunden_kontingent_monat: stunden && !isNaN(stunden) ? stunden : null,
          tage: row.tage.trim() || null,
          sonstiges: row.sonstiges.trim() || null,
          angehoerige_ansprechpartner: row.angehoerige.trim() || null,
          kategorie: 'Kunde',
        });
      }

      if (!toInsert.length && skipped.length > 0) {
        toast.warning(`Alle ${skipped.length} Kunden bereits vorhanden — Import übersprungen`);
        return;
      }

      const { error: insertErr } = await supabase.from('kunden').insert(toInsert);
      if (insertErr) throw insertErr;

      const msgs: string[] = [`${toInsert.length} Kunde(n) importiert`];
      if (skipped.length) msgs.push(`${skipped.length} Duplikat(e) übersprungen`);

      // Mitarbeiter-Warnungen: Namen die weder per Map noch per manueller Zuordnung aufgelöst wurden
      const maWarnings = validRows
        .filter((r) => {
          const k = r.mitarbeiter_name.toLowerCase().trim();
          return k && !employeeNameMap.has(k) && !mitarbeiterMappings[k];
        })
        .map((r) => `Mitarbeiter "${r.mitarbeiter_name}" nicht zugeordnet — Feld bleibt leer`);

      if (maWarnings.length) {
        setImportErrors(maWarnings);
        toast.warning(msgs.join(' · ') + ` — ${maWarnings.length} Mitarbeiter-Warnung(en)`);
      } else {
        toast.success(msgs.join(' · '));
        setShowImportDialog(false);
        clearAll();
      }

      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (err: unknown) {
      toast.error(`Import fehlgeschlagen: ${(err as Error).message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // ─── Export (CSV + XLSX) ──────────────────────────────────────────────────────

  const handleExport = (format: 'csv' | 'xlsx') => {
    if (!customers?.length) {
      toast.error('Keine Daten zum Exportieren');
      return;
    }

    // Mitarbeiter-ID → Name Map für Export
    const idToName = new Map<string, string>(
      employees.map((e) => [e.id, `${e.vorname} ${e.nachname}`]),
    );

    const headers = ['Kundennr', ...COLUMNS.map((c) => c.label)];

    const dataRows = customers.map((c) => [
      c.kunden_nummer ?? '',
      c.vorname ?? '',
      c.nachname ?? '',
      c.mitarbeiter ? (idToName.get(c.mitarbeiter) ?? '') : '',
      c.pflegegrad ?? '',
      c.strasse ?? '',
      c.plz ?? '',
      c.stadt ?? '',
      c.stadtteil ?? '',
      formatDateToGerman(c.geburtsdatum),
      c.pflegekasse ?? '',
      c.versichertennummer ?? '',
      c.verhinderungspflege_aktiv === true
        ? 'Ja'
        : c.verhinderungspflege_beantragt === true
          ? 'Beantragt'
          : c.verhinderungspflege_aktiv === false
            ? 'Nein'
            : '',
      c.telefonnr ?? '',
      c.kasse_privat ?? '',
      c.kopie_lw ?? '',
      c.aktiv === false ? 'Inaktiv' : 'Aktiv',
      c.stunden_kontingent_monat != null
        ? String(c.stunden_kontingent_monat).replace('.', ',')
        : '',
      c.tage ?? '',
      c.sonstiges ?? '',
      c.angehoerige_ansprechpartner ?? '',
    ]);

    if (format === 'csv') {
      const csv = [headers, ...dataRows].map((row) => row.map(escapeCSV).join(',')).join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `kunden_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } else {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      ws['!cols'] = headers.map((_, i) =>
        i === 0 ? { wch: 10 } : { wch: Math.round(COLUMNS[i - 1].width / 7) },
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Kunden');
      XLSX.writeFile(wb, `kunden_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    toast.success(`${customers.length} Kunde(n) exportiert`);
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Buttons in der Toolbar */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleExport('xlsx')}>
          <Download className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Import-Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-[95vw] w-full max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Kunden importieren</DialogTitle>
            <DialogDescription>
              Datei hochladen (CSV / XLSX) oder Daten direkt einfügen (Strg+V aus Excel).
              Navigation: Pfeiltasten, Tab, Enter. Doppelklick zum Bearbeiten.
            </DialogDescription>
          </DialogHeader>

          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap text-sm px-6 py-2 border-b bg-muted/30">
            {/* Datei-Upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3 w-3 mr-1" />
              Datei laden
            </Button>
            <Button variant="outline" size="sm" onClick={handleTemplateDownload}>
              <FileDown className="h-3 w-3 mr-1" />
              Vorlage
            </Button>

            <div className="h-4 border-l" />

            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
              * Pflichtfeld
            </Badge>
            {validRowCount > 0 && (
              <span className="flex items-center gap-1 text-green-600 text-xs">
                <Check className="h-3 w-3" />
                {validRowCount} gültig
              </span>
            )}
            {errorRowCount > 0 && (
              <span className="flex items-center gap-1 text-red-600 text-xs">
                <AlertCircle className="h-3 w-3" />
                {errorRowCount} fehlerhaft
              </span>
            )}

            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => addRows(10)}>
              <Plus className="h-3 w-3 mr-1" />
              10 Zeilen
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X className="h-3 w-3 mr-1" />
              Leeren
            </Button>
          </div>

          {/* Fehler-Bereich */}
          {importErrors.length > 0 && (
            <div className="mx-6 my-2 p-3 rounded-md bg-red-50 border border-red-200">
              <p className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {importErrors.some((e) => e.includes('nicht zugeordnet'))
                  ? 'Warnungen (Import trotzdem möglich):'
                  : 'Import abgebrochen — bitte Fehler beheben:'}
              </p>
              <ul className="text-xs text-red-600 space-y-0.5 max-h-24 overflow-y-auto">
                {importErrors.map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Mitarbeiter-Zuordnung */}
          {unmatchedMitarbeiterNames.length > 0 && (
            <div className="mx-6 my-2 p-3 rounded-md bg-blue-50 border border-blue-200">
              <p className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1">
                <Users className="h-3 w-3" />
                Mitarbeiter zuordnen ({unmatchedMitarbeiterNames.length} nicht erkannt)
              </p>
              <div className="space-y-2">
                {unmatchedMitarbeiterNames.map((name) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-40 truncate shrink-0" title={name}>
                      {name}
                    </span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <Select
                      value={mitarbeiterMappings[name.toLowerCase()] ?? ''}
                      onValueChange={(val) =>
                        setMitarbeiterMappings((prev) => ({
                          ...prev,
                          [name.toLowerCase()]: val === '__none__' ? '' : val,
                        }))
                      }
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue placeholder="Mitarbeiter auswählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">— Nicht zuordnen</span>
                        </SelectItem>
                        {employees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.vorname} {e.nachname}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Zeilen-Übersicht */}
          {(errorRowCount > 0 || validRowCount > 0) && (
            <div className="mx-6 mb-2 space-y-2">
              {errorRowCount > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                    <span className="text-sm font-semibold text-red-700">
                      {errorRowCount} Zeile{errorRowCount !== 1 ? 'n' : ''} mit Fehlern — bitte korrigieren
                    </span>
                  </div>
                  <div className="border-t border-red-200 divide-y divide-red-100 max-h-40 overflow-y-auto">
                    {rows
                      .filter((r) => (r.vorname.trim() || r.nachname.trim()) && r.errors.length > 0)
                      .map((row) => (
                        <div key={row.id} className="px-3 py-1.5 flex items-baseline gap-2 text-xs">
                          <span className="font-medium text-red-700 shrink-0">
                            {row.vorname} {row.nachname}
                          </span>
                          <span className="text-red-500">{row.errors.join(' · ')}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {validRowCount > 0 && (
                <Collapsible open={showValidRows} onOpenChange={setShowValidRows}>
                  <CollapsibleTrigger className="w-full text-left">
                    <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 flex items-center justify-between hover:bg-green-100 transition-colors">
                      <span className="text-sm font-medium text-green-700 flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        {validRowCount} Zeile{validRowCount !== 1 ? 'n' : ''} bereit zum Import
                      </span>
                      <ChevronDown className={`h-4 w-4 text-green-600 transition-transform ${showValidRows ? 'rotate-180' : ''}`} />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border border-green-200 border-t-0 rounded-b-md divide-y divide-green-100 max-h-40 overflow-y-auto">
                      {rows
                        .filter((r) => (r.vorname.trim() || r.nachname.trim()) && r.errors.length === 0)
                        .map((row) => (
                          <div key={row.id} className="px-3 py-1.5 flex items-center gap-2 text-xs text-green-700">
                            <Check className="h-3 w-3 text-green-500 shrink-0" />
                            <span>{row.vorname} {row.nachname}</span>
                            {row.warnings.length > 0 && (
                              <span className="text-yellow-600 ml-1">({row.warnings.join(', ')})</span>
                            )}
                          </div>
                        ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}

          {/* Tabelle */}
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
                  <th className="p-0 w-8 border-r border-b bg-muted text-center text-xs text-muted-foreground">#</th>
                  {REVIEW_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="p-2 text-left font-medium text-xs border-r border-b whitespace-nowrap bg-muted"
                      style={{ minWidth: col.width }}
                    >
                      {col.label}
                      {col.required && <span className="text-red-500 ml-0.5">*</span>}
                      {col.hint && (
                        <span className="block text-[10px] font-normal text-muted-foreground">
                          {col.hint}
                        </span>
                      )}
                    </th>
                  ))}
                  <th className="p-2 w-14 border-b bg-muted text-xs text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => {
                  const hasContent = row.vorname.trim() || row.nachname.trim();
                  const hasErrors = row.errors.length > 0;
                  const hasWarnings = row.warnings.length > 0;
                  const isValid = hasContent && !hasErrors;

                  // Valide Zeilen aus der Tabelle ausblenden — sie sind im grünen Block
                  if (isValid) return null;

                  return (
                    <tr key={row.id} className="group">
                      <td className="p-0 text-center text-xs text-muted-foreground border-r border-b bg-muted/50 relative">
                        <span className="group-hover:hidden">{rowIndex + 1}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 hidden group-hover:flex absolute inset-0 m-auto hover:text-destructive"
                          onClick={() => removeRow(rowIndex)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                      {REVIEW_COLUMNS.map((col, colIndex) => {
                        const isActive =
                          activeCell?.row === rowIndex && activeCell?.col === colIndex;
                        const isSelected = isCellSelected(rowIndex, colIndex);
                        const isEditing =
                          editingCell?.row === rowIndex && editingCell?.col === colIndex;
                        const cellValue =
                          (row as Record<string, string>)[col.key as string] || '';

                        return (
                          <td
                            key={col.key}
                            className={[
                              'p-0 border-r border-b relative cursor-cell',
                              isSelected && !isActive ? 'bg-primary/10' : '',
                              isActive ? 'ring-2 ring-primary ring-inset z-10' : '',
                            ].join(' ')}
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
                              </div>
                            )}
                          </td>
                        );
                      })}
                      {/* Status-Spalte */}
                      <td className="p-1 border-b text-center">
                        {hasContent && (
                          isValid ? (
                            hasWarnings ? (
                              <div className="group/warn relative inline-flex">
                                <AlertCircle className="h-4 w-4 text-amber-500 cursor-help" />
                                <div className="absolute right-0 top-6 z-30 hidden group-hover/warn:block bg-popover border rounded-md p-2 shadow-lg min-w-[180px] text-left">
                                  <ul className="text-xs text-amber-600 space-y-0.5">
                                    {row.warnings.map((w, i) => (
                                      <li key={i}>⚠ {w}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            ) : (
                              <Check className="h-4 w-4 text-green-600 mx-auto" />
                            )
                          ) : (
                            <div className="group/err relative inline-flex">
                              <AlertCircle className="h-4 w-4 text-red-500 cursor-help" />
                              <div className="absolute right-0 top-6 z-30 hidden group-hover/err:block bg-popover border rounded-md p-2 shadow-lg min-w-[180px] text-left">
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
              Pfeiltasten: Navigation · Enter/F2: Bearbeiten · Tab: Nächste Zelle · Del: Löschen · Shift+Klick: Auswahl
            </div>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleImport}
              disabled={validRowCount === 0 || isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importiere...
                </>
              ) : (
                `${validRowCount} Kunde(n) importieren`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
