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
      return new Response(JSON.stringify({ error: 'Not authorized - only Geschäftsführer can deactivate' }), {
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
      .select('benutzer_id, ist_aktiv')
      .eq('id', mitarbeiterId)
      .single()

    if (mitarbeiterError || !mitarbeiter) {
      return new Response(JSON.stringify({ error: 'Mitarbeiter not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if this is a protected system account
    if (mitarbeiter.benutzer_id) {
      const { data: benutzer } = await supabaseAdmin
        .from('benutzer')
        .select('email')
        .eq('id', mitarbeiter.benutzer_id)
        .single()

      const protectedEmails = ['admin@af-verwaltung.de']
      if (benutzer && protectedEmails.includes(benutzer.email?.toLowerCase())) {
        return new Response(JSON.stringify({ error: 'Dieser System-Account ist geschützt und kann nicht deaktiviert werden.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Check if this is the last active GF
      const { data: isGF } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', mitarbeiter.benutzer_id)
        .eq('role', 'geschaeftsfuehrer')
        .maybeSingle()

      if (isGF) {
        const { data: activeGFs } = await supabaseAdmin
          .from('user_roles')
          .select('user_id, benutzer:user_id(status)')
          .eq('role', 'geschaeftsfuehrer')
          .neq('user_id', mitarbeiter.benutzer_id)

        const otherActiveGFs = (activeGFs || []).filter(
          (gf: any) => gf.benutzer?.status === 'approved'
        )

        if (otherActiveGFs.length === 0) {
          return new Response(JSON.stringify({ error: 'Der letzte aktive Geschäftsführer kann nicht deaktiviert werden.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    console.log('Deleting mitarbeiter:', mitarbeiterId, 'benutzer_id:', mitarbeiter.benutzer_id);

    // Delete related records first to avoid FK violations
    // Delete verfuegbarkeit
    await supabaseAdmin
      .from('mitarbeiter_verfuegbarkeit')
      .delete()
      .eq('mitarbeiter_id', mitarbeiterId)

    // Delete abwesenheiten
    await supabaseAdmin
      .from('mitarbeiter_abwesenheiten')
      .delete()
      .eq('mitarbeiter_id', mitarbeiterId)

    // Nullify rechnungspositionen references
    await supabaseAdmin
      .from('rechnungspositionen')
      .update({ mitarbeiter_id: null })
      .eq('mitarbeiter_id', mitarbeiterId)

    // Nullify dokumente references
    await supabaseAdmin
      .from('dokumente')
      .update({ mitarbeiter_id: null })
      .eq('mitarbeiter_id', mitarbeiterId)

    // Nullify termin_aenderungen references
    await supabaseAdmin
      .from('termin_aenderungen')
      .update({ new_mitarbeiter_id: null })
      .eq('new_mitarbeiter_id', mitarbeiterId)
    await supabaseAdmin
      .from('termin_aenderungen')
      .update({ old_mitarbeiter_id: null })
      .eq('old_mitarbeiter_id', mitarbeiterId)

    // Unassign from termine
    await supabaseAdmin
      .from('termine')
      .update({ mitarbeiter_id: null, status: 'unassigned' })
      .eq('mitarbeiter_id', mitarbeiterId)

    // Unassign from termin_vorlagen
    await supabaseAdmin
      .from('termin_vorlagen')
      .update({ mitarbeiter_id: null })
      .eq('mitarbeiter_id', mitarbeiterId)

    // Unassign from kunden
    await supabaseAdmin
      .from('kunden')
      .update({ mitarbeiter: null })
      .eq('mitarbeiter', mitarbeiterId)

    // Delete user_roles if benutzer exists
    if (mitarbeiter.benutzer_id) {
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', mitarbeiter.benutzer_id)
    }

    // Delete the mitarbeiter record
    const { error: deleteError } = await supabaseAdmin
      .from('mitarbeiter')
      .delete()
      .eq('id', mitarbeiterId)

    if (deleteError) {
      console.error('Delete mitarbeiter error:', deleteError);
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Delete the benutzer record if it exists
    if (mitarbeiter.benutzer_id) {
      await supabaseAdmin
        .from('benutzer')
        .delete()
        .eq('id', mitarbeiter.benutzer_id)

      // Also delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(mitarbeiter.benutzer_id)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
