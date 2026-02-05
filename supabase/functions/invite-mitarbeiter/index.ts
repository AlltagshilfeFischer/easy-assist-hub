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

    // Verify admin role using verified JWT
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
      console.error('JWT decode failed:', e);
      throw new Error('Not authenticated');
    }
    if (!userId) {
      throw new Error('Not authenticated');
    }

    // Check admin role (use is_admin_or_higher for geschaeftsfuehrer + admin)
    const { data: isAdmin, error: isAdminErr } = await supabaseAdmin.rpc('is_admin_or_higher', { _user_id: userId });
    if (isAdminErr || !isAdmin) {
      console.error('Admin role check failed:', isAdminErr);
      throw new Error('Not authorized - admin role required');
    }

    // Get request body
    const { email, vorname, nachname } = await req.json();

    if (!email) {
      throw new Error('E-Mail-Adresse ist erforderlich');
    }

    console.log('Creating pending registration for:', { email, vorname, nachname });

    // Check if already exists in pending_registrations
    const { data: existingPending } = await supabaseAdmin
      .from('pending_registrations')
      .select('id, status')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingPending) {
      if (existingPending.status === 'pending') {
        throw new Error('Diese E-Mail-Adresse hat bereits eine ausstehende Registrierungsanfrage');
      }
      // If rejected, allow re-invite by updating the existing record
    }

    // Check if user already exists as approved benutzer
    const { data: existingBenutzer } = await supabaseAdmin
      .from('benutzer')
      .select('id, status')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingBenutzer && existingBenutzer.status === 'approved') {
      throw new Error('Diese E-Mail-Adresse ist bereits als Benutzer registriert');
    }

    // Create or update pending registration entry
    // This creates the entry in the "pending" section for admin approval
    const { error: pendingError } = await supabaseAdmin
      .from('pending_registrations')
      .upsert({
        email: email.toLowerCase(),
        vorname: vorname || null,
        nachname: nachname || null,
        status: 'pending',
        ignored: false,
        rejection_reason: null,
        reviewed_at: null,
        reviewed_by: null
      }, { onConflict: 'email' });

    if (pendingError) {
      console.error('Pending registration error:', pendingError);
      throw new Error(`Registrierungsanfrage konnte nicht erstellt werden: ${pendingError.message}`);
    }

    console.log('Pending registration created for:', email);

    // Send invite email so the user knows they were invited
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${Deno.env.get('SITE_URL') || 'https://easy-assist-hub.lovable.app'}/auth`,
      data: {
        vorname: vorname || '',
        nachname: nachname || '',
        invited: true
      }
    });

    if (inviteError) {
      console.error('Invite email error:', inviteError);
      // Still successful - pending registration was created
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Mitarbeiter wurde zur Genehmigungsliste hinzugefügt. Einladungs-E-Mail konnte nicht gesendet werden.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('Invite email sent successfully to:', email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Einladung gesendet! Der Mitarbeiter erscheint nach Registrierung in der Genehmigungsliste.',
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
