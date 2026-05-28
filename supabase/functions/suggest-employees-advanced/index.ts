import { requireAuth, createAdminClient } from '../_shared/auth.ts';

// ─── CORS ─────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

// ─── Berlin-Zeit Helpers ──────────────────────────────────────────────────────

const berlinDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const berlinTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Returns "YYYY-MM-DD" in Europe/Berlin time. */
function toBerlinDate(isoUtc: string): string {
  return berlinDateFormatter.format(new Date(isoUtc));
}

/** Returns minutes since midnight in Europe/Berlin time. */
function toBerlinMinutes(isoUtc: string): number {
  const parts = berlinTimeFormatter.formatToParts(new Date(isoUtc));
  const p: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') p[part.type] = part.value;
  }
  return parseInt(p.hour ?? '0', 10) * 60 + parseInt(p.minute ?? '0', 10);
}

// ─── PLZ → Zonen-Farbe ───────────────────────────────────────────────────────

const PLZ_TO_ZONE_COLOR: Record<string, string> = {
  // Langenhagen / Nordosten
  '30916': '#35afe2', '30855': '#35afe2', '30659': '#35afe2',
  // Ricklingen / Hemmingen
  '30459': '#cdcdce', '30457': '#cdcdce', '30966': '#cdcdce',
  // Vahrenwald-List / Herrenhausen
  '30419': '#ffaade', '30163': '#ffaade', '30165': '#ffaade',
  // Buchholz-Kleefeld / Oststadt
  '30627': '#41b955', '30655': '#41b955', '30625': '#41b955',
  // Linden / Ahlem-Davenstedt
  '30453': '#d746a4', '30455': '#d746a4', '30449': '#d746a4',
  // Hannover-Innenstadt / Südstadt
  '30519': '#373133', '30173': '#373133', '30880': '#373133',
  // Hildesheim
  '31134': '#12aca4', '31139': '#12aca4', '31141': '#12aca4',
  // Lehrte
  '31275': '#993497', '31319': '#993497', '31249': '#993497',
  // Garbsen
  '30823': '#ffc7cd', '30926': '#ffc7cd',
  // Vahrenwald-List West
  '30177': '#2c7dc1', '30161': '#2c7dc1',
  // Misburg-Anderten
  '30629': '#9ae6a4', '30559': '#9ae6a4',
  // Ronnenberg / Gehrden
  '30952': '#e8e5e5', '30989': '#e8e5e5',
  // Kirchrode-Bemerode
  '30539': '#f8972c',
  // Vahrenwald-List / Burgdorf
  '30167': '#eeabd7', '31303': '#eeabd7',
  // Garbsen / Gemischt
  '30179': '#f3989f', '30827': '#f3989f',
  // Hannover-Südstadt
  '30175': '#ccf586',
};

function plzToZone(plz: string | null): string {
  if (!plz) return '#aad1ff';
  return PLZ_TO_ZONE_COLOR[plz.trim().slice(0, 5)] ?? '#aad1ff';
}

// ─── Zonen-Namen Mapping ──────────────────────────────────────────────────────

const ZONE_COLOR_TO_NAME: Record<string, string> = {
  '#35afe2': 'Langenhagen / Nordosten',
  '#cdcdce': 'Ricklingen / Hemmingen',
  '#ffaade': 'Vahrenwald-List / Herrenhausen',
  '#41b955': 'Buchholz-Kleefeld / Oststadt',
  '#d746a4': 'Linden / Ahlem-Davenstedt',
  '#373133': 'Hannover-Innenstadt / Südstadt',
  '#12aca4': 'Hildesheim',
  '#993497': 'Lehrte',
  '#ffc7cd': 'Garbsen',
  '#2c7dc1': 'Vahrenwald-List West',
  '#9ae6a4': 'Misburg-Anderten',
  '#e8e5e5': 'Ronnenberg / Gehrden',
  '#f8972c': 'Kirchrode-Bemerode',
  '#eeabd7': 'Vahrenwald-List / Burgdorf',
  '#f3989f': 'Garbsen / Gemischt',
  '#ccf586': 'Hannover-Südstadt',
  '#aad1ff': 'Sonstige / Unbekannt',
};

// ─── DB Row Types ─────────────────────────────────────────────────────────────

