import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInMinutes } from 'date-fns';
import type { TerminStatus } from '@/types/domain';

// ─── Types ──────────────────────────────────────────────────

export interface ReportingFilters {
  dateFrom: Date;
  dateTo: Date;
  mitarbeiterIds: string[];
  kundenIds: string[];
}

interface RawTerminRow {
  id: string;
  titel: string;
  start_at: string;
  end_at: string;
  status: TerminStatus;
  iststunden: number | null;
  kunden_id: string;
  mitarbeiter_id: string | null;
  customer: { id: string; name: string | null; vorname: string | null; nachname: string | null; stadtteil: string | null } | null;
  employee: { id: string; vorname: string | null; nachname: string | null; farbe_kalender: string | null } | null;
}

export interface ReportingTermin {
  id: string;
  titel: string;
  startAt: string;
  endAt: string;
  status: TerminStatus;
  dauerStunden: number;
  kundenId: string;
  kundenName: string;
  kundenStadtteil: string;
  mitarbeiterId: string | null;
  mitarbeiterName: string;
}

export interface MitarbeiterStunden {
  mitarbeiterId: string;
  mitarbeiterName: string;
  farbe: string;
  anzahlTermine: number;
  gesamtStunden: number;
}

export interface ReportingSummary {
  gesamtTermine: number;
  gesamtStunden: number;
  durchschnittProMitarbeiter: number;
  stornoquote: number;
}

export interface ReportingData {
  termine: ReportingTermin[];
  mitarbeiterStunden: MitarbeiterStunden[];
  summary: ReportingSummary;
}

// ─── Helper ─────────────────────────────────────────────────

const CANCELLED_STATUSES: TerminStatus[] = ['cancelled', 'abgesagt_rechtzeitig'];

function computeDauerStunden(row: { iststunden: number | null; start_at: string; end_at: string }): number {
  if (row.iststunden != null && row.iststunden > 0) {
    return row.iststunden;
  }
  const minutes = differenceInMinutes(new Date(row.end_at), new Date(row.start_at));
  return Math.max(0, minutes / 60);
}

function buildEmployeeName(emp: { vorname: string | null; nachname: string | null } | null): string {
  if (!emp) return 'Nicht zugewiesen';
  return [emp.vorname, emp.nachname].filter(Boolean).join(' ') || 'Unbenannt';
}

function buildCustomerName(cust: { name: string | null; vorname: string | null; nachname: string | null } | null): string {
  if (!cust) return 'Unbekannt';
  if (cust.name) return cust.name;
  return [cust.vorname, cust.nachname].filter(Boolean).join(' ') || 'Unbekannt';
}

// ─── Hook ───────────────────────────────────────────────────

