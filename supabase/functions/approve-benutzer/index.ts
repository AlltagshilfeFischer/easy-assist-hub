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
    const { registration_id, email, vorname, nachname } = await req.json();

    if (!registration_id || !email) {
      throw new Error('registration_id and email are required');
    }

    console.log('Approving registration:', { registration_id, email });

    // Get registration details
    const { data: registration, error: registrationError } = await supabaseAdmin
      .from('pending_registrations')
      .select('*')
      .eq('id', registration_id)
      .eq('status', 'pending')
      .single();

    if (registrationError || !registration) {
      throw new Error('Registration not found or already processed');
    }

    // Generate a temporary password
    const tempPassword = crypto.randomUUID();

    // Create auth user with Admin API
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        vorname: vorname || registration.vorname || '',
        nachname: nachname || registration.nachname || '',
      }
    });

    if (authError) {
      console.error('Auth user creation error:', authError);
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    console.log('Auth user created:', authUser.user.id);

    // Insert into benutzer table
    const { error: benutzerError } = await supabaseAdmin
      .from('benutzer')
      .insert({
        id: authUser.user.id,
        email: email,
        rolle: 'mitarbeiter',
        status: 'approved',
        vorname: vorname || registration.vorname,
        nachname: nachname || registration.nachname
      });

    if (benutzerError) {
      console.error('Benutzer insert error:', benutzerError);
      // Cleanup: delete auth user if benutzer insert fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new Error(`Failed to create benutzer: ${benutzerError.message}`);
    }

    // Insert into mitarbeiter table
    const { error: mitarbeiterError } = await supabaseAdmin
      .from('mitarbeiter')
      .insert({
        benutzer_id: authUser.user.id,
        vorname: vorname || registration.vorname || null,
        nachname: nachname || registration.nachname || null,
        ist_aktiv: true
      });

    if (mitarbeiterError) {
      console.error('Mitarbeiter insert error:', mitarbeiterError);
      throw new Error(`Failed to create mitarbeiter: ${mitarbeiterError.message}`);
    }

    // Update registration status to approved
    const { error: updateError } = await supabaseAdmin
      .from('pending_registrations')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', registration_id);

    if (updateError) {
      console.error('Registration update error:', updateError);
    }

    console.log('Registration approved successfully');

    // Send password reset email
    await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: email,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Benutzer approved and activated. User will receive an invite email.' 
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
