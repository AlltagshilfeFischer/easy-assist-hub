import { supabase } from '@/integrations/supabase/client';

const SETTINGS_KEY = 'app-settings';

function getStoredApiKey(): string {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { openAiApiKey?: string };
    return parsed.openAiApiKey ?? '';
  } catch {
    return '';
  }
}

/**
 * Ruft eine Supabase Edge Function auf und leitet den OpenAI API-Key
 * automatisch als x-openai-key Header weiter (sofern in den Settings hinterlegt).
 */
export async function invokeAiFunction(
  functionName: string,
  body: Record<string, unknown>,
) {
  const apiKey = getStoredApiKey();
  return supabase.functions.invoke(functionName, {
    body,
    headers: apiKey ? { 'x-openai-key': apiKey } : undefined,
  });
}

/**
 * Gibt HTTP-Header für direkte fetch()-Aufrufe zu Edge Functions zurück.
 * Fügt den OpenAI API-Key als x-openai-key Header hinzu, sofern vorhanden.
 */
export function getAiFetchHeaders(accessToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };
  const apiKey = getStoredApiKey();
  if (apiKey) headers['x-openai-key'] = apiKey;
  return headers;
}
