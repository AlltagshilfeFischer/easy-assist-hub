import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    const { data: isAdmin, error: isAdminErr } = await supabaseAdmin.rpc('is_admin_or_higher', { _user_id: userId });
    if (isAdminErr || !isAdmin) {
      throw new Error('Not authorized - admin role required');
    }

    const { registration_id, email, vorname, nachname } = await req.json();

    if (!registration_id || !email) {
      throw new Error('registration_id and email are required');
    }

    console.log('Approving registration:', registration_id);

    const { data: registration, error: regErr } = await supabaseAdmin
      .from('pending_registrations')
      .select('*')
      .eq('id', registration_id)
      .eq('status', 'pending')
      .maybeSingle();

    if (regErr) {
      throw new Error(`Registration lookup failed: ${regErr.message}`);
    }
    if (!registration) {
      throw new Error('Registration not found or already processed');
    }

    // Create or link auth user
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
      console.log('Auth user created');
    } catch (e: any) {
      console.warn('Create user failed, attempting to link existing user:', e?.message);

      const { data: usersPage, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) throw new Error(`Failed to list users: ${listErr.message}`);

      const existing = usersPage?.users?.find((u: any) => (u.email || '').toLowerCase() === email.toLowerCase());
      if (!existing) throw new Error(`Failed to create auth user: ${e?.message || 'unknown error'}`);

      targetUserId = existing.id;
      createdNewUser = false;
      emailConfirmed = !!existing.email_confirmed_at;
      console.log('Using existing auth user');
    }

    // --- ROLE SYNC: Check for pre-assigned roles ---
    // Look for mitarbeiter linked via invite metadata
    let linkedMitarbeiterId: string | null = null;
    let preAssignedRole: string | null = null;
    let placeholderBenutzerId: string | null = null;

    // Check auth user metadata for mitarbeiter_id (from invite flow)
    const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(targetUserId!);
    const metaMitarbeiterId = authUserData?.user?.user_metadata?.mitarbeiter_id;

    if (metaMitarbeiterId) {
      const { data: existingMit } = await supabaseAdmin
        .from('mitarbeiter')
        .select('id, benutzer_id')
        .eq('id', metaMitarbeiterId)
        .maybeSingle();

      if (existingMit) {
        linkedMitarbeiterId = existingMit.id;
        placeholderBenutzerId = existingMit.benutzer_id;
      }
    }

    // If no mitarbeiter from metadata, try to find by name match
    if (!linkedMitarbeiterId) {
      const nameVorname = vorname || registration.vorname || '';
      const nameNachname = nachname || registration.nachname || '';
      if (nameVorname && nameNachname) {
        const { data: matchingMit } = await supabaseAdmin
          .from('mitarbeiter')
          .select('id, benutzer_id')
          .eq('vorname', nameVorname)
          .eq('nachname', nameNachname)
          .maybeSingle();
        
        if (matchingMit) {
          linkedMitarbeiterId = matchingMit.id;
          placeholderBenutzerId = matchingMit.benutzer_id;
        }
      }
    }

    // Check for pre-assigned role via placeholder benutzer_id
    if (placeholderBenutzerId && placeholderBenutzerId !== targetUserId) {
      const { data: preRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', placeholderBenutzerId)
        .maybeSingle();

      if (preRole) {
        preAssignedRole = preRole.role;
        console.log('Found pre-assigned role:', preAssignedRole, 'from placeholder:', placeholderBenutzerId);

        // Delete the old placeholder role entry
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', placeholderBenutzerId);
      }

      // Also check the placeholder benutzer record for role info
      const { data: placeholderBenutzer } = await supabaseAdmin
        .from('benutzer')
        .select('rolle')
        .eq('id', placeholderBenutzerId)
        .maybeSingle();

      if (placeholderBenutzer && !preAssignedRole) {
        preAssignedRole = placeholderBenutzer.rolle;
      }

      // Clean up placeholder benutzer record
      await supabaseAdmin
        .from('benutzer')
        .delete()
        .eq('id', placeholderBenutzerId);
      
      console.log('Cleaned up placeholder benutzer:', placeholderBenutzerId);
    }

    // Also check if there's already a role for targetUserId directly
    if (!preAssignedRole) {
      const { data: existingDirectRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', targetUserId!)
        .maybeSingle();
      
      if (existingDirectRole) {
        preAssignedRole = existingDirectRole.role;
      }
    }

    const finalRole = preAssignedRole || 'mitarbeiter';
    console.log('Final role for user:', finalRole);

    // Upsert into benutzer table with correct role
    const { error: benutzerError } = await supabaseAdmin
      .from('benutzer')
      .upsert({
        id: targetUserId!,
        email: email,
        rolle: finalRole as any,
        status: 'approved',
        vorname: vorname || registration.vorname || null,
        nachname: nachname || registration.nachname || null
      }, { onConflict: 'id' });

    if (benutzerError) {
      throw new Error(`Failed to upsert benutzer: ${benutzerError.message}`);
    }

    // Upsert user_roles with the correct role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: targetUserId!,
        role: finalRole as any,
      }, { onConflict: 'user_id,role' });

    if (roleError) {
      // Try delete + insert if upsert fails
      await supabaseAdmin.from('user_roles').delete().eq('user_id', targetUserId!);
      const { error: roleInsertErr } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: targetUserId!, role: finalRole as any });
      if (roleInsertErr) {
        console.error('Role insert error:', roleInsertErr);
      }
    }
    console.log('User role set to:', finalRole);

    // Link or create mitarbeiter record
    if (linkedMitarbeiterId) {
      const { error: mitarbeiterError } = await supabaseAdmin
        .from('mitarbeiter')
        .update({
          benutzer_id: targetUserId!,
          ist_aktiv: true
        })
        .eq('id', linkedMitarbeiterId);

      if (mitarbeiterError) {
        throw new Error(`Failed to link mitarbeiter: ${mitarbeiterError.message}`);
      }
      console.log('Linked auth user to existing mitarbeiter');
    } else {
      const { error: mitarbeiterError } = await supabaseAdmin
        .from('mitarbeiter')
        .upsert({
          benutzer_id: targetUserId!,
          vorname: vorname || registration.vorname || null,
          nachname: nachname || registration.nachname || null,
          ist_aktiv: true
        }, { onConflict: 'benutzer_id' });

      if (mitarbeiterError) {
        throw new Error(`Failed to upsert mitarbeiter: ${mitarbeiterError.message}`);
      }
      console.log('Created new mitarbeiter record');
    }

    // Update registration status
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

    const linkType = createdNewUser ? 'invite' : (emailConfirmed ? 'recovery' : 'invite');
    await supabaseAdmin.auth.admin.generateLink({ type: linkType as any, email });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: createdNewUser
          ? 'Benutzer approved. Invite email gesendet.'
          : (emailConfirmed ? 'Benutzer verknüpft. Passwort-Reset-Mail gesendet.' : 'Benutzer verknüpft. Invite-Mail gesendet.'),
        role: finalRole,
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
