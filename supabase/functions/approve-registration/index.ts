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

    const { registration_id, email, password } = await req.json()

    console.log('Approving registration:', { registration_id, email })

    // Check if user is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Not authenticated')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    
    if (!user) {
      throw new Error('Not authenticated')
    }

    const { data: benutzer, error: benutzerError } = await supabaseAdmin
      .from('benutzer')
      .select('rolle')
      .eq('id', user.id)
      .single()

    if (benutzerError || !benutzer || benutzer.rolle !== 'admin') {
      throw new Error('Not authorized')
    }

    // Get registration details
    const { data: registration, error: regError } = await supabaseAdmin
      .from('pending_registrations')
      .select('vorname, nachname')
      .eq('id', registration_id)
      .single()

    if (regError || !registration) {
      throw new Error('Registration not found')
    }

    // Create auth user with admin privileges
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      console.error('Error creating auth user:', authError)
      throw authError
    }

    console.log('Auth user created:', authData.user.id)

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

    // Send welcome email with credentials
    try {
      await resend.emails.send({
        from: 'KIT Dienstleistungen <onboarding@resend.dev>',
        to: [email],
        subject: 'Willkommen bei KIT Dienstleistungen - Dein Zugang wurde freigeschaltet',
        html: `
          <h1>Willkommen ${registration.vorname} ${registration.nachname}!</h1>
          <p>Deine Registrierung wurde genehmigt. Du kannst dich jetzt einloggen:</p>
          <p><strong>E-Mail:</strong> ${email}<br>
          <strong>Passwort:</strong> ${password}</p>
          <p>Bitte ändere dein Passwort nach dem ersten Login.</p>
          <p>Viele Grüße,<br>Dein KIT Team</p>
        `,
      })
      console.log('Welcome email sent successfully')
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError)
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
