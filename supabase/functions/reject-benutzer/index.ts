import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { requireAdmin, unauthorizedResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await requireAdmin(req);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get request body
    const { registration_id, reason } = await req.json();

    if (!registration_id) {
      throw new Error('registration_id is required');
    }

    console.log('Rejecting registration:', { registration_id, reason });

    // Update registration status to rejected
    const { error: updateError } = await supabaseAdmin
      .from('pending_registrations')
      .update({
        status: 'rejected',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason || null
      })
      .eq('id', registration_id)
      .eq('status', 'pending');

    if (updateError) {
      console.error('Registration update error:', updateError);
      throw new Error(`Failed to update registration: ${updateError.message}`);
    }

    console.log('Registration rejected successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Registration rejected' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error:', error);
    const status = (error as any)?.status;
    if (status === 401 || status === 403) return unauthorizedResponse((error as Error).message, status);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