export function useReportingData(filters: ReportingFilters) {
  const { dateFrom, dateTo, mitarbeiterIds, kundenIds } = filters;

  return useQuery<ReportingData>({
    queryKey: [
      'reporting',
      dateFrom.toISOString(),
      dateTo.toISOString(),
      mitarbeiterIds,
      kundenIds,
    ],
    queryFn: async () => {
      let query = supabase
        .from('termine')
        .select(`
          id, titel, start_at, end_at, status, iststunden, kunden_id, mitarbeiter_id,
          customer:kunden(id, name, vorname, nachname, stadtteil),
          employee:mitarbeiter(id, vorname, nachname, farbe_kalender)
        `)
        .gte('start_at', dateFrom.toISOString())
        .lte('start_at', dateTo.toISOString())
        .order('start_at', { ascending: true });

      if (mitarbeiterIds.length > 0) {
        query = query.in('mitarbeiter_id', mitarbeiterIds);
      }

      if (kundenIds.length > 0) {
        query = query.in('kunden_id', kundenIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as unknown as RawTerminRow[];

      // Map to domain shape
      const termine: ReportingTermin[] = rows.map((row) => ({
        id: row.id,
        titel: row.titel,
        startAt: row.start_at,
        endAt: row.end_at,
        status: row.status,
        dauerStunden: computeDauerStunden(row),
        kundenId: row.kunden_id,
        kundenName: buildCustomerName(row.customer),
        kundenStadtteil: row.customer?.stadtteil || 'Unbekannt',
        mitarbeiterId: row.mitarbeiter_id,
        mitarbeiterName: buildEmployeeName(row.employee),
      }));

      // Aggregate per employee (exclude cancelled)
      const activeTermine = termine.filter(
        (t) => !CANCELLED_STATUSES.includes(t.status)
      );

      const empMap = new Map<string, MitarbeiterStunden>();

      for (const t of activeTermine) {
        const key = t.mitarbeiterId ?? '__unassigned__';
        const existing = empMap.get(key);
        if (existing) {
          existing.anzahlTermine += 1;
          existing.gesamtStunden += t.dauerStunden;
        } else {
          // Find farbe from raw data
          const rawRow = rows.find((r) => r.id === t.id);
          const farbe = rawRow?.employee?.farbe_kalender ?? '#3B82F6';
          empMap.set(key, {
            mitarbeiterId: key,
            mitarbeiterName: t.mitarbeiterName,
            farbe,
            anzahlTermine: 1,
            gesamtStunden: t.dauerStunden,
          });
        }
      }

      const mitarbeiterStunden = Array.from(empMap.values()).sort(
        (a, b) => b.gesamtStunden - a.gesamtStunden
      );

      // Summary
      const gesamtTermine = termine.length;
      const gesamtStunden = activeTermine.reduce((sum, t) => sum + t.dauerStunden, 0);
      const uniqueMitarbeiter = new Set(activeTermine.map((t) => t.mitarbeiterId ?? '__unassigned__'));
      const durchschnittProMitarbeiter =
        uniqueMitarbeiter.size > 0 ? gesamtStunden / uniqueMitarbeiter.size : 0;
      const cancelledCount = termine.filter((t) =>
        CANCELLED_STATUSES.includes(t.status)
      ).length;
      const stornoquote = gesamtTermine > 0 ? (cancelledCount / gesamtTermine) * 100 : 0;

      return {
        termine,
        mitarbeiterStunden,
        summary: {
          gesamtTermine,
          gesamtStunden: Math.round(gesamtStunden * 100) / 100,
          durchschnittProMitarbeiter: Math.round(durchschnittProMitarbeiter * 100) / 100,
          stornoquote: Math.round(stornoquote * 10) / 10,
        },
      };
    },
  });
}

// ─── Dropdown data hooks ────────────────────────────────────

export function useMitarbeiterList() {
  return useQuery({
    queryKey: ['reporting-mitarbeiter-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mitarbeiter')
        .select('id, vorname, nachname')
        .eq('ist_aktiv', true)
        .order('nachname', { ascending: true });

      if (error) throw error;

      return (data ?? []).map((m) => ({
        id: m.id,
        name: [m.vorname, m.nachname].filter(Boolean).join(' ') || 'Unbenannt',
      }));
    },
  });
}

export function useKundenList() {
  return useQuery({
    queryKey: ['reporting-kunden-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kunden')
        .select('id, name, vorname, nachname')
        .eq('aktiv', true)
        .order('name', { ascending: true });

      if (error) throw error;

      return (data ?? []).map((k) => ({
        id: k.id,
        name: k.name ?? ([k.vorname, k.nachname].filter(Boolean).join(' ') || 'Unbekannt'),
      }));
    },
  });
}

// ─── Kunden-Statistik Hook ──────────────────────────────────

export interface KundenStatistik {
  gesamt: number;
  aktiv: number;
  inaktiv: number;
  interessenten: number;
  pflegegradVerteilung: { pflegegrad: string; anzahl: number }[];
  kassePrivatVerteilung: { typ: string; anzahl: number }[];
}

export function useKundenStatistik() {
  return useQuery<KundenStatistik>({
    queryKey: ['reporting-kunden-statistik'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kunden')
        .select('id, aktiv, kategorie, pflegegrad, kasse_privat');

      if (error) throw error;
      const rows = data ?? [];

      const gesamt = rows.length;
      const aktiv = rows.filter((k) => k.aktiv).length;
      const inaktiv = rows.filter((k) => !k.aktiv).length;
      const interessenten = rows.filter((k) => k.kategorie === 'Interessent').length;

      // Pflegegrad-Verteilung
      const pgMap = new Map<string, number>();
      for (const k of rows) {
        const pg = k.pflegegrad != null ? `PG ${k.pflegegrad}` : 'Nicht angegeben';
        pgMap.set(pg, (pgMap.get(pg) ?? 0) + 1);
      }
      const pflegegradVerteilung = Array.from(pgMap.entries())
        .map(([pflegegrad, anzahl]) => ({ pflegegrad, anzahl }))
        .sort((a, b) => a.pflegegrad.localeCompare(b.pflegegrad));

      // Kasse/Privat-Verteilung
      const kpMap = new Map<string, number>();
      for (const k of rows) {
        const typ = k.kasse_privat || 'Nicht angegeben';
        kpMap.set(typ, (kpMap.get(typ) ?? 0) + 1);
      }
      const kassePrivatVerteilung = Array.from(kpMap.entries())
        .map(([typ, anzahl]) => ({ typ, anzahl }));

      return { gesamt, aktiv, inaktiv, interessenten, pflegegradVerteilung, kassePrivatVerteilung };
    },
  });
}

// ─── Auslastungs-Hook (Soll vs. Ist pro MA) ────────────────

export interface MitarbeiterAuslastung {
  id: string;
  name: string;
  farbe: string;
  sollStunden: number;
  istStunden: number;
  auslastungProzent: number;
  anzahlTermine: number;
}

