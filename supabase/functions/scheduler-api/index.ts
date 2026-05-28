import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

// ─── CORS ─────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function corsResponse(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function requireApiToken(req: Request): void {
  const expected = Deno.env.get('KITECH_API_TOKEN');
  if (!expected) {
    throw Object.assign(new Error('KITECH_API_TOKEN not configured'), { status: 500 });
  }
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }
  const provided = authHeader.slice('Bearer '.length).trim();

  // Timing-safe compare
  const enc = new TextEncoder();
  const a = enc.encode(provided);
  const b = enc.encode(expected);
  if (a.length !== b.length) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }
}

// ─── Supabase Client (Service Role) ───────────────────────────────────────────

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// ─── Helper: Berlin-Datum und -Zeit aus UTC-ISO-String ────────────────────────

function toBerlinDateTime(isoUtc: string): { date: string; time: string } {
  const dt = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(isoUtc));
  const p: Record<string, string> = {};
  for (const part of dt) {
    if (part.type !== 'literal') p[part.type] = part.value;
  }
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}

// ─── Helper: PostgreSQL TSTZRANGE parsen ──────────────────────────────────────

function parseTstzRange(range: string): { startDate: string; endDate: string } | null {
  const match = range?.match(/[\[(](.+?),(.+?)[\])]/);
  if (!match) return null;
  const start = toBerlinDateTime(match[1].trim()).date;
  const end = toBerlinDateTime(match[2].trim()).date;
  return { startDate: start, endDate: end };
}

// ─── Helper: JSON-Response ────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

// ─── K1: /open-shifts ─────────────────────────────────────────────────────────

async function handleOpenShifts(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  if (!from || !to) {
    return errorResponse('Query params "from" and "to" (YYYY-MM-DD) are required', 400);
  }

  const toExclusive = new Date(to);
  toExclusive.setDate(toExclusive.getDate() + 1);
  const toExclusiveStr = toExclusive.toISOString().slice(0, 10);

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('termine')
    .select('id, start_at, end_at, kunden_id, mitarbeiter_id, kategorie, status')
    .is('mitarbeiter_id', null)
    .eq('status', 'unassigned')
    .not('kunden_id', 'is', null)
    .not('kategorie', 'in', '("Intern","Schulung","Erstgespräch")')
    .gte('start_at', from)
    .lt('end_at', toExclusiveStr);

  if (error) {
    console.error('[K1 open-shifts] DB error:', error);
    return errorResponse('Database error', 500);
  }

  const result = (data ?? []).map((row: Record<string, unknown>) => {
    const { date, time: startTime } = toBerlinDateTime(row.start_at as string);
    const { time: endTime } = toBerlinDateTime(row.end_at as string);
    return {
      id: row.id,
      date,
      startTime,
      endTime,
      userId: null,
      addressId: row.kunden_id,
      workSpaceId: (row.kategorie as string | null) ?? 'Regelbesuch',
      comment: '',
    };
  });

  return jsonResponse({ data: result });
}

// ─── K2: /assigned-shifts ─────────────────────────────────────────────────────

async function handleAssignedShifts(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  if (!from || !to) {
    return errorResponse('Query params "from" and "to" (YYYY-MM-DD) are required', 400);
  }

  const toExclusive = new Date(to);
  toExclusive.setDate(toExclusive.getDate() + 1);
  const toExclusiveStr = toExclusive.toISOString().slice(0, 10);

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('termine')
    .select('id, start_at, end_at, kunden_id, mitarbeiter_id, kategorie, status')
    .not('mitarbeiter_id', 'is', null)
    .gte('start_at', from)
    .lt('end_at', toExclusiveStr);

  if (error) {
    console.error('[K2 assigned-shifts] DB error:', error);
    return errorResponse('Database error', 500);
  }

  const result = (data ?? []).map((row: Record<string, unknown>) => {
    const { date, time: startTime } = toBerlinDateTime(row.start_at as string);
    const { time: endTime } = toBerlinDateTime(row.end_at as string);
    return {
      id: row.id,
      date,
      startTime,
      endTime,
      userId: row.mitarbeiter_id,
      addressId: row.kunden_id,
      workSpaceId: (row.kategorie as string | null) ?? 'Regelbesuch',
      comment: '',
    };
  });

  return jsonResponse({ data: result });
}

