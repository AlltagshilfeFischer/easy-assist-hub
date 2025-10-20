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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin role
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: benutzerData } = await supabaseClient
      .from('benutzer')
      .select('rolle')
      .eq('id', user.id)
      .single();

    if (benutzerData?.rolle !== 'admin') {
      throw new Error('Not authorized - admin role required');
    }

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
        reviewed_by: user.id,
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
