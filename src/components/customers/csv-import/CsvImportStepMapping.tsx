import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { parseCsvFile } from '@/lib/csv-parser';
import type { CsvParseResult } from '@/lib/csv-parser';
import { invokeAiFunction } from '@/lib/aiClient';

const DB_FIELD_OPTIONS = [
  { value: 'vorname', label: 'Vorname *' },
  { value: 'nachname', label: 'Nachname *' },
  { value: 'mitarbeiter_name', label: 'Mitarbeiter (Name)' },
  { value: 'pflegegrad', label: 'Pflegegrad (0-5)' },
  { value: 'adresse', label: 'Adresse (kombiniert)' },
  { value: 'strasse', label: 'Straße' },
  { value: 'plz', label: 'PLZ' },
  { value: 'stadt', label: 'Stadt' },
  { value: 'stadtteil', label: 'Stadtteil' },
  { value: 'geburtsdatum', label: 'Geburtsdatum (TT.MM.JJJJ)' },
  { value: 'pflegekasse', label: 'Pflegekasse' },
  { value: 'versichertennummer', label: 'Versichertennummer' },
  { value: 'verhinderungspflege', label: 'Verhinderungspflege (Ja/Nein/Beantragt)' },
  { value: 'telefonnr', label: 'Telefon' },
  { value: 'kassen_privat', label: 'Kasse/Privat' },
  { value: 'kopie_lw', label: 'Kopie LW (Ja/Nein)' },
  { value: 'aktiv_status', label: 'Status (Aktiv/Inaktiv)' },
  { value: 'stunden_kontingent_monat', label: 'Stunden/Monat' },
  { value: 'tage', label: 'Tage' },
  { value: 'sonstiges', label: 'Sonstiges' },
  { value: 'angehoerige_ansprechpartner', label: 'Angehörige/Ansprechpartner' },
  { value: 'eintritt', label: 'Eintrittsdatum' },
  { value: 'austritt', label: 'Austrittsdatum' },
  { value: 'email', label: 'E-Mail' },
  { value: 'kategorie', label: 'Kategorie (Kunde/Interessent)' },
] as const;

const FUZZY_MAP: Record<string, string> = {
  // Name
  'vorname': 'vorname',
  'nachname': 'nachname',
  'familienname': 'nachname',
  'name': 'nachname',
  // Telefon
  'telefon': 'telefonnr',
  'telefonnr': 'telefonnr',
  'telefonnummer': 'telefonnr',
  'tel': 'telefonnr',
  'tel.': 'telefonnr',
  'handy': 'telefonnr',
  'mobil': 'telefonnr',
  // E-Mail
  'email': 'email',
  'e-mail': 'email',
  'e mail': 'email',
  // Adresse
  'strasse': 'strasse',
  'straße': 'strasse',
  'strasse/hausnummer': 'strasse',
  'adresse': 'adresse',
  'plz': 'plz',
  'postleitzahl': 'plz',
  'stadt': 'stadt',
  'ort': 'stadt',
  'wohnort': 'stadt',
  'stadtteil': 'stadtteil',
  'ortsteil': 'stadtteil',
  'bezirk': 'stadtteil',
  // Geburtsdatum
  'geburtsdatum': 'geburtsdatum',
  'geb.': 'geburtsdatum',
  'geb. datum': 'geburtsdatum',
  'geburtstag': 'geburtsdatum',
  'geb': 'geburtsdatum',
  // Pflegegrad
  'pflegegrad': 'pflegegrad',
  'pfg': 'pflegegrad',
  'pg': 'pflegegrad',
  'pflege grad': 'pflegegrad',
  // Pflegekasse
  'pflegekasse': 'pflegekasse',
  'kasse': 'pflegekasse',
  'krankenkasse': 'pflegekasse',
  // Versichertennummer
  'versichertennummer': 'versichertennummer',
  'vers.nr.': 'versichertennummer',
  'vers nr': 'versichertennummer',
  'versicherungsnummer': 'versichertennummer',
  'versichertennnummer': 'versichertennummer',
  'versicherten nr': 'versichertennummer',
  // Kategorie — nur wenn Spalte eindeutig Kundentyp enthält
  'kategorie': 'kategorie',
  'kundentyp': 'kategorie',
  'kundenkategorie': 'kategorie',
  // Status → aktiv/inaktiv
  'status': 'aktiv_status',
  'aktiv': 'aktiv_status',
  'aktivstatus': 'aktiv_status',
  // Mitarbeiter
  'mitarbeiter': 'mitarbeiter_name',
  'betreuer': 'mitarbeiter_name',
  'zuständiger mitarbeiter': 'mitarbeiter_name',
  'betreuende person': 'mitarbeiter_name',
  // Verhinderungspflege
  'verhinderungspflege': 'verhinderungspflege',
  'vp': 'verhinderungspflege',
  // Kopie LW
  'kopie lw': 'kopie_lw',
  'kopie leistungsnachweis': 'kopie_lw',
  'ln kopie': 'kopie_lw',
  // Tage
  'tage': 'tage',
  // Stunden
  'stunden': 'stunden_kontingent_monat',
  'stunden/monat': 'stunden_kontingent_monat',
  'std/monat': 'stunden_kontingent_monat',
  'stunden kontingent': 'stunden_kontingent_monat',
  'stundenkontingent': 'stunden_kontingent_monat',
  // Eintritt / Austritt
  'eintritt': 'eintritt',
  'eintrittsdatum': 'eintritt',
  'beginn': 'eintritt',
  'vertragsbeginn': 'eintritt',
  'austritt': 'austritt',
  'austrittsdatum': 'austritt',
  'vertragsende': 'austritt',
  // Kasse/Privat
  'kasse/privat': 'kassen_privat',
  'kassen/privat': 'kassen_privat',
  'kasse privat': 'kassen_privat',
  'finanzierung': 'kassen_privat',
  'abrechnungsart': 'kassen_privat',
  // Sonstiges / Bemerkungen / Freitext
  'sonstiges': 'sonstiges',
  'bemerkung': 'sonstiges',
  'bemerkungen': 'sonstiges',
  'notiz': 'sonstiges',
  'notizen': 'sonstiges',
  'begründung': 'sonstiges',
  'anmerkung': 'sonstiges',
  'anmerkungen': 'sonstiges',
  'kommentar': 'sonstiges',
  'kommentare': 'sonstiges',
  'kontaktiert': 'sonstiges',
  'kontaktstatus': 'sonstiges',
  // Angehörige/Ansprechpartner (verschiedene Schreibweisen)
  'angehörige/ansprechpartner': 'angehoerige_ansprechpartner',
  'angehöriger/ansprechpartner': 'angehoerige_ansprechpartner',
  'angehörige': 'angehoerige_ansprechpartner',
  'ansprechpartner': 'angehoerige_ansprechpartner',
  'kontaktperson': 'angehoerige_ansprechpartner',
  'notfallkontakt': 'angehoerige_ansprechpartner',
};

