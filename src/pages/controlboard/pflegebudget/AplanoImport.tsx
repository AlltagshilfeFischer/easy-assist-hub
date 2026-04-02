import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parse as parseCsv } from 'papaparse';
import { format, parse as parseDate, isValid } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Upload,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Users,
  FileText,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useCustomers } from '@/hooks/useCustomers';
import { useInsertBudgetTransactions } from '@/hooks/useBudgetTransactions';
import { useTariffs } from '@/hooks/useTariffs';
import { calculateTransactionAmount } from '@/lib/pflegebudget/budgetCalculations';
import type { Customer } from '@/types/domain';

// ─── Typen ──────────────────────────────────────────────────

type CsvRow = Record<string, string>;

type MappedField = 'client_name' | 'service_date' | 'hours' | 'label';
type ColumnMapping = Partial<Record<MappedField, string>>;

type ImportRow = {
  clientName: string;
  serviceDate: string;
  hours: number;
  label: string;
  matchedCustomer: Customer | null;
  isEhepaar: boolean;
  ehepaarPartner: Customer | null;
  error: string | null;
};

type ImportResult = {
  imported: number;
  failed: number;
};

// ─── Hilfsfunktionen ────────────────────────────────────────

function detectEncoding(buffer: ArrayBuffer): string {
  // Einfache Heuristik: UTF-8 BOM oder Windows-1252 erkennen
  const bytes = new Uint8Array(buffer.slice(0, 3));
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'UTF-8';
  return 'windows-1252';
}

function parseHours(raw: string): number | null {
  if (!raw) return null;
  // H:MM Format
  const timeMatch = raw.match(/^(\d+):(\d{2})$/);
  if (timeMatch) {
    return parseInt(timeMatch[1]) + parseInt(timeMatch[2]) / 60;
  }
  // Dezimal mit Komma oder Punkt
  const num = parseFloat(raw.replace(',', '.'));
  return isNaN(num) ? null : num;
}

function parseServiceDate(raw: string): string | null {
  if (!raw) return null;
  // DD.MM.YYYY
  const dmyMatch = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  }
  // ISO YYYY-MM-DD
  const isoMatch = raw.match(/^\d{4}-\d{2}-\d{2}$/);
  if (isoMatch) return raw;
  return null;
}

const FIELD_SYNONYMS: Record<MappedField, string[]> = {
  client_name: ['klient', 'kunde', 'name', 'adresse', 'kundenname', 'kundename', 'client'],
  service_date: ['datum', 'date', 'termin', 'termindat'],
  hours: ['stunden', 'total', 'dauer', 'h', 'hours', 'std'],
  label: ['label', 'bezeichnung', 'typ', 'kategorie'],
};

function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS) as [MappedField, string[]][]) {
    const match = headers.find((h) =>
      synonyms.some((s) => h.toLowerCase().includes(s)),
    );
    if (match) mapping[field] = match;
  }
  return mapping;
}

function matchCustomer(name: string, customers: Customer[]): Customer | null {
  const normalized = name.toLowerCase().trim();
  // Exakter Match Nachname
  return (
    customers.find((c) => {
      const cn = (c.nachname ?? c.name ?? '').toLowerCase();
      return normalized.includes(cn) || cn.includes(normalized);
    }) ?? null
  );
}

// ─── Schritt-Komponenten ─────────────────────────────────────

