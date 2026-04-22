import { toast } from 'sonner';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export interface MappedCustomerRecord {
  vorname?: string;
  nachname?: string;
  telefonnr?: string;
  email?: string;
  strasse?: string;
  plz?: string;
  stadt?: string;
  stadtteil?: string;
  adresse?: string;
  geburtsdatum?: string;
  pflegegrad?: string;
  pflegekasse?: string;
  versichertennummer?: string;
  kategorie?: string;
  stunden_kontingent_monat?: string;
  sonstiges?: string;
  angehoerige_ansprechpartner?: string;
  eintritt?: string;
  austritt?: string;
  kassen_privat?: string;
  // Neue Felder (Template-Erweiterung)
  mitarbeiter_name?: string;
  verhinderungspflege?: string;
  kopie_lw?: string;
  aktiv_status?: string;
  tage?: string;
  _rowIndex: number;
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

async function readFileWithEncoding(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (bytes[0] === 0xFF && bytes[1] === 0xFE)
    return new TextDecoder('utf-16le').decode(buffer).replace(/^\uFEFF/, '');
  if (bytes[0] === 0xFE && bytes[1] === 0xFF)
    return new TextDecoder('utf-16be').decode(buffer).replace(/^\uFEFF/, '');

  const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(buffer);

  if (/Ã[\x80-\xBF]/.test(text) ||
      text.includes('ÃŸ') || text.includes('Ã„') || text.includes('Ã–') || text.includes('Ãœ')) {
    return new TextDecoder('windows-1252').decode(buffer);
  }
  return text;
}

function detectDelimiter(line: string): string {
  const tab  = (line.match(/\t/g)  ?? []).length;
  const semi = (line.match(/;/g)   ?? []).length;
  const com  = (line.match(/,/g)   ?? []).length;
  if (tab >= semi && tab >= com) return '\t';
  return semi >= com ? ';' : ',';
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else { current += char; }
    } else {
      if (char === '"') inQuotes = true;
      else if (char === delimiter) { fields.push(current.trim()); current = ''; }
      else current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

// ---------------------------------------------------------------------------
// XLSX parser (fflate + DOMParser — kein externes Paket)
// ---------------------------------------------------------------------------

function colLetterToIndex(col: string): number {
  let n = 0;
  for (let i = 0; i < col.length; i++) n = n * 26 + col.charCodeAt(i) - 64;
  return n - 1;
}

function xlDateToString(serial: number): string {
  // Excel-Epoch: 1.1.1900 (mit fehlerhaftem Schaltjahr 1900 → Offset 25569 für Unix-Epoch)
  const d = new Date((serial - 25569) * 86400 * 1000);
  const dd = d.getUTCDate().toString().padStart(2, '0');
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

const BUILTIN_DATE_FMTS = new Set([14,15,16,17,18,19,20,21,22,27,28,29,30,31,32,33,34,35,36,45,46,47,50,51,52,53,54,55,56,57,58]);

function buildStyleIndex(stylesXml: string): number[] {
  const doc = new DOMParser().parseFromString(stylesXml, 'text/xml');
  // custom numFmt IDs that look like dates
  const customDateFmts = new Set<number>();
  Array.from(doc.getElementsByTagName('numFmt')).forEach(el => {
    const id  = parseInt(el.getAttribute('numFmtId') ?? '0', 10);
    const fmt = el.getAttribute('formatCode') ?? '';
    if (/[yYdD]/.test(fmt) && !/^[#0.,% ]+$/.test(fmt)) customDateFmts.add(id);
  });
  const xfs: number[] = [];
  const cellXfsEl = doc.getElementsByTagName('cellXfs')[0];
  if (cellXfsEl) {
    Array.from(cellXfsEl.getElementsByTagName('xf')).forEach(xf => {
      xfs.push(parseInt(xf.getAttribute('numFmtId') ?? '0', 10));
    });
  }
  return xfs.map(id => (BUILTIN_DATE_FMTS.has(id) || customDateFmts.has(id)) ? 1 : 0);
}

function parseSharedStrings(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const sis = Array.from(doc.getElementsByTagName('si'));
  return sis.map(si => {
    // Rich-text: mehrere <t>-Tags zusammensetzen
    const ts = si.getElementsByTagName('t');
    if (ts.length > 1) return Array.from(ts).map(t => t.textContent ?? '').join('');
    return ts[0]?.textContent ?? '';
  });
}

function parseSheetXml(
  xml: string,
  sharedStrings: string[],
  isDateStyle: number[],
): string[][] {
  const doc   = new DOMParser().parseFromString(xml, 'text/xml');
  const rows: string[][] = [];

  Array.from(doc.getElementsByTagName('row')).forEach(rowEl => {
    const cells = rowEl.getElementsByTagName('c');
    if (!cells.length) return;

    // Größten Spalten-Index in dieser Zeile ermitteln
    let maxIdx = 0;
    Array.from(cells).forEach(c => {
      const ref = c.getAttribute('r') ?? '';
      const col = ref.replace(/[0-9]/g, '');
      if (col) maxIdx = Math.max(maxIdx, colLetterToIndex(col));
    });

    const row: string[] = new Array(maxIdx + 1).fill('');
    Array.from(cells).forEach(c => {
      const ref  = c.getAttribute('r') ?? '';
      const col  = ref.replace(/[0-9]/g, '');
      if (!col) return;
      const idx  = colLetterToIndex(col);
      const type = c.getAttribute('t') ?? '';
      const sIdx = parseInt(c.getAttribute('s') ?? '0', 10);
      const vEl  = c.getElementsByTagName('v')[0];
      const tEl  = c.getElementsByTagName('is')[0]?.getElementsByTagName('t')[0];

      let val = '';
      if (type === 's'         && vEl) val = sharedStrings[parseInt(vEl.textContent ?? '0', 10)] ?? '';
      else if (type === 'inlineStr' && tEl) val = tEl.textContent ?? '';
      else if (type === 'str'  && vEl) val = vEl.textContent ?? '';
      else if (type === 'b'    && vEl) val = vEl.textContent === '1' ? 'Ja' : 'Nein';
      else if (vEl) {
        const num = parseFloat(vEl.textContent ?? '');
        val = (!isNaN(num) && isDateStyle[sIdx]) ? xlDateToString(num) : (vEl.textContent ?? '');
      }
      row[idx] = val.trim();
    });
    rows.push(row);
  });
  return rows;
}

async function parseXlsxFile(file: File): Promise<CsvParseResult> {
  if (file.name.toLowerCase().endsWith('.xls')) {
    toast.error('Altes Excel-Format (.xls) nicht unterstützt', {
      description: 'Bitte in Excel "Speichern unter → .xlsx" verwenden.',
    });
    throw new Error('.xls nicht unterstützt');
  }

  const { unzipSync, strFromU8 } = await import('fflate');
  const buffer = await file.arrayBuffer();

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch {
    toast.error('XLSX konnte nicht geöffnet werden', {
      description: 'Datei ist beschädigt oder kein gültiges .xlsx-Format.',
    });
    throw new Error('XLSX unzip failed');
  }

  const getText = (path: string) => {
    const u8 = files[path];
    return u8 ? strFromU8(u8) : null;
  };

  const sharedStrings = getText('xl/sharedStrings.xml')
    ? parseSharedStrings(getText('xl/sharedStrings.xml')!)
    : [];

  const isDateStyle = getText('xl/styles.xml')
    ? buildStyleIndex(getText('xl/styles.xml')!)
    : [];

  // Erstes Sheet finden (Pfad aus workbook.xml.rels)
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const relsXml = getText('xl/_rels/workbook.xml.rels');
  if (relsXml) {
    const doc  = new DOMParser().parseFromString(relsXml, 'text/xml');
    const rels = Array.from(doc.getElementsByTagName('Relationship'));
    const rel  = rels.find(r => (r.getAttribute('Type') ?? '').includes('worksheet'));
    const target = rel?.getAttribute('Target');
    if (target) sheetPath = target.startsWith('xl/') ? target : `xl/${target}`;
  }

  const sheetXml = getText(sheetPath);
  if (!sheetXml) {
    toast.error('XLSX enthält kein lesbares Tabellenblatt');
    throw new Error(`Sheet nicht gefunden: ${sheetPath}`);
  }

  const allRows = parseSheetXml(sheetXml, sharedStrings, isDateStyle);
  const nonEmptyRows = allRows.filter(r => r.some(c => c.length > 0));

  if (nonEmptyRows.length < 2) {
    toast.error('XLSX enthält keine Datenzeilen');
    throw new Error('Keine Daten gefunden');
  }

  // Headerzeile: erste Zeile (Row 0 ist fast immer der Header)
  // Falls Row 0 nur 1 Zelle hat (Titelzeile), nehmen wir Row 1
  const headerRow = nonEmptyRows[0].filter(c => c.length > 0).length <= 1
    ? nonEmptyRows[1]
    : nonEmptyRows[0];
  const dataStart = nonEmptyRows[0].filter(c => c.length > 0).length <= 1 ? 2 : 1;

  const headers  = headerRow;
  const dataRows = nonEmptyRows.slice(dataStart).map(row =>
    headers.map((_, i) => row[i] ?? '')
  );

  if (dataRows.length > 10000)
    toast.warning(`Große Datei: ${dataRows.length.toLocaleString('de')} Zeilen`);

  return { headers, rows: dataRows, totalRows: dataRows.length };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function parseCsvFile(file: File): Promise<CsvParseResult> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    toast.error('Datei zu groß (max. 50 MB)');
    throw new Error('Datei zu groß');
  }

  if (file.name.toLowerCase().match(/\.xlsx?$/)) return parseXlsxFile(file);

  const text  = await readFileWithEncoding(file);
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);

  if (lines.length < 2) {
    toast.error('CSV enthält keine Datenzeilen');
    throw new Error('CSV leer');
  }

  const delimiter = detectDelimiter(
    lines.reduce((best, l) => {
      const b = (best.match(/[\t;,]/g) ?? []).length;
      const c = (l.match(/[\t;,]/g)   ?? []).length;
      return c > b ? l : best;
    }, lines[0])
  );

  // Headerzeile: erste Zeile mit ≥2 nicht-leeren Feldern
  const hIdx = lines.findIndex(
    l => parseCsvLine(l, delimiter).filter(f => f.trim().length > 0).length >= 2
  );
  const headerLine = lines[hIdx >= 0 ? hIdx : 0];
  const headers    = parseCsvLine(headerLine, delimiter);
  const dataLines  = lines.slice((hIdx >= 0 ? hIdx : 0) + 1);

  if (dataLines.length > 10000)
    toast.warning(`Große Datei: ${dataLines.length.toLocaleString('de')} Zeilen`);

  return { headers, rows: dataLines.map(l => parseCsvLine(l, delimiter)), totalRows: dataLines.length };
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

const ALLOWED_DB_FIELDS = new Set<keyof Omit<MappedCustomerRecord, '_rowIndex'>>([
  'vorname', 'nachname', 'telefonnr', 'email', 'strasse', 'plz', 'stadt',
  'stadtteil', 'adresse', 'geburtsdatum', 'pflegegrad', 'pflegekasse',
  'versichertennummer', 'kategorie', 'stunden_kontingent_monat', 'sonstiges',
  'angehoerige_ansprechpartner', 'eintritt', 'austritt', 'kassen_privat',
  'mitarbeiter_name', 'verhinderungspflege', 'kopie_lw', 'aktiv_status', 'tage',
]);

export function applyColumnMapping(
  parseResult: CsvParseResult,
  mapping: Record<string, string | null>
): MappedCustomerRecord[] {
  const { headers, rows } = parseResult;
  return rows.map((row, rowIndex) => {
    const record: MappedCustomerRecord = { _rowIndex: rowIndex };
    headers.forEach((header, colIndex) => {
      const dbField = mapping[header];
      if (!dbField) return;
      const value = row[colIndex]?.trim() ?? '';
      if (value === '') return;
      if (!ALLOWED_DB_FIELDS.has(dbField as keyof Omit<MappedCustomerRecord, '_rowIndex'>)) return;
      record[dbField as keyof Omit<MappedCustomerRecord, '_rowIndex'>] = value;
    });
    return record;
  });
}
