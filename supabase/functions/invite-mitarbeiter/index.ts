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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin role
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Not authenticated');
    }
    const token = authHeader.slice('Bearer '.length).trim();
    
    let userId: string | null = null;
    try {
      const payloadBase64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = atob(payloadBase64);
      const payload = JSON.parse(payloadJson);
      userId = payload.sub ?? null;
    } catch (e) {
      throw new Error('Not authenticated');
    }
    if (!userId) throw new Error('Not authenticated');

    const { data: isAdmin, error: isAdminErr } = await supabaseAdmin.rpc('is_admin_or_higher', { _user_id: userId });
    if (isAdminErr || !isAdmin) {
      throw new Error('Not authorized - admin role required');
    }

    const { mitarbeiter_id, email } = await req.json();

    if (!mitarbeiter_id || !email) {
      throw new Error('mitarbeiter_id und email sind erforderlich');
    }

    // Verify mitarbeiter exists
    const { data: mitarbeiter, error: mitErr } = await supabaseAdmin
      .from('mitarbeiter')
      .select('id, vorname, nachname, benutzer_id')
      .eq('id', mitarbeiter_id)
      .single();

    if (mitErr || !mitarbeiter) {
      throw new Error('Mitarbeiter nicht gefunden');
    }

    // Check if mitarbeiter already has a real auth account (not a placeholder)
    if (mitarbeiter.benutzer_id) {
      // Check if the benutzer_id is a placeholder (email contains @placeholder.local)
      const { data: benutzerCheck } = await supabaseAdmin
        .from('benutzer')
        .select('email')
        .eq('id', mitarbeiter.benutzer_id)
        .maybeSingle();

      const isPlaceholder = benutzerCheck?.email?.includes('@placeholder.local');
      
      if (!isPlaceholder) {
        throw new Error('Dieser Mitarbeiter hat bereits ein Benutzerkonto');
      }
      // Placeholder benutzer_id is fine - will be replaced during approval
      console.log('Mitarbeiter has placeholder benutzer_id, proceeding with invite');
    }

    console.log('Inviting mitarbeiter:', { mitarbeiter_id, email, vorname: mitarbeiter.vorname, nachname: mitarbeiter.nachname });

    // Create pending registration to track the invite
    await supabaseAdmin
      .from('pending_registrations')
      .upsert({
        email: email.toLowerCase(),
        vorname: mitarbeiter.vorname || null,
        nachname: mitarbeiter.nachname || null,
        status: 'pending',
        ignored: false,
        rejection_reason: null,
        reviewed_at: null,
        reviewed_by: null,
      }, { onConflict: 'email' });

    // Send invite email with mitarbeiter_id in metadata so we can link on registration
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${Deno.env.get('SITE_URL') || 'https://easy-assist-hub.lovable.app'}/auth`,
      data: {
        vorname: mitarbeiter.vorname || '',
        nachname: mitarbeiter.nachname || '',
        invited: true,
        mitarbeiter_id: mitarbeiter_id,
      }
    });

    if (inviteError) {
      console.error('Invite email error:', inviteError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Einladungs-E-Mail konnte nicht gesendet werden: ${inviteError.message}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Invite email sent to:', email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Einladung an ${email} gesendet. Der Link läuft nach 24 Stunden ab.`,
      }),
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
