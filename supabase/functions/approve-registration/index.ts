import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'npm:resend@4.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)

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

    const { registration_id } = await req.json()

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

    const { data: benutzer, error: benutzerError } = await supabaseAdmin
      .from('benutzer')
      .select('rolle')
      .eq('id', user.id)
      .maybeSingle()

    if (benutzerError) {
      console.error('Error checking admin role:', benutzerError)
      throw new Error('Not authorized')
    }

    if (!benutzer || benutzer.rolle !== 'admin') {
      console.log('User is not admin:', { user_id: user.id, rolle: benutzer?.rolle })
      throw new Error('Not authorized')
    }

    // Get registration details
    const { data: registration, error: regError } = await supabaseAdmin
      .from('pending_registrations')
      .select('email, vorname, nachname')
      .eq('id', registration_id)
      .single()

    if (regError || !registration) {
      throw new Error('Registration not found')
    }

    // Send Supabase invite email so the user can set their password
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      registration.email,
      {
        data: { vorname: registration.vorname, nachname: registration.nachname }
        // redirectTo will use Supabase Auth Site URL; configure it in the dashboard
      }
    )

    if (inviteError) {
      console.error('Error inviting user:', inviteError)
      throw inviteError
    }

    console.log('Invite sent for user:', inviteData?.user?.id)

    // Update pending registration status
    const { error: updateError } = await supabaseAdmin
      .from('pending_registrations')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', registration_id)

    if (updateError) {
      console.error('Error updating registration:', updateError)
      throw updateError
    }

    console.log('Registration approved successfully')

    // Optional: send additional notification email via Resend (no password included)
    try {
      await resend.emails.send({
        from: 'KIT Dienstleistungen <onboarding@resend.dev>',
        to: [registration.email],
        subject: 'Deine Registrierung wurde genehmigt – Bitte Passwort setzen',
        html: `
          <h1>Hallo ${registration.vorname} ${registration.nachname},</h1>
          <p>deine Registrierung wurde genehmigt.</p>
          <p>Du erhältst gleich eine separate Einladung von unserem Auth-System, um dein Passwort festzulegen. Klicke dazu auf den Link in dieser E-Mail.</p>
          <p>Viele Grüße,<br>Dein KIT Team</p>
        `,
      })
      console.log('Notification email sent successfully')
    } catch (emailError) {
      console.error('Error sending notification email:', emailError)
      // Don't fail the approval if email fails
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Registration approved' }),
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
