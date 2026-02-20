import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  type?: 'activation' | 'password_reset' | 'general';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    // Verify caller is authenticated
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Not authenticated');
    }
    const token = authHeader.slice('Bearer '.length).trim();

    // Allow service-role calls (from other edge functions) and admin users
    const isServiceRole = token === (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    if (!isServiceRole) {
      let callerId: string | null = null;
      try {
        const payloadBase64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const payloadJson = atob(payloadBase64);
        const payload = JSON.parse(payloadJson);
        callerId = payload.sub ?? null;
      } catch (_e) {
        throw new Error('Not authenticated');
      }
      if (!callerId) throw new Error('Not authenticated');

      const { data: isAdmin } = await supabaseAdmin.rpc('is_admin_or_higher', { _user_id: callerId });
      if (!isAdmin) {
        throw new Error('Not authorized - admin role required');
      }
    }

    const { to, subject, html }: EmailRequest = await req.json();

    if (!to || !subject || !html) {
      throw new Error('to, subject and html are required');
    }

    // Send via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Alltagshilfe Fischer <noreply@af-verwaltung.de>',
        to: [to],
        subject,
        html,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendData);
      throw new Error(`E-Mail konnte nicht gesendet werden: ${resendData?.message || resendResponse.statusText}`);
    }

    console.log('Email sent successfully');

    return new Response(
      JSON.stringify({ success: true, id: resendData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('send-email error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
