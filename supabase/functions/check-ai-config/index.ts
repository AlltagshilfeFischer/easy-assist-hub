import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { requireAdmin, unauthorizedResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type CheckResult =
  | { valid: true }
  | { valid: false; reason: 'missing_key' | 'invalid_key' | 'network_error'; error: string };

function json(body: CheckResult, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    await requireAdmin(req);
  } catch (err) {
    const status = (err as any)?.status ?? 401;
    return unauthorizedResponse((err as Error).message, status);
  }

  const apiKey = req.headers.get('x-openai-key') || Deno.env.get('OPENAI_API_KEY');

  if (!apiKey) {
    return json({ valid: false, reason: 'missing_key', error: 'OPENAI_API_KEY nicht konfiguriert' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (response.ok) {
      return json({ valid: true });
    }

    const body = await response.json().catch(() => ({}));
    const message = (body as { error?: { message?: string } }).error?.message ?? 'Ungültiger API-Key';
    return json({ valid: false, reason: 'invalid_key', error: message });
  } catch {
    return json({ valid: false, reason: 'network_error', error: 'Netzwerkfehler beim Prüfen des API-Keys' });
  }
});