interface CsvImportStepMappingProps {
  onComplete: (parseResult: CsvParseResult, mapping: Record<string, string | null>) => void;
}

export function CsvImportStepMapping({ onComplete }: CsvImportStepMappingProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const hasMandatoryField = Object.values(mapping).includes('vorname')
    && Object.values(mapping).includes('nachname');

  // Alle Spalten anzeigen — leere Header als "(Spalte N)" labeln damit keine Spalte verloren geht
  const visibleHeaders = parseResult?.headers
    .map((header, index) => ({
      header,
      displayName: header.trim().length > 0 ? header : `(Spalte ${index + 1})`,
      index,
    })) ?? [];

  const normalizeHeader = (h: string) =>
    h.toLowerCase()
      .replace(/\u00A0/g, ' ')   // non-breaking space → space
      .replace(/\s+/g, ' ')       // mehrfache Leerzeichen → eins
      .trim();

  const applyFallbackMapping = (headers: string[]): Record<string, string | null> => {
    const fallback: Record<string, string | null> = {};
    for (const header of headers) {
      fallback[header] = FUZZY_MAP[normalizeHeader(header)] ?? null;
    }
    return fallback;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await parseCsvFile(file);
      setParseResult(result);

      // Schritt 1: Fuzzy-Matching lokal (kein API-Aufruf)
      const fuzzyResult = applyFallbackMapping(result.headers);
      const unknownColumns = result.headers.filter(h => fuzzyResult[h] === null);

      // Schritt 2: KI nur für Spalten die Fuzzy nicht erkannt hat
      if (unknownColumns.length > 0) {
        setIsAnalyzing(true);
        try {
          const { data, error } = await invokeAiFunction('map-csv-columns', { columns: unknownColumns });
          if (error) throw error;

          const { mapping: aiMapping } = data as { mapping: Record<string, string | null> };
          setMapping({ ...fuzzyResult, ...(aiMapping ?? {}) });
        } catch (aiError) {
          console.error('[CsvImport] KI-Mapping fehlgeschlagen:', aiError);
          setMapping(fuzzyResult);
        } finally {
          setIsAnalyzing(false);
        }
      } else {
        setMapping(fuzzyResult);
      }
    } catch (err) {
      console.error('[CsvImport] CSV-Parse-Fehler:', err);
      toast.error('CSV konnte nicht gelesen werden', {
        description: err instanceof Error ? err.message : 'Ungültiges Format',
      });
    }

    // Reset so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleMappingChange = (csvHeader: string, dbField: string) => {
    setMapping(prev => ({
      ...prev,
      [csvHeader]: dbField === '__ignore__' ? null : dbField,
    }));
  };

  const handleComplete = () => {
    if (!parseResult) return;
    onComplete(parseResult, mapping);
  };

  const getExampleValue = (headerIndex: number): string => {
    if (!parseResult || parseResult.rows.length === 0) return '';
    return parseResult.rows[0][headerIndex] ?? '';
  };

  return (
    <div className="space-y-4">
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,.xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          CSV-Datei auswählen
        </Button>
        {parseResult && (
          <span className="ml-3 text-sm text-muted-foreground">
            {parseResult.totalRows} Zeilen geladen
          </span>
        )}
      </div>

      {isAnalyzing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          KI analysiert unbekannte Spalten...
        </div>
      )}

      {parseResult && !isAnalyzing && (
        <>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium">CSV-Spalte</th>
                  <th className="text-left px-4 py-2 font-medium">Beispielwert (1. Zeile)</th>
                  <th className="text-left px-4 py-2 font-medium">Datenbankfeld</th>
                </tr>
              </thead>
              <tbody>
                {visibleHeaders.map(({ header, displayName, index }) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">{displayName}</td>
                    <td className="px-4 py-2 text-muted-foreground truncate max-w-[200px]">
                      {getExampleValue(index) || '—'}
                    </td>
                    <td className="px-4 py-2">
                      <Select
                        value={mapping[header] ?? '__ignore__'}
                        onValueChange={(val) => handleMappingChange(header, val)}
                      >
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="— Ignorieren —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__ignore__">— Ignorieren —</SelectItem>
                          {DB_FIELD_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            * Pflichtfelder: Vorname UND Nachname müssen gemappt sein
          </p>

          <div className="flex justify-end">
            <Button onClick={handleComplete} disabled={!hasMandatoryField}>
              Weiter zur Validierung
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
