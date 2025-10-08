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

    const { registration_id, reason } = await req.json()

    console.log('Rejecting registration:', { registration_id, reason })

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

    // Get registration details for email
    const { data: registration, error: regError } = await supabaseAdmin
      .from('pending_registrations')
      .select('email, vorname, nachname')
      .eq('id', registration_id)
      .single()

    if (regError || !registration) {
      throw new Error('Registration not found')
    }

    // Update pending registration status
    const { error: updateError } = await supabaseAdmin
      .from('pending_registrations')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', registration_id)

    if (updateError) {
      console.error('Error updating registration:', updateError)
      throw updateError
    }

    console.log('Registration rejected successfully')

    // Send rejection email
    try {
      await resend.emails.send({
        from: 'KIT Dienstleistungen <onboarding@resend.dev>',
        to: [registration.email],
        subject: 'Deine Registrierung bei KIT Dienstleistungen',
        html: `
          <h1>Hallo ${registration.vorname} ${registration.nachname},</h1>
          <p>Leider können wir deine Registrierung derzeit nicht genehmigen.</p>
          ${reason ? `<p><strong>Grund:</strong> ${reason}</p>` : ''}
          <p>Bei Fragen kannst du dich gerne an uns wenden.</p>
          <p>Viele Grüße,<br>Dein KIT Team</p>
        `,
      })
      console.log('Rejection email sent successfully')
    } catch (emailError) {
      console.error('Error sending rejection email:', emailError)
      // Don't fail the rejection if email fails
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Registration rejected' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('Error rejecting registration:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
