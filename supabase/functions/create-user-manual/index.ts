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
    const callerId = await requireAdmin(req);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { email, password, vorname, nachname, rolle, employment_type } = await req.json();

    if (!email || !password) {
      throw new Error('E-Mail und Passwort sind erforderlich');
    }

    if (password.length < 6) {
      throw new Error('Passwort muss mindestens 6 Zeichen lang sein');
    }

    const validRoles = ['geschaeftsfuehrer', 'buchhaltung', 'mitarbeiter'];
    const finalRole = validRoles.includes(rolle) ? rolle : 'mitarbeiter';

    // Check role assignment permission: only GF can assign GF role
    if (finalRole === 'geschaeftsfuehrer') {
      const { data: isGF } = await supabaseAdmin.rpc('is_geschaeftsfuehrer', { _user_id: callerId });
      if (!isGF) {
        throw new Error('Nur Geschäftsführer können die Geschäftsführer-Rolle vergeben');
      }
    }

    console.log('Creating user manually for role:', finalRole);

    // 1. Check if auth user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    let userId: string;

    if (existingUser) {
      console.log('Auth user already exists, updating');
      userId = existingUser.id;
      // Update password and confirm email
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { vorname: vorname || '', nachname: nachname || '', force_password_change: true },
      });
    } else {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { vorname: vorname || '', nachname: nachname || '', force_password_change: true },
      });
      if (authError) {
        console.error('Auth create error:', authError);
        throw new Error(`Auth-Fehler: ${authError.message}`);
      }
      userId = authData.user.id;
    }
    console.log('Auth user ready');

    // 2. Upsert benutzer record (approved)
    const { error: benutzerError } = await supabaseAdmin
      .from('benutzer')
      .upsert({
        id: userId,
        email: email.toLowerCase(),
        vorname: vorname || null,
        nachname: nachname || null,
        rolle: finalRole,
        status: 'approved',
      }, { onConflict: 'id' });

    if (benutzerError) {
      console.error('Benutzer upsert error:', benutzerError);
      throw new Error(`Benutzer-Fehler: ${benutzerError.message}`);
    }

    // 3. Sync user_roles entry
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role: finalRole, granted_by: callerId });

    if (roleError) {
      console.error('Role insert error:', roleError);
    }

    // 4. Check if there's an existing mitarbeiter record to link, otherwise create one
    const { data: existingMitarbeiter } = await supabaseAdmin
      .from('mitarbeiter')
      .select('id')
      .eq('benutzer_id', userId)
      .maybeSingle();

    if (!existingMitarbeiter) {
      const { error: mitarbeiterError } = await supabaseAdmin
        .from('mitarbeiter')
        .insert({
          benutzer_id: userId,
          vorname: vorname || null,
          nachname: nachname || null,
          ist_aktiv: true,
          employment_type: employment_type || null,
        });

      if (mitarbeiterError) {
        console.error('Mitarbeiter insert error:', mitarbeiterError);
      }
    }

    // 5. Mark any pending registration as approved
    await supabaseAdmin
      .from('pending_registrations')
      .update({
        status: 'approved',
        reviewed_by: callerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('email', email.toLowerCase());

    return new Response(
      JSON.stringify({
        success: true,
        message: `Benutzer ${vorname || ''} ${nachname || ''} (${email}) wurde erfolgreich erstellt.`,
        userId,
      }),
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
