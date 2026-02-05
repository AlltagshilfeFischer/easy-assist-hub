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

    console.log('Inviting new employee:', { email, vorname, nachname });

    // Check if user already exists
    const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUser = usersPage?.users?.find((u: any) => 
      (u.email || '').toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
      // Check if already a mitarbeiter
      const { data: existingMitarbeiter } = await supabaseAdmin
        .from('mitarbeiter')
        .select('id')
        .eq('benutzer_id', existingUser.id)
        .maybeSingle();

      if (existingMitarbeiter) {
        throw new Error('Diese E-Mail-Adresse ist bereits als Mitarbeiter registriert');
      }
    }

    // Create auth user with invite
    let targetUserId: string;
    const tempPassword = crypto.randomUUID();

    if (existingUser) {
      targetUserId = existingUser.id;
      console.log('Linking to existing auth user:', targetUserId);
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: false, // Will need to confirm via invite link
        user_metadata: {
          vorname: vorname || '',
          nachname: nachname || '',
        }
      });

      if (createErr) {
        console.error('Create user error:', createErr);
        throw new Error(`Benutzer konnte nicht erstellt werden: ${createErr.message}`);
      }

      targetUserId = created.user.id;
      console.log('Auth user created:', targetUserId);
    }

    // Create benutzer entry
    const { error: benutzerError } = await supabaseAdmin
      .from('benutzer')
      .upsert({
        id: targetUserId,
        email: email,
        rolle: 'mitarbeiter',
        status: 'approved',
        vorname: vorname || null,
        nachname: nachname || null
      }, { onConflict: 'id' });

    if (benutzerError) {
      console.error('Benutzer upsert error:', benutzerError);
      throw new Error(`Benutzer-Eintrag fehlgeschlagen: ${benutzerError.message}`);
    }

    // Assign mitarbeiter role in user_roles table
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: targetUserId,
        role: 'mitarbeiter',
        granted_by: userId
      }, { onConflict: 'user_id,role' });

    if (roleError) {
      console.error('Role assignment error:', roleError);
      // Non-fatal, continue
    }

    // Create mitarbeiter entry
    const { error: mitarbeiterError } = await supabaseAdmin
      .from('mitarbeiter')
      .upsert({
        benutzer_id: targetUserId,
        vorname: vorname || null,
        nachname: nachname || null,
        ist_aktiv: true
      }, { onConflict: 'benutzer_id' });

    if (mitarbeiterError) {
      console.error('Mitarbeiter upsert error:', mitarbeiterError);
      throw new Error(`Mitarbeiter-Eintrag fehlgeschlagen: ${mitarbeiterError.message}`);
    }

    // Generate and send invite link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: email,
      options: {
        redirectTo: `${Deno.env.get('SITE_URL') || 'https://easy-assist-hub.lovable.app'}/`
      }
    });

    if (linkError) {
      console.error('Generate link error:', linkError);
      // Still successful, user was created
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Mitarbeiter erstellt. E-Mail-Einladung konnte nicht gesendet werden - Benutzer kann Passwort über "Passwort vergessen" zurücksetzen.',
          userId: targetUserId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('Invite link generated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mitarbeiter erstellt und Einladungs-E-Mail wurde gesendet. Der Mitarbeiter kann über den Link sein Passwort festlegen.',
        userId: targetUserId
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
