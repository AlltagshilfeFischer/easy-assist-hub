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
    // Decode JWT payload (JWT already verified by Edge Runtime when verify_jwt=true)
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
    const { registration_id, email, vorname, nachname } = await req.json();

    if (!registration_id || !email) {
      throw new Error('registration_id and email are required');
    }

    console.log('Approving registration:', { registration_id, email });

    // Get registration details directly with admin client (bypasses RLS)
    const { data: registration, error: regErr } = await supabaseAdmin
      .from('pending_registrations')
      .select('*')
      .eq('id', registration_id)
      .eq('status', 'pending')
      .maybeSingle();

    if (regErr) {
      console.error('Registration lookup error:', regErr);
      throw new Error(`Registration lookup failed: ${regErr.message}`);
    }

    if (!registration) {
      throw new Error('Registration not found or already processed');
    }

    // Create or link auth user (handle existing accounts)
    const tempPassword = crypto.randomUUID();
    let targetUserId: string | null = null;
    let createdNewUser = false;
    let emailConfirmed = false;

    try {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          vorname: vorname || registration.vorname || '',
          nachname: nachname || registration.nachname || '',
        }
      });

      if (createErr) throw createErr;

      targetUserId = created.user.id;
      createdNewUser = true;
      emailConfirmed = !!created.user.email_confirmed_at;
      console.log('Auth user created:', targetUserId);
    } catch (e: any) {
      const code = e?.code || e?.status || e?.name;
      console.warn('Create user failed, attempting to link existing user. Code:', code, 'Message:', e?.message);

      // Try to find existing user by email
      const { data: usersPage, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) {
        console.error('List users error:', listErr);
        throw new Error(`Failed to list users: ${listErr.message}`);
      }

      const existing = usersPage?.users?.find((u: any) => (u.email || '').toLowerCase() === email.toLowerCase());
      if (!existing) {
        console.error('No existing user found for email after createUser failed.');
        throw new Error(`Failed to create auth user: ${e?.message || 'unknown error'}`);
      }

      targetUserId = existing.id;
      createdNewUser = false;
      emailConfirmed = !!existing.email_confirmed_at;
      console.log('Using existing auth user:', targetUserId);
    }

    // Upsert into benutzer table
    const { error: benutzerError } = await supabaseAdmin
      .from('benutzer')
      .upsert({
        id: targetUserId!,
        email: email,
        rolle: 'mitarbeiter',
        status: 'approved',
        vorname: vorname || registration.vorname || null,
        nachname: nachname || registration.nachname || null
      }, { onConflict: 'id' });

    if (benutzerError) {
      console.error('Benutzer upsert error:', benutzerError);
      throw new Error(`Failed to upsert benutzer: ${benutzerError.message}`);
    }

    // Upsert into mitarbeiter table
    const { error: mitarbeiterError } = await supabaseAdmin
      .from('mitarbeiter')
      .upsert({
        benutzer_id: targetUserId!,
        vorname: vorname || registration.vorname || null,
        nachname: nachname || registration.nachname || null,
        ist_aktiv: true
      }, { onConflict: 'benutzer_id' });

    if (mitarbeiterError) {
      console.error('Mitarbeiter upsert error:', mitarbeiterError);
      throw new Error(`Failed to upsert mitarbeiter: ${mitarbeiterError.message}`);
    }

    // Update registration status to approved
    const { error: updateError } = await supabaseAdmin
      .from('pending_registrations')
      .update({
        status: 'approved',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', registration_id);

    if (updateError) {
      console.error('Registration update error:', updateError);
    }

    console.log('Registration approved successfully');

    // Send appropriate email link
    const linkType = createdNewUser ? 'invite' : (emailConfirmed ? 'recovery' : 'invite');
    await supabaseAdmin.auth.admin.generateLink({ type: linkType as any, email });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: createdNewUser
          ? 'Benutzer approved. Invite email gesendet.'
          : (emailConfirmed ? 'Benutzer verknüpft. Passwort-Reset-Mail gesendet.' : 'Benutzer verknüpft. Invite-Mail gesendet.')
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