// ─── K3: /employees ───────────────────────────────────────────────────────────

async function handleEmployees(): Promise<Response> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('mitarbeiter')
    .select('id, vorname, nachname, ist_aktiv, in_scheduling_pool')
    .eq('ist_aktiv', true);

  if (error) {
    console.error('[K3 employees] DB error:', error);
    return errorResponse('Database error', 500);
  }

  const result = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    name: `${row.nachname ?? ''}, ${row.vorname ?? ''}`.trim().replace(/^,\s*|,\s*$/, ''),
    role: 'employee',
    isDeleted: false,
    isActive: row.ist_aktiv ?? true,
    in_scheduling_pool: (row.in_scheduling_pool as boolean | null) ?? true,
  }));

  return jsonResponse({ data: result });
}

// ─── PLZ → Zonen-Farbe (Option B: PLZ-basiertes Matching) ────────────────────
// Ableitung aus zone-mapping.json des Aplano-Schedulers.
// Bei mehrfach belegten PLZ gilt: erste/primäre Zone gewinnt.

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

function plzToZoneColor(plz: string | null | undefined): string {
  if (!plz) return '#aad1ff'; // Sonstige / Intern
  const clean = plz.trim().slice(0, 5);
  return PLZ_TO_ZONE_COLOR[clean] ?? '#aad1ff';
}

// ─── K4: /addresses ───────────────────────────────────────────────────────────

async function handleAddresses(): Promise<Response> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('kunden')
    .select('id, name, vorname, nachname, aktiv, plz');

  if (error) {
    console.error('[K4 addresses] DB error:', error);
    return errorResponse('Database error', 500);
  }

  const result = (data ?? []).map((row: Record<string, unknown>) => {
    const displayName =
      (row.name as string | null) ??
      [row.nachname, row.vorname].filter(Boolean).join(', ');
    return {
      id: row.id,
      name: displayName,
      color: plzToZoneColor(row.plz as string | null),
      postal_code: (row.plz as string | null) ?? null,
      isInactive: !(row.aktiv as boolean),
    };
  });

  return jsonResponse({ data: result });
}

// ─── K5: /absences ────────────────────────────────────────────────────────────

async function handleAbsences(): Promise<Response> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('mitarbeiter_abwesenheiten')
    .select('mitarbeiter_id, zeitraum');

  if (error) {
    console.error('[K5 absences] DB error:', error);
    return errorResponse('Database error', 500);
  }

  const result: Array<{ userId: string; startDate: string; endDate: string }> = [];

  for (const row of data ?? []) {
    const parsed = parseTstzRange((row as Record<string, unknown>).zeitraum as string);
    if (!parsed) continue;
    result.push({
      userId: (row as Record<string, unknown>).mitarbeiter_id as string,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
    });
  }

  return jsonResponse({ data: result });
}

// ─── K6: /availability-blocks ─────────────────────────────────────────────────

function handleAvailabilityBlocks(): Response {
  // Kein direktes Äquivalent in Kitech — leere Liste
  return jsonResponse({ data: [] });
}

// ─── K7: /shift-categories ────────────────────────────────────────────────────

function handleShiftCategories(): Response {
  return jsonResponse({
    data: [
      { id: 'storno_klient', name: 'Kunde hat (kurzfristig) abgesagt / nicht aufgemacht' },
      { id: 'storno_ma', name: '(Krankheits-)ausfall Mitarbeiter' },
      { id: 'storno_kunde', name: '(Krankheits-)ausfall Kunde' },
      { id: 'intern_blocker', name: 'Blocker privat und geschäftlich' },
      { id: 'regelbesuch', name: 'Regelbesuch' },
      { id: 'erstgespraech', name: 'Erstgespräch' },
      { id: 'schulung', name: 'Schulung' },
      { id: 'intern', name: 'Intern' },
    ],
  });
}

// ─── K8: /employee-availability ───────────────────────────────────────────────

