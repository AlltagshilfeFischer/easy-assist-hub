import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { requireAdmin, unauthorizedResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await requireAdmin(req);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    const siteUrl = Deno.env.get('SITE_URL') || 'https://portal.alltagshilfe-fischer.de';
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const displayName = [
      vorname || registration.vorname,
      nachname || registration.nachname,
    ].filter(Boolean).join(' ') || 'Mitarbeiter/in';

    // Bestehende selbst-registrierte User: E-Mail-Bestätigung nachholen, damit Login direkt klappt
    if (!createdNewUser && !emailConfirmed) {
      await supabaseAdmin.auth.admin.updateUserById(targetUserId!, { email_confirm: true });
    }

    let emailSubject: string;
    let emailHtml: string;
    let emailSent = false;

    if (createdNewUser) {
      // Neu angelegter User: Recovery-Link generieren, damit Passwort gesetzt werden kann
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${siteUrl}/?type=recovery` },
      });
      if (linkErr) console.warn('Could not generate recovery link:', linkErr.message);
      const actionLink = linkData?.properties?.action_link || siteUrl;

      emailSubject = 'Ihr Zugang zum Alltagshilfe Fischer Portal wurde genehmigt';
      emailHtml = `
        <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
          <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px 24px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">Alltagshilfe Fischer</h1>
            <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">Ihr Zugang wurde genehmigt</p>
          </div>
          <div style="padding:32px 24px;">
            <p style="font-size:16px;color:#1e293b;margin:0 0 16px;">Hallo ${displayName},</p>
            <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 24px;">
              Ihre Registrierung wurde genehmigt. Bitte klicken Sie auf den folgenden Button, um Ihr persönliches Passwort festzulegen und auf das Portal zuzugreifen:
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${actionLink}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;box-shadow:0 4px 12px rgba(37,99,235,0.4);">
                Passwort festlegen &amp; Anmelden
              </a>
            </div>
            <p style="font-size:13px;color:#94a3b8;line-height:1.5;margin:24px 0 0;">
              Falls der Button nicht funktioniert, kopieren Sie diesen Link:<br>
              <a href="${actionLink}" style="color:#2563eb;word-break:break-all;">${actionLink}</a>
            </p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0;">
              Diese E-Mail wurde automatisch versendet. Bitte antworten Sie nicht auf diese Nachricht.
            </p>
          </div>
        </div>
      `;
    } else {
      // Bestehender selbst-registrierter User: nur Freischaltungs-Benachrichtigung
      emailSubject = 'Ihr Konto wurde freigeschaltet – Alltagshilfe Fischer';
      emailHtml = `
        <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
          <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px 24px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">Alltagshilfe Fischer</h1>
            <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">Ihr Konto wurde freigeschaltet</p>
          </div>
          <div style="padding:32px 24px;">
            <p style="font-size:16px;color:#1e293b;margin:0 0 16px;">Hallo ${displayName},</p>
            <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 24px;">
              Ihr Konto bei Alltagshilfe Fischer wurde genehmigt. Sie können sich ab sofort mit Ihren bisherigen Zugangsdaten anmelden:
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${siteUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;box-shadow:0 4px 12px rgba(37,99,235,0.4);">
                Zum Portal
              </a>
            </div>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
            <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0;">
              Diese E-Mail wurde automatisch versendet. Bitte antworten Sie nicht auf diese Nachricht.
            </p>
          </div>
        </div>
      `;
    }

    if (RESEND_API_KEY) {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Alltagshilfe Fischer <noreply@af-verwaltung.de>',
            to: [email],
            subject: emailSubject,
            html: emailHtml,
          }),
        });
        const resendData = await resendRes.json();
        if (!resendRes.ok) {
          console.warn('Resend error in approve-benutzer:', resendData);
        } else {
          emailSent = true;
          console.log('Approval email sent via Resend');
        }
      } catch (emailErr) {
        console.warn('Failed to send approval email:', emailErr);
      }
    } else {
      console.warn('RESEND_API_KEY not configured — no approval email sent');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: createdNewUser
          ? `Benutzer genehmigt. ${emailSent ? 'Einladungs-E-Mail wurde gesendet.' : 'E-Mail konnte nicht gesendet werden (RESEND_API_KEY fehlt).'}`
          : `Benutzer freigeschaltet. ${emailSent ? 'Benachrichtigungs-E-Mail wurde gesendet.' : 'E-Mail konnte nicht gesendet werden (RESEND_API_KEY fehlt).'}`,
        role: finalRole,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error:', error);
    const status = (error as any)?.status;
    if (status === 401 || status === 403) return unauthorizedResponse((error as Error).message, status);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
