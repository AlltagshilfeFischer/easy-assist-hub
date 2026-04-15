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
  _rowIndex: number;
}

async function readFileWithEncoding(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // UTF-16 LE (FF FE) oder UTF-16 BE (FE FF) BOM → direkt dekodieren
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(buffer).replace(/^\uFEFF/, '');
  }
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return new TextDecoder('utf-16be').decode(buffer).replace(/^\uFEFF/, '');
  }

  // UTF-8 dekodieren (inkl. BOM-Stripping)
  const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(buffer);

  // Windows-1252 Mojibake erkennen: ä→Ã¤, ö→Ã¶, ü→Ã¼, ß→ÃŸ, Ä→Ã„, Ö→Ã–, Ü→Ãœ, usw.
  if (/Ã[\x80-\xBF\xa4\xb6\xbc\x84\x96\x9c]/.test(text) ||
      text.includes('ÃŸ') || text.includes('Ã„') || text.includes('Ã–') || text.includes('Ãœ')) {
    return new TextDecoder('windows-1252').decode(buffer);
  }

  return text;
}

function detectDelimiter(headerLine: string): string {
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const semicolonCount = (headerLine.match(/;/g) ?? []).length;
  return semicolonCount >= commaCount ? ';' : ',';
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

function isXlsxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.xlsx') || name.endsWith('.xls');
}

function cellToString(val: unknown): string {
  if (val == null) return '';
  if (val instanceof Date) {
    const d = val.getDate().toString().padStart(2, '0');
    const m = (val.getMonth() + 1).toString().padStart(2, '0');
    const y = val.getFullYear();
    return `${d}.${m}.${y}`;
  }
  return String(val).trim();
}

async function parseXlsxFile(file: File): Promise<CsvParseResult> {
  if (file.name.toLowerCase().endsWith('.xls')) {
    toast.error('Altes Excel-Format (.xls) nicht unterstützt', {
      description: 'Bitte in Excel "Speichern unter → .xlsx" verwenden.',
    });
    throw new Error('.xls Format wird nicht unterstützt — bitte als .xlsx exportieren');
  }

  let readXlsxFile: ((file: File) => Promise<(string | number | boolean | Date | null)[][]>) | null = null;
  try {
    readXlsxFile = (await import('read-excel-file/browser')).default as typeof readXlsxFile;
  } catch {
    toast.error('XLSX-Bibliothek konnte nicht geladen werden');
    throw new Error('read-excel-file/browser konnte nicht geladen werden');
  }

  let rawRows: (string | number | boolean | Date | null)[][];
  try {
    rawRows = await readXlsxFile!(file);
  } catch (err) {
    toast.error('XLSX-Datei konnte nicht gelesen werden', {
      description: err instanceof Error ? err.message : 'Ungültiges Format',
    });
    throw err;
  }

  const nonEmptyRows = rawRows.filter(row => row.some(cell => cell != null && String(cell).trim().length > 0));

  if (nonEmptyRows.length < 2) {
    toast.error('XLSX enthält keine Datenzeilen');
    throw new Error('XLSX enthält keine Datenzeilen');
  }

  const headers = nonEmptyRows[0].map(h => cellToString(h));
  const dataRows = nonEmptyRows.slice(1).map(row =>
    headers.map((_, i) => cellToString(row[i]))
  );

  if (dataRows.length > 10000) {
    toast.warning(`Große Datei: ${dataRows.length.toLocaleString('de')} Zeilen — Import kann etwas länger dauern`);
  }

  return { headers, rows: dataRows, totalRows: dataRows.length };
}

export async function parseCsvFile(file: File): Promise<CsvParseResult> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    toast.error('Datei zu groß (max. 50 MB)');
    throw new Error('Datei überschreitet die maximale Größe von 50 MB');
  }

  if (isXlsxFile(file)) {
    return parseXlsxFile(file);
  }

  const text = await readFileWithEncoding(file);
  const lines = text.split(/\r?\n/);

  const nonEmptyLines = lines.filter(line => line.trim().length > 0);

  if (nonEmptyLines.length < 2) {
    toast.error('CSV enthält keine Datenzeilen');
    throw new Error('CSV enthält keine Datenzeilen');
  }

  const headerLine = nonEmptyLines[0];
  const delimiter = detectDelimiter(headerLine);
  const headers = parseCsvLine(headerLine, delimiter);

  const dataLines = nonEmptyLines.slice(1);

  if (dataLines.length > 10000) {
    toast.warning(`Große Datei: ${dataLines.length.toLocaleString('de')} Zeilen — Import kann etwas länger dauern`);
  }

  const rows = dataLines.map(line => parseCsvLine(line, delimiter));

  return {
    headers,
    rows,
    totalRows: rows.length,
  };
}

const ALLOWED_DB_FIELDS = new Set<keyof Omit<MappedCustomerRecord, '_rowIndex'>>([
  'vorname', 'nachname', 'telefonnr', 'email', 'strasse', 'plz', 'stadt',
  'stadtteil', 'adresse', 'geburtsdatum', 'pflegegrad', 'pflegekasse',
  'versichertennummer', 'kategorie', 'stunden_kontingent_monat', 'sonstiges',
  'angehoerige_ansprechpartner', 'eintritt', 'austritt', 'kassen_privat',
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