function Step1Upload({ onParsed }: { onParsed: (rows: CsvRow[], headers: string[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = (e) => {
      const buffer = e.target!.result as ArrayBuffer;
      const encoding = detectEncoding(buffer);
      const decoder = new TextDecoder(encoding);
      const text = decoder.decode(buffer);
      parseCsv<CsvRow>(text, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          onParsed(result.data, result.meta.fields ?? []);
        },
      });
    };
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schritt 1: CSV-Datei hochladen</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">CSV-Datei hierher ziehen oder klicken</p>
          <p className="text-sm text-muted-foreground mt-1">
            Nur Zeilen mit Kundenname und ohne Label (oder Label "Ausfall") werden importiert
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Step2Mapping({
  headers,
  previewRows,
  mapping,
  onMappingChange,
  relevantCount,
  skippedCount,
  onNext,
}: {
  headers: string[];
  previewRows: CsvRow[];
  mapping: ColumnMapping;
  onMappingChange: (m: ColumnMapping) => void;
  relevantCount: number;
  skippedCount: number;
  onNext: () => void;
}) {
  const fields: { key: MappedField; label: string; required: boolean }[] = [
    { key: 'client_name', label: 'Kundenname', required: true },
    { key: 'service_date', label: 'Datum', required: true },
    { key: 'hours', label: 'Stunden', required: true },
    { key: 'label', label: 'Label (Filter)', required: false },
  ];

  const canProceed = !!mapping.client_name && !!mapping.service_date && !!mapping.hours;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schritt 2: Spalten-Mapping</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="text-sm font-medium">
                {f.label} {f.required && <span className="text-red-500">*</span>}
              </label>
              <Select
                value={mapping[f.key] ?? '__none__'}
                onValueChange={(v) =>
                  onMappingChange({ ...mapping, [f.key]: v === '__none__' ? undefined : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Spalte wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {!f.required && <SelectItem value="__none__">— Optional —</SelectItem>}
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          <span className="text-green-600 font-medium">{relevantCount} relevant</span>
          {' '}({skippedCount} übersprungen)
        </p>

        {/* Vorschau */}
        {previewRows.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.slice(0, 6).map((h) => (
                    <TableHead key={h} className="text-xs">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.slice(0, 3).map((row, i) => (
                  <TableRow key={i}>
                    {headers.slice(0, 6).map((h) => (
                      <TableCell key={h} className="text-xs">{row[h] ?? ''}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Button onClick={onNext} disabled={!canProceed}>
          Weiter
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

function Step3Preview({
  rows,
  onImport,
}: {
  rows: ImportRow[];
  onImport: () => void;
}) {
  const validRows = rows.filter((r) => !r.error);
  const errorRows = rows.filter((r) => r.error);
  const ehepaarRows = rows.filter((r) => r.isEhepaar);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schritt 3: Vorschau</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">{validRows.length} gültige Termine</span>
          </div>
          {errorRows.length > 0 && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>{errorRows.length} mit Fehlern (werden übersprungen)</span>
            </div>
          )}
        </div>

        {errorRows.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
            {errorRows.map((r, i) => (
              <p key={i} className="text-xs text-red-600">
                {r.clientName} — {r.error}
              </p>
            ))}
          </div>
        )}

        {ehepaarRows.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-700 font-medium text-sm mb-1">
              <Users className="h-4 w-4" />
              Ehepaar-Erkennung
            </div>
            <p className="text-xs text-blue-600">
              {ehepaarRows.length} Termine werden auf beide Partner aufgeteilt.
            </p>
          </div>
        )}

        <div className="overflow-x-auto max-h-80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Klient</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Stunden</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 50).map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                  <TableCell className="text-sm">
                    {row.matchedCustomer
                      ? `${row.matchedCustomer.nachname}, ${row.matchedCustomer.vorname}`
                      : row.clientName}
                    {row.isEhepaar && (
                      <Badge variant="secondary" className="ml-2 text-xs">Ehepaar</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{row.serviceDate}</TableCell>
                  <TableCell className="text-sm">{row.hours.toFixed(2)}</TableCell>
                  <TableCell>
                    {row.error ? (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Button onClick={onImport} disabled={validRows.length === 0}>
          {validRows.length} Termine importieren
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Hauptkomponente ─────────────────────────────────────────

export default function AplanoImport() {
  const navigate = useNavigate();
  const { data: customers = [] } = useCustomers({ onlyActive: true });
  const { data: tariffs = [] } = useTariffs();
  const insertMutation = useInsertBudgetTransactions();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleParsed(rows: CsvRow[], h: string[]) {
    setCsvRows(rows);
    setHeaders(h);
    setMapping(autoDetectMapping(h));
    setStep(2);
  }

  const relevantRows = useMemo(() => {
    if (!mapping.label) return csvRows;
    return csvRows.filter((row) => {
      const label = (row[mapping.label!] ?? '').toLowerCase().trim();
      return label === '' || label === 'ausfall';
    });
  }, [csvRows, mapping]);

  function handleBuildPreview() {
    const rows: ImportRow[] = [];

    for (const row of relevantRows) {
      const clientName = (row[mapping.client_name!] ?? '').trim();
      const rawDate = (row[mapping.service_date!] ?? '').trim();
      const rawHours = (row[mapping.hours!] ?? '').trim();

      const serviceDate = parseServiceDate(rawDate);
      const hours = parseHours(rawHours);

      // Ehepaar-Erkennung
      const isEhepaar =
        clientName.toLowerCase().includes('ehepaar') ||
        clientName.toLowerCase().includes('eheleute') ||
        clientName.toLowerCase().includes('ehel.') ||
        clientName.includes('/');

      const matchedCustomer = matchCustomer(clientName, customers);

      let error: string | null = null;
      if (!clientName) error = 'Kein Kundenname';
      else if (!serviceDate) error = `Ungültiges Datum: ${rawDate}`;
      else if (hours === null || hours <= 0) error = `Ungültige Stunden: ${rawHours}`;
      else if (!matchedCustomer && !isEhepaar) error = `Klient nicht gefunden: ${clientName}`;

      rows.push({
        clientName,
        serviceDate: serviceDate ?? rawDate,
        hours: hours ?? 0,
        label: mapping.label ? (row[mapping.label] ?? '') : '',
        matchedCustomer,
        isEhepaar,
        ehepaarPartner: null,
        error,
      });
    }

    setImportRows(rows);
    setStep(3);
  }

  async function handleImport() {
    setStep(4);
    setProgress(0);

    const validRows = importRows.filter((r) => !r.error);
    let imported = 0;
    let failed = 0;

    const batch = [];
    for (const row of validRows) {
      if (!row.matchedCustomer) { failed++; continue; }
      const { hourlyRate, travelFlatTotal, totalAmount } = calculateTransactionAmount(
        row.hours,
        1,
        'ENTLASTUNG',
        tariffs,
      );
      batch.push({
        client_id: row.matchedCustomer.id,
        service_date: row.serviceDate,
        hours: row.hours,
        visits: 1,
        service_type: 'ENTLASTUNG' as const,
        hourly_rate: hourlyRate,
        travel_flat_total: travelFlatTotal,
        total_amount: totalAmount,
        source: 'APLANO_IMPORT' as const,
        external_ref: null,
        billed: false,
        allocation_type: 'AUTO',
      });
    }

    if (batch.length > 0) {
      try {
        await insertMutation.mutateAsync(batch);
        imported = batch.length;
      } catch {
        failed += batch.length;
      }
    }

    setProgress(100);
    setResult({ imported, failed });
    setStep(5);
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Aplano Import</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Terminaten aus dem Aplano-System importieren
        </p>
      </div>

      {/* Schritt-Anzeige */}
      <div className="flex items-center gap-2 text-sm">
        {[1, 2, 3, 4, 5].map((s) => (
          <React.Fragment key={s}>
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                s === step
                  ? 'bg-primary text-primary-foreground'
                  : s < step
                  ? 'bg-green-600 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {s < step ? '✓' : s}
            </div>
            {s < 5 && <div className="h-px w-6 bg-muted" />}
          </React.Fragment>
        ))}
      </div>

      {step === 1 && <Step1Upload onParsed={handleParsed} />}

      {step === 2 && (
        <Step2Mapping
          headers={headers}
          previewRows={csvRows}
          mapping={mapping}
          onMappingChange={setMapping}
          relevantCount={relevantRows.length}
          skippedCount={csvRows.length - relevantRows.length}
          onNext={handleBuildPreview}
        />
      )}

      {step === 3 && (
        <Step3Preview rows={importRows} onImport={handleImport} />
      )}

      {step === 4 && (
        <Card>
          <CardContent className="py-12 space-y-4">
            <p className="text-center font-medium">Import läuft...</p>
            <Progress value={progress} className="w-full" />
          </CardContent>
        </Card>
      )}

      {step === 5 && result && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <p className="text-xl font-semibold">
              {result.imported} Termine erfolgreich importiert
            </p>
            {result.failed > 0 && (
              <p className="text-sm text-red-600">{result.failed} fehlgeschlagen</p>
            )}
            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate('/dashboard/controlboard/pflegebudget')}>
                Zur Abrechnung
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setCsvRows([]);
                  setHeaders([]);
                  setMapping({});
                  setImportRows([]);
                  setResult(null);
                }}
              >
                Weitere Datei importieren
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
