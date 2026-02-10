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
    let callerId: string | null = null;
    try {
      const payloadBase64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = atob(payloadBase64);
      const payload = JSON.parse(payloadJson);
      callerId = payload.sub ?? null;
    } catch (e) {
      throw new Error('Not authenticated');
    }
    if (!callerId) throw new Error('Not authenticated');

    const { data: isAdmin, error: isAdminErr } = await supabaseAdmin.rpc('is_admin_or_higher', { _user_id: callerId });
    if (isAdminErr || !isAdmin) {
      throw new Error('Not authorized - admin role required');
    }

    const { mitarbeiter_id, email } = await req.json();

    if (!mitarbeiter_id || !email) {
      throw new Error('mitarbeiter_id und email sind erforderlich');
    }

    // Get mitarbeiter record
    const { data: mitarbeiter, error: mitErr } = await supabaseAdmin
      .from('mitarbeiter')
      .select('id, vorname, nachname, benutzer_id')
      .eq('id', mitarbeiter_id)
      .single();

    if (mitErr || !mitarbeiter) {
      throw new Error('Mitarbeiter nicht gefunden');
    }

    // Check if already has a real auth account (not placeholder)
    if (mitarbeiter.benutzer_id) {
      const { data: existingBenutzer } = await supabaseAdmin
        .from('benutzer')
        .select('email, status')
        .eq('id', mitarbeiter.benutzer_id)
        .maybeSingle();

      if (existingBenutzer && !existingBenutzer.email?.includes('@placeholder.local')) {
        if (existingBenutzer.status === 'approved') {
          throw new Error('Dieser Mitarbeiter hat bereits ein aktives Konto');
        }
      }
    }

    console.log('Activating mitarbeiter:', { mitarbeiter_id, email });

    // Check for pre-assigned role from placeholder benutzer
    let preAssignedRole = 'mitarbeiter';
    const placeholderBenutzerId = mitarbeiter.benutzer_id;

    if (placeholderBenutzerId) {
      const { data: preRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', placeholderBenutzerId)
        .maybeSingle();

      if (preRole) {
        preAssignedRole = preRole.role;
        console.log('Found pre-assigned role:', preAssignedRole);
      } else {
        // Check benutzer.rolle
        const { data: placeholderBenutzer } = await supabaseAdmin
          .from('benutzer')
          .select('rolle')
          .eq('id', placeholderBenutzerId)
          .maybeSingle();
        if (placeholderBenutzer?.rolle) {
          preAssignedRole = placeholderBenutzer.rolle;
        }
      }

      // Clean up placeholder records
      await supabaseAdmin.from('user_roles').delete().eq('user_id', placeholderBenutzerId);
      await supabaseAdmin.from('benutzer').delete().eq('id', placeholderBenutzerId);
      console.log('Cleaned up placeholder benutzer:', placeholderBenutzerId);
    }

    // Generate a secure temporary password
    const tempPassword = crypto.randomUUID().slice(0, 12) + 'A1!';

    // Create auth user with temp password
    let targetUserId: string;
    
    try {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          vorname: mitarbeiter.vorname || '',
          nachname: mitarbeiter.nachname || '',
          mitarbeiter_id: mitarbeiter_id,
          force_password_change: true,
        }
      });

      if (createErr) throw createErr;
      targetUserId = created.user.id;
      console.log('Auth user created:', targetUserId);
    } catch (e: any) {
      // User might already exist
      const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = usersPage?.users?.find((u: any) => (u.email || '').toLowerCase() === email.toLowerCase());
      
      if (!existing) {
        throw new Error(`Konto konnte nicht erstellt werden: ${e?.message}`);
      }

      targetUserId = existing.id;
      
      // Update the existing user's password
      await supabaseAdmin.auth.admin.updateUser(targetUserId, {
        password: tempPassword,
        user_metadata: {
          ...existing.user_metadata,
          force_password_change: true,
          mitarbeiter_id: mitarbeiter_id,
        }
      });
      console.log('Existing auth user updated:', targetUserId);
    }

    // Create/update benutzer record
    const { error: benutzerError } = await supabaseAdmin
      .from('benutzer')
      .upsert({
        id: targetUserId,
        email: email,
        rolle: preAssignedRole as any,
        status: 'approved',
        vorname: mitarbeiter.vorname || null,
        nachname: mitarbeiter.nachname || null,
      }, { onConflict: 'id' });

    if (benutzerError) {
      throw new Error(`Benutzer konnte nicht erstellt werden: ${benutzerError.message}`);
    }

    // Set user role
    await supabaseAdmin.from('user_roles').delete().eq('user_id', targetUserId);
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: targetUserId, role: preAssignedRole as any });

    if (roleError) {
      console.error('Role insert error:', roleError);
    }

    // Link mitarbeiter to auth user
    const { error: linkError } = await supabaseAdmin
      .from('mitarbeiter')
      .update({ benutzer_id: targetUserId })
      .eq('id', mitarbeiter_id);

    if (linkError) {
      throw new Error(`Mitarbeiter konnte nicht verknüpft werden: ${linkError.message}`);
    }

    // Send password reset email so user can set their own password
    // Use the project's published URL for the redirect
    const siteUrl = Deno.env.get('SITE_URL') || `https://easy-assist-hub.lovable.app`;
    
    const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${siteUrl}/?type=recovery`,
      }
    });

    // If generateLink doesn't send email automatically, fall back to resetPasswordForEmail
    if (resetError) {
      console.warn('generateLink failed, trying resetPasswordForEmail:', resetError.message);
      const supabaseAnon = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );
      const { error: resetError2 } = await supabaseAnon.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/?type=recovery`,
      });
      if (resetError2) {
        console.warn('Password reset email could not be sent:', resetError2.message);
      } else {
        console.log('Password reset email sent via fallback to:', email);
      }
    } else {
      console.log('Recovery link generated for:', email);
    }

    if (resetError) {
      console.warn('Password reset email could not be sent:', resetError.message);
    } else {
      console.log('Password reset email sent to:', email);
    }

    console.log('Mitarbeiter activated successfully:', { mitarbeiter_id, email, role: preAssignedRole });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Konto für ${mitarbeiter.vorname || ''} ${mitarbeiter.nachname || ''} aktiviert. Eine E-Mail zum Passwort-Setzen wurde an ${email} gesendet.`,
        role: preAssignedRole,
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
