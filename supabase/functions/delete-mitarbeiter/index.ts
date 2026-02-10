import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check if user is admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: canDelete } = await supabaseAdmin
      .rpc('can_delete', { _user_id: user.id })

    if (!canDelete) {
      return new Response(JSON.stringify({ error: 'Not authorized - only Geschäftsführer can delete' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { mitarbeiterId } = await req.json()

    if (!mitarbeiterId) {
      return new Response(JSON.stringify({ error: 'mitarbeiterId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get the mitarbeiter to find benutzer_id
    const { data: mitarbeiter, error: mitarbeiterError } = await supabaseAdmin
      .from('mitarbeiter')
      .select('benutzer_id')
      .eq('id', mitarbeiterId)
      .single()

    if (mitarbeiterError || !mitarbeiter) {
      return new Response(JSON.stringify({ error: 'Mitarbeiter not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const benutzerId = mitarbeiter.benutzer_id

    // Delete all termin_aenderungen related to this mitarbeiter
    await supabaseAdmin
      .from('termin_aenderungen')
      .delete()
      .or(`old_mitarbeiter_id.eq.${mitarbeiterId},new_mitarbeiter_id.eq.${mitarbeiterId}`)

    // Delete all termine for this mitarbeiter
    await supabaseAdmin
      .from('termine')
      .delete()
      .eq('mitarbeiter_id', mitarbeiterId)

    // Delete mitarbeiter_verfuegbarkeit
    await supabaseAdmin
      .from('mitarbeiter_verfuegbarkeit')
      .delete()
      .eq('mitarbeiter_id', mitarbeiterId)

    // Delete mitarbeiter_abwesenheiten
    await supabaseAdmin
      .from('mitarbeiter_abwesenheiten')
      .delete()
      .eq('mitarbeiter_id', mitarbeiterId)

    // Delete from mitarbeiter table
    const { error: deleteMitarbeiterError } = await supabaseAdmin
      .from('mitarbeiter')
      .delete()
      .eq('id', mitarbeiterId)

    if (deleteMitarbeiterError) {
      return new Response(JSON.stringify({ error: deleteMitarbeiterError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Delete from benutzer table if benutzer_id exists
    if (benutzerId) {
      await supabaseAdmin
        .from('benutzer')
        .delete()
        .eq('id', benutzerId)

      // Delete auth user
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(benutzerId)
      if (deleteAuthError) {
        console.error('Error deleting auth user:', deleteAuthError)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
