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

    // Verify admin role using verified JWT (avoid /user call to prevent session_not_found)
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Not authenticated');
    }
    const token = authHeader.slice('Bearer '.length).trim();

    // Decode JWT payload
    let userId: string | null = null;
    try {
      const payloadBase64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = atob(payloadBase64);
      const payload = JSON.parse(payloadJson);
      userId = payload.sub ?? null;
    } catch (e) {
      console.error('JWT decode failed:', e);
      throw new Error('Not authenticated');
    }
    if (!userId) {
      throw new Error('Not authenticated');
    }

    // Check admin role using SECURITY DEFINER function to avoid table permission issues
    const { data: isAdmin, error: isAdminErr } = await supabaseAdmin.rpc('is_admin_or_higher', { _user_id: userId });
    if (isAdminErr || !isAdmin) {
      console.error('Admin role check failed via is_admin:', isAdminErr);
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
