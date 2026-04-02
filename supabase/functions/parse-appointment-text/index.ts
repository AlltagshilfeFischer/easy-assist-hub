import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, customers, employees, verfuegbarkeiten, bestehendeTermine } = await req.json();
    const OPENAI_API_KEY = req.headers.get('x-openai-key') || Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Verfügbarkeiten pro MA formatieren
    const wochentage = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    let verfuegbarkeitText = '';
    if (verfuegbarkeiten && Object.keys(verfuegbarkeiten).length > 0) {
      const maMap = new Map(employees.map((e: any) => [e.id, e.name]));
      verfuegbarkeitText = '\n\nVerfügbarkeiten der Mitarbeiter:\n' +
        Object.entries(verfuegbarkeiten).map(([maId, slots]: [string, any]) => {
          const name = maMap.get(maId) || maId;
          const slotStr = slots.map((s: any) => `${wochentage[s.wochentag]} ${s.von}-${s.bis}`).join(', ');
          return `- ${name}: ${slotStr}`;
        }).join('\n');
    }

    // Bestehende Termine kompakt
    let termineText = '';
    if (bestehendeTermine && bestehendeTermine.length > 0) {
      const maMap = new Map(employees.map((e: any) => [e.id, e.name]));
      termineText = '\n\nBereits geplante Termine (nächste 2 Wochen):\n' +
        bestehendeTermine.slice(0, 50).map((t: any) => {
          const start = new Date(t.start);
          const end = new Date(t.end);
          const ma = maMap.get(t.mitarbeiter_id) || 'Unzugeordnet';
          return `- ${ma}: ${start.toISOString().slice(0, 10)} ${start.toISOString().slice(11, 16)}-${end.toISOString().slice(11, 16)}`;
        }).join('\n');
    }

    const systemPrompt = `Du bist ein Assistent für die Erstellung von Pflegeterminen.
Analysiere den Text des Benutzers und extrahiere daraus Terminvorschläge.

Verfügbare Kunden: ${JSON.stringify(customers.map((c: any) => ({ id: c.id, name: c.name })))}
Verfügbare Mitarbeiter: ${JSON.stringify(employees.map((e: any) => ({ id: e.id, name: e.name })))}
${verfuegbarkeitText}
${termineText}

WICHTIGE REGELN:
- Mindestens 15 Minuten Pause zwischen Terminen desselben Mitarbeiters.
- Termine nur innerhalb der Verfügbarkeitszeiten des Mitarbeiters planen.
- Keine Überschneidungen mit bestehenden Terminen.
- Wenn ein Mitarbeiter nicht verfügbar ist, schlage einen anderen vor oder lasse mitarbeiter_id null.

Erstelle strukturierte Terminvorschläge mit folgenden Informationen:
- kunde_id: ID des Kunden (aus der Liste)
- mitarbeiter_id: ID des Mitarbeiters (aus der Liste, kann null sein wenn nicht zugewiesen)
- datum: Datum im Format YYYY-MM-DD
- startzeit: Startzeit im Format HH:mm
- dauer_minuten: Dauer in Minuten (Standard: 60)
- notizen: Zusätzliche Notizen falls relevant

Wenn der Benutzer relative Zeitangaben macht (z.B. "morgen", "nächste Woche Montag"), berechne das konkrete Datum.
Heute ist ${new Date().toISOString().split('T')[0]}.

Wenn Informationen fehlen oder unklar sind, gib trotzdem einen Vorschlag ab und markiere das in den Notizen.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_appointment_suggestions",
              description: "Erstelle Terminvorschläge basierend auf der Benutzereingabe",
              parameters: {
                type: "object",
                properties: {
                  termine: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        kunde_id: { type: "string" },
                        mitarbeiter_id: { type: "string", nullable: true },
                        datum: { type: "string" },
                        startzeit: { type: "string" },
                        dauer_minuten: { type: "number" },
                        notizen: { type: "string" }
                      },
                      required: ["kunde_id", "datum", "startzeit", "dauer_minuten"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["termine"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_appointment_suggestions" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit erreicht. Bitte versuche es später erneut." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "KI-Kontingent aufgebraucht. Bitte später versuchen." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI Response:", JSON.stringify(data, null, 2));

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("Keine Terminvorschläge generiert");
    }

    const suggestions = JSON.parse(toolCall.function.arguments);
    
    return new Response(
      JSON.stringify(suggestions),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
