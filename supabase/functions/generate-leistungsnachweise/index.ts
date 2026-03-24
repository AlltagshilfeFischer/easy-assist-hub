import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify caller is admin/GF
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const { data: isAdmin } = await supabaseAdmin.rpc('is_admin_or_higher', { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    // monat is 1-indexed (1=Januar, 12=Dezember)
    // If no params given, defaults to previous month
    const body = await req.json().catch(() => ({}));

    const now = new Date();
    const currentMonth0 = now.getMonth(); // 0-indexed (0=Jan)
    const targetMonat = body.monat != null
      ? body.monat
      : (currentMonth0 === 0 ? 12 : currentMonth0); // previous month, 1-indexed
    const targetJahr = body.jahr != null
      ? body.jahr
      : (currentMonth0 === 0 ? now.getFullYear() - 1 : now.getFullYear());

    // Build date range for the target month
    const startDate = new Date(targetJahr, targetMonat - 1, 1);
    const endDate = new Date(targetJahr, targetMonat, 1); // first day of next month

    // Find all completed/nicht_angetroffen appointments in the month
    const { data: termine, error: termineError } = await supabaseAdmin
      .from('termine')
      .select('id, kunden_id, start_at, end_at, iststunden, status')
      .gte('start_at', startDate.toISOString())
      .lt('start_at', endDate.toISOString())
      .in('status', ['completed', 'nicht_angetroffen', 'cancelled'])
      .not('kunden_id', 'is', null);

    if (termineError) throw new Error(`Termine fetch: ${termineError.message}`);

    if (!termine || termine.length === 0) {
      return new Response(JSON.stringify({
        created: 0,
        skipped: 0,
        message: `Keine abrechenbaren Termine im ${targetMonat}/${targetJahr}`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Group by kunden_id
    const byKunde: Record<string, typeof termine> = {};
    for (const t of termine) {
      if (!t.kunden_id) continue;
      if (!byKunde[t.kunden_id]) byKunde[t.kunden_id] = [];
      byKunde[t.kunden_id].push(t);
    }

    // Check existing LN for this month
    const { data: existingLN } = await supabaseAdmin
      .from('leistungsnachweise')
      .select('kunden_id')
      .eq('monat', targetMonat)
      .eq('jahr', targetJahr);

    const existingKundenIds = new Set((existingLN ?? []).map((ln) => ln.kunden_id));

    let created = 0;
    let skipped = 0;

    for (const [kundenId, kundenTermine] of Object.entries(byKunde)) {
      // Skip if LN already exists
      if (existingKundenIds.has(kundenId)) {
        skipped++;
        continue;
      }

      // Calculate hours
      let geplanteStunden = 0;
      let geleisteteStunden = 0;

      for (const t of kundenTermine) {
        const start = new Date(t.start_at);
        const end = new Date(t.end_at);
        const planned = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        geplanteStunden += planned;

        if (t.status === 'completed' || t.status === 'nicht_angetroffen') {
          geleisteteStunden += t.iststunden ?? planned;
        }
      }

      // Get customer info for defaults
      const { data: kunde } = await supabaseAdmin
        .from('kunden')
        .select('pflegegrad, ist_privat')
        .eq('id', kundenId)
        .single();

      const { error: insertError } = await supabaseAdmin
        .from('leistungsnachweise')
        .insert({
          kunden_id: kundenId,
          monat: targetMonat,
          jahr: targetJahr,
          geplante_stunden: Math.round(geplanteStunden * 100) / 100,
          geleistete_stunden: Math.round(geleisteteStunden * 100) / 100,
          status: 'entwurf',
          ist_privat: kunde?.ist_privat ?? false,
          cb_entlastungsleistung: !kunde?.ist_privat,
        });

      if (insertError) {
        console.error(`LN insert error for kunde ${kundenId}:`, insertError.message);
        continue;
      }

      created++;
    }

    return new Response(JSON.stringify({
      created,
      skipped,
      monat: targetMonat,
      jahr: targetJahr,
      message: `${created} Leistungsnachweise erstellt, ${skipped} uebersprungen (existieren bereits)`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Generate LN error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
