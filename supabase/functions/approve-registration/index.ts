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
    const origin = req.headers.get('origin') || Deno.env.get('SITE_URL') || 'https://easy-assist-hub.lovable.app'

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

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      registration.email,
      {
        data: { vorname: registration.vorname, nachname: registration.nachname },
        redirectTo: `${origin}/auth?type=invite`
      }
    )

    if (inviteError) {
      const code = (inviteError as any)?.code || (inviteError as any)?.status
      if (code === 'email_exists' || code === 422) {
        alreadyExists = true
        console.log('User already exists, sending password reset email via Supabase')

        // Use Supabase's built-in password reset email
        const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
          registration.email,
          {
            redirectTo: `${origin}/auth?type=recovery`
          }
        )

        if (resetError) {
          console.error('Error sending password reset email:', resetError)
          throw new Error('Fehler beim Versenden der Passwort-Reset-E-Mail')
        }

        console.log('Password reset email sent via Supabase')
      } else {
        console.error('Error inviting user:', inviteError)
        throw inviteError
      }
    } else {
      console.log('Invite sent for user:', inviteData?.user?.id)
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