const WEEKDAY_MAP: Record<number, string> = {
  0: 'so',
  1: 'mo',
  2: 'di',
  3: 'mi',
  4: 'do',
  5: 'fr',
  6: 'sa',
};

async function handleEmployeeAvailability(): Promise<Response> {
  const supabase = getSupabase();

  // Mitarbeiter mit Verfügbarkeiten laden
  const { data: mitarbeiter, error: maError } = await supabase
    .from('mitarbeiter')
    .select(`
      id,
      vorname,
      nachname,
      ist_aktiv,
      in_scheduling_pool,
      is_bookable,
      soll_wochenstunden,
      max_termine_pro_tag,
      benutzer_id,
      mitarbeiter_verfuegbarkeit (
        wochentag,
        von,
        bis
      )
    `)
    .eq('ist_aktiv', true);

  if (maError) {
    console.error('[K8 employee-availability] mitarbeiter error:', maError);
    return errorResponse('Database error', 500);
  }

  // GF-Rollen aus user_roles laden (geschaeftsfuehrer + globaladmin)
  const { data: gfRoles, error: rolesError } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', ['geschaeftsfuehrer', 'globaladmin']);

  if (rolesError) {
    console.error('[K8 employee-availability] user_roles error:', rolesError);
    return errorResponse('Database error', 500);
  }

  const gfUserIds = new Set((gfRoles ?? []).map((r: Record<string, unknown>) => r.user_id as string));

  const result = (mitarbeiter ?? []).map((ma: Record<string, unknown>) => {
    const verfuegbarkeit = (ma.mitarbeiter_verfuegbarkeit as Array<Record<string, unknown>>) ?? [];

    // Verfügbarkeiten nach Wochentag gruppieren
    const availability: Record<string, Array<{ start: string; end: string }>> = {};
    for (const slot of verfuegbarkeit) {
      const dayKey = WEEKDAY_MAP[slot.wochentag as number];
      if (!dayKey) continue;
      if (!availability[dayKey]) availability[dayKey] = [];
      // von/bis kommen als "HH:MM:SS" — auf "HH:MM" kürzen
      const start = (slot.von as string).slice(0, 5);
      const end = (slot.bis as string).slice(0, 5);
      availability[dayKey].push({ start, end });
    }

    const benutzer_id = ma.benutzer_id as string | null;
    const isGf = benutzer_id != null && gfUserIds.has(benutzer_id);

    return {
      userId: ma.id,
      name: `${ma.nachname ?? ''}, ${ma.vorname ?? ''}`.trim().replace(/^,\s*|,\s*$/, ''),
      in_scheduling_pool: (ma.in_scheduling_pool as boolean | null) ?? (ma.is_bookable as boolean | null) ?? true,
      weekly_hours: (ma.soll_wochenstunden as number | null) ?? 0,
      max_shifts_per_day: (ma.max_termine_pro_tag as number | null) ?? 4,
      is_gf: isGf,
      availability,
    };
  });

  return jsonResponse({ data: result });
}

// ─── Router ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    requireApiToken(req);
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    return errorResponse(e.message, e.status ?? 401);
  }

  // Pfad nach "scheduler-api" extrahieren
  const pathname = new URL(req.url).pathname;
  // z.B. "/functions/v1/scheduler-api/open-shifts" → "/open-shifts"
  const match = pathname.match(/\/scheduler-api(\/[^?]*)?/);
  const subPath = match?.[1]?.replace(/\/$/, '') ?? '/';

  try {
    switch (subPath) {
      case '/open-shifts':
        return await handleOpenShifts(req);

      case '/assigned-shifts':
        return await handleAssignedShifts(req);

      case '/employees':
        return await handleEmployees();

      case '/addresses':
        return await handleAddresses();

      case '/absences':
        return await handleAbsences();

      case '/availability-blocks':
        return handleAvailabilityBlocks();

      case '/shift-categories':
        return handleShiftCategories();

      case '/employee-availability':
        return await handleEmployeeAvailability();

      default:
        return errorResponse(`Unknown endpoint: ${subPath}`, 404);
    }
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    console.error(`[scheduler-api] Unhandled error on ${subPath}:`, e);
    return errorResponse(e.message ?? 'Internal server error', e.status ?? 500);
  }
});