interface TerminRow {
  id: string;
  start_at: string;
  end_at: string;
  mitarbeiter_id: string | null;
  kunden: { plz: string | null } | null;
}

interface MitarbeiterRow {
  id: string;
  vorname: string | null;
  nachname: string | null;
  farbe_kalender: string | null;
  max_termine_pro_tag: number | null;
  soll_wochenstunden: number | null;
  in_scheduling_pool: boolean | null;
  is_bookable: boolean | null;
  benutzer_id: string | null;
}

interface AbwesenheitRow {
  mitarbeiter_id: string;
  zeitraum: string;
}

interface UserRoleRow {
  user_id: string;
}

// ─── Suggestion Type ──────────────────────────────────────────────────────────

interface Suggestion {
  mitarbeiter_id: string;
  name: string;
  farbe_kalender: string;
  score: number;
  zone_match: boolean;
  zone_color: string;
  today_appointments: number;
  reasons: string[];
  is_fallback: boolean;
}

// ─── Abwesenheit: TSTZRANGE parsen ───────────────────────────────────────────

function parseAbwesenheitRange(zeitraum: string): { start: string; end: string } | null {
  const match = zeitraum?.match(/[\[(](.+?),(.+?)[\])]/);
  if (!match) return null;
  return {
    start: toBerlinDate(match[1].trim()),
    end: toBerlinDate(match[2].trim()),
  };
}

function isAbwesend(zeitraume: Array<{ start: string; end: string }>, terminDate: string): boolean {
  for (const z of zeitraume) {
    if (terminDate >= z.start && terminDate <= z.end) return true;
  }
  return false;
}

// ─── Termin-Überlappung (mit 15 Min Pause-Puffer) ────────────────────────────

const PAUSE_BUFFER_MIN = 15;

