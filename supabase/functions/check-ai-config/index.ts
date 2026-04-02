import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const apiKey = req.headers.get('x-openai-key') || Deno.env.get('OPENAI_API_KEY');

  if (!apiKey) {
    return new Response(
      JSON.stringify({ valid: false, error: 'OPENAI_API_KEY nicht konfiguriert' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (response.ok) {
      return new Response(
        JSON.stringify({ valid: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    const body = await response.json().catch(() => ({}));
    const message = (body as { error?: { message?: string } }).error?.message ?? 'Ungültiger API-Key';
    return new Response(
      JSON.stringify({ valid: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch {
    return new Response(
      JSON.stringify({ valid: false, error: 'Netzwerkfehler beim Prüfen des API-Keys' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  }
});
