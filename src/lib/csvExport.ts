import Papa from 'papaparse';

/**
 * Export data as CSV file download.
 * Uses semicolon delimiter and UTF-8 BOM for Excel compatibility.
 */
export function downloadCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  filename: string
): void {
  const csvRows = [headers, ...rows.map((r) => r.map((cell) => cell ?? ''))];
  const csv = Papa.unparse(csvRows, { delimiter: ';' });
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