function hasTimeConflict(
  existingTermine: Array<{ start: number; end: number }>,
  newStart: number,
  newEnd: number,
): boolean {
  for (const t of existingTermine) {
    // Erweitertes Fenster des bestehenden Termins mit Pause-Puffer
    const bufferedStart = t.start - PAUSE_BUFFER_MIN;
    const bufferedEnd = t.end + PAUSE_BUFFER_MIN;
    // Überlappung: neuer Termin beginnt vor Ende des alten und endet nach Beginn des alten
    if (newStart < bufferedEnd && newEnd > bufferedStart) return true;
  }
  return false;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Auth — Supabase JWT
  try {
    await requireAuth(req);
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    return errorResponse(e.message, e.status ?? 401);
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  // ── Input lesen ────────────────────────────────────────────────────────────
  let termin_id: string | undefined;
  try {
    const body = await req.json();
    termin_id = body?.termin_id;
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  if (!termin_id || typeof termin_id !== 'string') {
    return errorResponse('termin_id is required', 400);
  }

  const supabase = createAdminClient();

  // ── Schritt 1: Termin + Kundendaten laden ──────────────────────────────────
  const { data: terminData, error: terminError } = await supabase
    .from('termine')
    .select('id, start_at, end_at, mitarbeiter_id, kunden:kunden_id(plz)')
    .eq('id', termin_id)
    .single();

  if (terminError || !terminData) {
    console.error('[suggest-employees-advanced] Termin not found:', terminError);
    return errorResponse('Termin not found', 404);
  }

  const termin = terminData as unknown as TerminRow;
  const terminDate = toBerlinDate(termin.start_at);
  const terminStartMin = toBerlinMinutes(termin.start_at);
  const terminEndMin = toBerlinMinutes(termin.end_at);

  // ── Schritt 2: Zielzone berechnen ──────────────────────────────────────────
  const kundenPlz = termin.kunden?.plz ?? null;
  const terminZone = plzToZone(kundenPlz);

  // ── Schritt 3: Historische + aktuelle Termine laden (45 Tage History + 14 Tage voraus) ──
  const { data: historyData, error: historyError } = await supabase
    .from('termine')
    .select('id, start_at, end_at, mitarbeiter_id, kunden:kunden_id(plz)')
    .not('mitarbeiter_id', 'is', null)
    .gte('start_at', new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString())
    .lte('start_at', new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString())
    .not('status', 'in', '("cancelled","abgesagt_rechtzeitig")');

  if (historyError) {
    console.error('[suggest-employees-advanced] History query error:', historyError);
    return errorResponse('Database error', 500);
  }

  const historyTermine = (historyData ?? []) as unknown as TerminRow[];

  // ── Schritt 4: Aktive Mitarbeiter laden ────────────────────────────────────
  const { data: mitarbeiterData, error: maError } = await supabase
    .from('mitarbeiter')
    .select('id, vorname, nachname, farbe_kalender, max_termine_pro_tag, soll_wochenstunden, in_scheduling_pool, is_bookable, benutzer_id')
    .eq('ist_aktiv', true);

  if (maError) {
    console.error('[suggest-employees-advanced] Mitarbeiter query error:', maError);
    return errorResponse('Database error', 500);
  }

  const mitarbeiterList = (mitarbeiterData ?? []) as MitarbeiterRow[];

  // ── Schritt 5: Abwesenheiten laden ────────────────────────────────────────
  const { data: abwesenheitData, error: abwError } = await supabase
    .from('mitarbeiter_abwesenheiten')
    .select('mitarbeiter_id, zeitraum');

  if (abwError) {
    console.error('[suggest-employees-advanced] Abwesenheit query error:', abwError);
    return errorResponse('Database error', 500);
  }

  const abwesenheitenRaw = (abwesenheitData ?? []) as AbwesenheitRow[];

  // Abwesenheiten pro Mitarbeiter aufbauen
  const abwesenheitenByMa = new Map<string, Array<{ start: string; end: string }>>();
  for (const row of abwesenheitenRaw) {
    const parsed = parseAbwesenheitRange(row.zeitraum);
    if (!parsed) continue;
    const existing = abwesenheitenByMa.get(row.mitarbeiter_id) ?? [];
    existing.push(parsed);
    abwesenheitenByMa.set(row.mitarbeiter_id, existing);
  }

  // ── Schritt 6: GF-Rollen laden ────────────────────────────────────────────
  const { data: rolesData, error: rolesError } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', ['geschaeftsfuehrer', 'globaladmin']);

  if (rolesError) {
    console.error('[suggest-employees-advanced] Roles query error:', rolesError);
    return errorResponse('Database error', 500);
  }

  const gfUserIds = new Set(
    ((rolesData ?? []) as UserRoleRow[]).map((r) => r.user_id),
  );

  // ── Schritt 7: Zonen-Profile + Tages-Termine pro Mitarbeiter aufbauen ─────
  // zone_counts: wie oft hat MA in den letzten 45 Tagen in einer Zone gearbeitet
  const zoneCounts = new Map<string, Record<string, number>>();
  // dayTermine: Termine des MA am Termin-Tag (mit Berliner Minuten für Timing)
  const dayTermine = new Map<string, Array<{ start: number; end: number; zone: string }>>();

  for (const t of historyTermine) {
    if (!t.mitarbeiter_id) continue;

    const zone = plzToZone(t.kunden?.plz ?? null);
    const tDate = toBerlinDate(t.start_at);

    // Zonen-Count für 45-Tage History
    const counts = zoneCounts.get(t.mitarbeiter_id) ?? {};
    counts[zone] = (counts[zone] ?? 0) + 1;
    zoneCounts.set(t.mitarbeiter_id, counts);

    // Termine am Termin-Tag
    if (tDate === terminDate) {
      const list = dayTermine.get(t.mitarbeiter_id) ?? [];
      list.push({
        start: toBerlinMinutes(t.start_at),
        end: toBerlinMinutes(t.end_at),
        zone,
      });
      dayTermine.set(t.mitarbeiter_id, list);
    }
  }

  // ── Schritt 8: Scoring ────────────────────────────────────────────────────
  const normalSuggestions: Suggestion[] = [];
  const fallbackSuggestions: Suggestion[] = [];

  for (const ma of mitarbeiterList) {
    const maAbwesenheiten = abwesenheitenByMa.get(ma.id) ?? [];
    const maDayTermine = dayTermine.get(ma.id) ?? [];
    const maZoneCounts = zoneCounts.get(ma.id) ?? {};

    // 1. Abwesenheits-Check
    if (isAbwesend(maAbwesenheiten, terminDate)) continue;

    // 2. Zeitkonflikt-Check (mit Pause-Puffer)
    if (hasTimeConflict(maDayTermine, terminStartMin, terminEndMin)) continue;

    // 3. Zone-Score berechnen
    let zoneScore = 0;
    let zoneMatch = false;
    const reasons: string[] = [];

    const todayZones = maDayTermine.map((t) => t.zone);
    const hasTermineToday = maDayTermine.length > 0;

    if (hasTermineToday) {
      const sameZoneTermine = maDayTermine.filter((t) => t.zone === terminZone);
      if (sameZoneTermine.length > 0) {
        zoneScore += 100;
        zoneMatch = true;
        reasons.push('In gleicher Zone');

        // Back-to-Back Bonus: Lücke ≤ 60 Min zu einem Termin in der gleichen Zone
        for (const existing of sameZoneTermine) {
          const gapBefore = terminStartMin - existing.end;
          const gapAfter = existing.start - terminEndMin;
          if ((gapBefore >= 0 && gapBefore <= 60) || (gapAfter >= 0 && gapAfter <= 60)) {
            zoneScore += 10;
            reasons.push('Back-to-Back möglich');
            break;
          }
        }
      } else {
        // Hat Termine, aber in anderer Zone
        zoneScore -= 30;
        reasons.push('Andere Zone heute');
      }
    } else {
      // Keine Termine heute — historische Zonen prüfen
      zoneScore = 0;
      if ((maZoneCounts[terminZone] ?? 0) >= 5) {
        zoneScore += 20;
        reasons.push('Vertraute Zone (historisch)');
      }
    }

    // 4. Gap-Score berechnen (zeitliche Nähe zu bestehenden Terminen)
    let gapScore = 0;
    if (maDayTermine.length > 0) {
      let minGap = Infinity;
      for (const existing of maDayTermine) {
        const gapBefore = terminStartMin - existing.end;
        const gapAfter = existing.start - terminEndMin;
        // Nur positive Lücken (kein Überlapp, der wurde schon oben gefiltert)
        if (gapBefore > 0) minGap = Math.min(minGap, gapBefore);
        if (gapAfter > 0) minGap = Math.min(minGap, gapAfter);
      }
      if (minGap <= 60) {
        gapScore = 10;
      } else if (minGap <= 120) {
        gapScore = 6;
      } else if (minGap <= 240) {
        gapScore = 2;
      }
    }

    // 5. Total Score
    const totalScore = zoneScore + gapScore;

    // 6. GF-Status
    const isGf = ma.benutzer_id != null && gfUserIds.has(ma.benutzer_id);

    // 7. Pool-Status (in_pool = in_scheduling_pool !== false, aber kein GF)
    const inPool = (ma.in_scheduling_pool !== false) && !isGf;

    const suggestion: Suggestion = {
      mitarbeiter_id: ma.id,
      name: [ma.vorname, ma.nachname].filter(Boolean).join(' '),
      farbe_kalender: ma.farbe_kalender ?? '#6b7280',
      score: totalScore,
      zone_match: zoneMatch,
      zone_color: terminZone,
      today_appointments: maDayTermine.length,
      reasons,
      is_fallback: isGf || totalScore < 100,
    };

    // Pool-MAs mit score >= 100 → normale Vorschläge
    if (inPool && totalScore >= 100) {
      normalSuggestions.push(suggestion);
    } else {
      // GF oder score < 100 → Fallback
      suggestion.is_fallback = true;
      fallbackSuggestions.push(suggestion);
    }
  }

  // ── Schritt 9: Sortieren + Top N auswählen ────────────────────────────────
  normalSuggestions.sort((a, b) => b.score - a.score);
  fallbackSuggestions.sort((a, b) => b.score - a.score);

  const topNormal = normalSuggestions.slice(0, 3);
  const topFallback = fallbackSuggestions.slice(0, 2);
  const suggestions = [...topNormal, ...topFallback];

  // ── Response ──────────────────────────────────────────────────────────────
  return jsonResponse({
    termin_zone: terminZone,
    zone_name: ZONE_COLOR_TO_NAME[terminZone] ?? 'Unbekannt',
    suggestions,
  });
});
