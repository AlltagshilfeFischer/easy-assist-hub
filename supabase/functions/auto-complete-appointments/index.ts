import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { requireCronSecret, unauthorizedResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    requireCronSecret(req);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date().toISOString();

    // Nur Termine mit status='scheduled' und end_at in der Vergangenheit
    const { data: termine, error: fetchError } = await supabaseAdmin
      .from('termine')
      .select('id')
      .eq('status', 'scheduled')
      .lt('end_at', now);

    if (fetchError) {
      throw new Error(`Fetch error: ${fetchError.message}`);
    }

    if (!termine || termine.length === 0) {
      return new Response(
        JSON.stringify({ completed: 0, timestamp: now }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ids = termine.map((t: { id: string }) => t.id);

    const { error: updateError, count } = await supabaseAdmin
      .from('termine')
      .update({
        status: 'completed',
        auto_completed_at: now,
        updated_at: now,
      })
      .in('id', ids)
      .eq('status', 'scheduled');

    if (updateError) {
      throw new Error(`Update error: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ completed: count ?? ids.length, timestamp: now }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Auto-complete error:', error);
    const status = (error as any)?.status;
    if (status === 401 || status === 403) return unauthorizedResponse((error as Error).message, status);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
