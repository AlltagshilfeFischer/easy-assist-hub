import { toast } from 'sonner';
import * as XLSX from 'xlsx';

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
  const utf8Text = await file.text();
  if (utf8Text.includes('Ã¤') || utf8Text.includes('Ã¶') || utf8Text.includes('Ã¼')) {
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder('windows-1252');
    return decoder.decode(buffer);
  }
  return utf8Text;
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

async function parseXlsxFile(file: File): Promise<CsvParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, raw: false });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    toast.error('XLSX enthält keine Tabellenblätter');
    throw new Error('XLSX enthält keine Tabellenblätter');
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });

  const nonEmptyRows = rawRows.filter(row => row.some(cell => String(cell).trim().length > 0));

  if (nonEmptyRows.length < 2) {
    toast.error('XLSX enthält keine Datenzeilen');
    throw new Error('XLSX enthält keine Datenzeilen');
  }

  const headers = nonEmptyRows[0].map(h => String(h).trim());
  const dataRows = nonEmptyRows.slice(1).map(row =>
    headers.map((_, i) => String(row[i] ?? '').trim())
  );

  if (dataRows.length > 10000) {
    toast.warning(`Große Datei: ${dataRows.length.toLocaleString('de')} Zeilen — Import kann etwas länger dauern`);
  }

  return {
    headers,
    rows: dataRows,
    totalRows: dataRows.length,
  };
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
