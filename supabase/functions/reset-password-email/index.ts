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
    const { email } = await req.json();
    if (!email) {
      throw new Error('E-Mail ist erforderlich');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const siteUrl = Deno.env.get('SITE_URL') || 'https://easy-assist-hub.lovable.app';

    if (!RESEND_API_KEY) {
      // Fallback to Supabase built-in email
      console.warn('RESEND_API_KEY not configured, using Supabase fallback');
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/?type=recovery`,
      });
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, provider: 'supabase' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Generate recovery link via admin API
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${siteUrl}/?type=recovery`,
      },
    });

    if (linkError) {
      // If user doesn't exist, don't reveal that — just return success silently
      console.log('generateLink result:', linkError.message);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const recoveryLink = linkData?.properties?.action_link;
    if (!recoveryLink) {
      console.warn('No recovery link generated');
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Send styled email via Resend
    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Alltagshilfe Fischer</h1>
          <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 14px;">Passwort zurücksetzen</p>
        </div>
        <div style="padding: 32px 24px;">
          <p style="font-size: 16px; color: #1e293b; margin: 0 0 16px;">Hallo,</p>
          <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 24px;">
            Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt. Klicken Sie auf den Button unten, um ein neues Passwort festzulegen:
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${recoveryLink}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(37,99,235,0.4);">
              Neues Passwort festlegen
            </a>
          </div>
          <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin: 24px 0 0;">
            Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.<br><br>
            Falls der Button nicht funktioniert, kopieren Sie diesen Link:<br>
            <a href="${recoveryLink}" style="color: #2563eb; word-break: break-all;">${recoveryLink}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
            Diese E-Mail wurde automatisch versendet. Bitte antworten Sie nicht auf diese Nachricht.
          </p>
        </div>
      </div>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Alltagshilfe Fischer <noreply@af-verwaltung.de>',
        to: [email],
        subject: 'Passwort zurücksetzen – Alltagshilfe Fischer',
        html: emailHtml,
      }),
    });

    const resendData = await resendResponse.json();
    if (!resendResponse.ok) {
      console.error('Resend error:', resendData);
      throw new Error(`E-Mail konnte nicht gesendet werden: ${resendData?.message || 'Unknown error'}`);
    }

    console.log('Password reset email sent successfully');

    return new Response(
      JSON.stringify({ success: true, provider: 'resend' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('reset-password-email error:', error);
    // Always return success to not reveal user existence
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
