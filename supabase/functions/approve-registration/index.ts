import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { registration_id, email } = await req.json()
    const origin = Deno.env.get('SITE_URL') || req.headers.get('origin') || 'https://portal.alltagshilfe-fischer.de'

    console.log('Approving registration:', { registration_id })

    // Check if user is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header')
      throw new Error('Not authenticated')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      console.error('Error getting user:', userError)
      throw new Error('Not authenticated')
    }

    console.log('User authenticated:', user.id)

    // Create a user-scoped client using the end-user JWT for RLS checks
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        }
      }
    )

    // Check admin via SECURITY DEFINER function to avoid direct table access
    const { data: isAdmin, error: isAdminError } = await supabaseUser.rpc('is_admin', { user_id: user.id })

    if (isAdminError) {
      console.error('Error checking admin role via RPC:', isAdminError)
      throw new Error('Not authorized')
    }

    if (!isAdmin) {
      console.log('User is not admin:', { user_id: user.id })
      throw new Error('Not authorized')
    }

    // Get registration details using Security Definer function to bypass RLS
    const { data: registrationData, error: regError } = await supabaseAdmin
      .rpc('get_pending_registration', { p_registration_id: registration_id })

    if (regError) {
      console.error('Error fetching registration:', regError)
      throw new Error('Registration not found')
    }

    if (!registrationData || registrationData.length === 0) {
      console.error('Registration not found for id:', registration_id)
      throw new Error('Registration not found')
    }

    const registration = registrationData[0]

    // Send invite; if user already exists, send a password reset email instead
    let alreadyExists = false
    let userId: string | null = null

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      registration.email,
      {
        data: { vorname: registration.vorname, nachname: registration.nachname },
        redirectTo: `${origin}/auth?type=invite`
      }
    )

    if (inviteError) {
      // Be robust: treat any error as potential "user already exists"
      const code = (inviteError as any)?.code || (inviteError as any)?.status || (inviteError as any)?.name
      console.warn('Invite error encountered, checking if user already exists:', inviteError)

      // Try to find existing user by email (covers 500 unexpected_failure cases)
      const { data: existingUser, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (listErr) {
        console.error('Error listing users:', listErr)
      }
      const foundUser = existingUser?.users?.find(u => (u.email || '').toLowerCase() === (registration.email || '').toLowerCase())

      if (foundUser || code === 'email_exists' || code === 422) {
        alreadyExists = true
        userId = foundUser?.id || null
        console.log('User already exists, sending password reset email via Supabase', { userId })

        const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
          registration.email,
          { redirectTo: `${origin}/auth?type=recovery` }
        )
        if (resetError) {
          console.error('Error sending password reset email:', resetError)
          throw new Error('Fehler beim Versenden der Passwort-Reset-E-Mail')
        }
        console.log('Password reset email sent via Supabase')
      } else {
        console.error('Error inviting user (not an existing user case):', inviteError)
        // Fallback: create user directly and send reset email
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: registration.email,
          email_confirm: false
        })
        if (createErr) {
          console.error('Fallback createUser failed:', createErr)
          throw new Error('Benutzer konnte nicht angelegt werden: ' + (createErr as any)?.message || 'Unbekannter Fehler')
        }
        userId = created?.user?.id || null
        console.log('User created via fallback:', userId)
        const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
          registration.email,
          { redirectTo: `${origin}/auth?type=recovery` }
        )
        if (resetError) {
          console.error('Error sending password reset after fallback create:', resetError)
          throw new Error('Fehler beim Versenden der Passwort-Reset-E-Mail')
        }
      }
    } else {
      userId = inviteData?.user?.id || null
      console.log('Invite sent for user:', userId)
    }

    // Create benutzer and mitarbeiter entries if user was created
    if (userId && !alreadyExists) {
      console.log('Creating benutzer and mitarbeiter entries for:', userId)

      // Create benutzer entry
      const { error: benutzerInsertError } = await supabaseAdmin
        .from('benutzer')
        .insert({
          id: userId,
          email: registration.email,
          vorname: registration.vorname || null,
          nachname: registration.nachname || null,
          rolle: 'mitarbeiter',
        })

      if (benutzerInsertError) {
        console.error('Error creating benutzer:', benutzerInsertError)
        // Rollback: delete auth user
        await supabaseAdmin.auth.admin.deleteUser(userId)
        throw new Error(`Fehler beim Erstellen des Benutzer-Eintrags: ${benutzerInsertError.message}`)
      }

      console.log('Benutzer entry created')

      // Create mitarbeiter entry
      const { error: mitarbeiterInsertError } = await supabaseAdmin
        .from('mitarbeiter')
        .insert({
          benutzer_id: userId,
          email: registration.email,
          ist_aktiv: true,
          farbe_kalender: '#3B82F6',
        })

      if (mitarbeiterInsertError) {
        console.error('Error creating mitarbeiter:', mitarbeiterInsertError)
        // Rollback: delete benutzer and auth user
        await supabaseAdmin.from('benutzer').delete().eq('id', userId)
        await supabaseAdmin.auth.admin.deleteUser(userId)
        throw new Error(`Fehler beim Erstellen des Mitarbeiter-Eintrags: ${mitarbeiterInsertError.message}`)
      }

      console.log('Mitarbeiter entry created')
    }

    // Update pending registration status using Security Definer function
    const { error: updateError } = await supabaseAdmin
      .rpc('update_registration_status', { 
        p_registration_id: registration_id,
        p_reviewer_id: user.id
      })

    if (updateError) {
      console.error('Error updating registration:', updateError)
      throw updateError
    }

    console.log('Registration approved successfully')

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: alreadyExists 
          ? 'Registrierung genehmigt. Passwort-Reset-E-Mail wurde versendet.'
          : 'Registrierung genehmigt. Einladungs-E-Mail wurde versendet.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('Error approving registration:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
