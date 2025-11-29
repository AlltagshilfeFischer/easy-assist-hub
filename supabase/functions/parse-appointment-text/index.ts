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
    const { text, customers, employees } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Du bist ein Assistent für die Erstellung von Pflegeterminen. 
Analysiere den Text des Benutzers und extrahiere daraus Terminvorschläge.

Verfügbare Kunden: ${JSON.stringify(customers.map((c: any) => ({ id: c.id, name: c.name })))}
Verfügbare Mitarbeiter: ${JSON.stringify(employees.map((e: any) => ({ id: e.id, name: e.name })))}

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
          JSON.stringify({ error: "Lovable AI Guthaben aufgebraucht. Bitte füge Guthaben hinzu." }),
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
