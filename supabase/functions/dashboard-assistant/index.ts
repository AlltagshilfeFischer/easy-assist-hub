import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Du bist ein hilfreicher Assistent für ein Pflegedienst-Management-System namens "EasyAssist Hub".
Du kannst folgende Aktionen vorschlagen und durchführen:

1. **Termine erstellen**: Wenn der Benutzer einen Termin erstellen möchte, extrahiere die Details (Kunde, Datum, Uhrzeit, Mitarbeiter) und gib eine strukturierte Antwort.

2. **Mitarbeiter zuweisen**: Hilf bei der Zuweisung von Mitarbeitern zu Kunden oder Terminen.

3. **Berichte generieren**: Erkläre, welche Berichte verfügbar sind (Stundenübersichten, Kundenberichte, etc.).

4. **Stundenübersichten prüfen**: Gib Informationen zu Arbeitszeiten und Stundenkontingenten.

5. **Allgemeine Fragen**: Beantworte Fragen zum System und gib hilfreiche Tipps.

Antworte immer auf Deutsch, freundlich und präzise. Wenn du eine Aktion ausführen sollst, bestätige was du verstanden hast und frage bei Unklarheiten nach.

Bei Terminanfragen versuche folgende Informationen zu erfassen:
- Kundenname
- Wochentag(e) und Uhrzeit
- Dauer (Standard: 90 Minuten)
- Mitarbeiter (optional)
- Ob es ein wiederkehrender Termin sein soll

Formatiere deine Antworten übersichtlich mit Aufzählungen und kurzen Absätzen.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth check: require authenticated user with employee role or higher ──
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    const { data: isEmployee } = await supabaseAdmin.rpc('is_authenticated_employee', { _user_id: userId });
    if (!isEmployee) {
      return new Response(
        JSON.stringify({ error: 'Not authorized' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // ── End auth check ──

    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("AI service not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