export function useMitarbeiterAuslastung(filters: ReportingFilters) {
  const { dateFrom, dateTo } = filters;

  return useQuery<MitarbeiterAuslastung[]>({
    queryKey: ['reporting-auslastung', dateFrom.toISOString(), dateTo.toISOString()],
    queryFn: async () => {
      // Mitarbeiter mit Sollstunden
      const { data: maData, error: maError } = await supabase
        .from('mitarbeiter')
        .select('id, vorname, nachname, farbe_kalender, soll_wochenstunden')
        .eq('ist_aktiv', true);

      if (maError) throw maError;

      // Termine im Zeitraum
      const { data: termineData, error: termineError } = await supabase
        .from('termine')
        .select('id, mitarbeiter_id, start_at, end_at, status, iststunden')
        .gte('start_at', dateFrom.toISOString())
        .lte('start_at', dateTo.toISOString())
        .not('status', 'in', '("cancelled","abgesagt_rechtzeitig")');

      if (termineError) throw termineError;

      // Wochen im Zeitraum berechnen
      const msInWeek = 7 * 24 * 60 * 60 * 1000;
      const wochen = Math.max(1, Math.ceil((dateTo.getTime() - dateFrom.getTime()) / msInWeek));

      const result: MitarbeiterAuslastung[] = (maData ?? []).map((ma) => {
        const name = [ma.vorname, ma.nachname].filter(Boolean).join(' ') || 'Unbenannt';
        const maTermine = (termineData ?? []).filter((t) => t.mitarbeiter_id === ma.id);
        const istStunden = maTermine.reduce((sum, t) => sum + computeDauerStunden(t), 0);
        const sollStunden = (ma.soll_wochenstunden ?? 0) * wochen;
        const auslastungProzent = sollStunden > 0 ? (istStunden / sollStunden) * 100 : 0;

        return {
          id: ma.id,
          name,
          farbe: ma.farbe_kalender ?? '#3B82F6',
          sollStunden: Math.round(sollStunden * 10) / 10,
          istStunden: Math.round(istStunden * 10) / 10,
          auslastungProzent: Math.round(auslastungProzent),
          anzahlTermine: maTermine.length,
        };
      });

      return result.sort((a, b) => b.istStunden - a.istStunden);
    },
  });
}

// ─── Umsatz-Hook (Budget Transactions) ──────────────────────

export interface UmsatzDaten {
  gesamtUmsatz: number;
  nachTyp: { typ: string; betrag: number; stunden: number }[];
  nachMonat: { monat: string; betrag: number }[];
}

export function useUmsatzReport(filters: ReportingFilters) {
  const { dateFrom, dateTo } = filters;

  return useQuery<UmsatzDaten>({
    queryKey: ['reporting-umsatz', dateFrom.toISOString(), dateTo.toISOString()],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('budget_transactions' as any)
        .select('service_type, service_date, hours, total_amount') as any)
        .gte('service_date', dateFrom.toISOString().split('T')[0])
        .lte('service_date', dateTo.toISOString().split('T')[0]);

      if (error) throw error;
      const rows = (data ?? []) as any[];

      const gesamtUmsatz = rows.reduce((sum: number, r: any) => sum + (r.total_amount ?? 0), 0);

      // Nach Typ aggregieren
      const typMap = new Map<string, { betrag: number; stunden: number }>();
      const TYPE_LABELS: Record<string, string> = {
        ENTLASTUNG: 'Entlastung (§45b)',
        KOMBI: 'Kombileistung (§45a)',
        VERHINDERUNG: 'Verhinderungspflege (§39)',
        PRIVAT: 'Privatleistung',
      };
      for (const r of rows) {
        const typ = r.service_type || 'Sonstige';
        const existing = typMap.get(typ) ?? { betrag: 0, stunden: 0 };
        existing.betrag += r.total_amount ?? 0;
        existing.stunden += r.hours ?? 0;
        typMap.set(typ, existing);
      }
      const nachTyp = Array.from(typMap.entries()).map(([typ, val]) => ({
        typ: TYPE_LABELS[typ] ?? typ,
        betrag: Math.round(val.betrag * 100) / 100,
        stunden: Math.round(val.stunden * 10) / 10,
      }));

      // Nach Monat aggregieren
      const monatMap = new Map<string, number>();
      for (const r of rows) {
        const monat = r.service_date?.substring(0, 7) ?? 'Unbekannt';
        monatMap.set(monat, (monatMap.get(monat) ?? 0) + (r.total_amount ?? 0));
      }
      const nachMonat = Array.from(monatMap.entries())
        .map(([monat, betrag]) => ({ monat, betrag: Math.round(betrag * 100) / 100 }))
        .sort((a, b) => a.monat.localeCompare(b.monat));

      return { gesamtUmsatz: Math.round(gesamtUmsatz * 100) / 100, nachTyp, nachMonat };
    },
  });
}
