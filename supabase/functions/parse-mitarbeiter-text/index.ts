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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { text } = await req.json();
    if (!text?.trim()) throw new Error("Kein Text angegeben");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Du bist ein Daten-Parser für Mitarbeiter-Importe eines Pflegedienstes. 
Extrahiere aus dem Freitext alle Mitarbeiter-Informationen. 
Jeder Mitarbeiter braucht mindestens Vorname, Nachname und E-Mail.
Optional: Telefon, Straße, PLZ, Stadt, Soll-Wochenstunden.
Erkenne verschiedene Formate: Listen, Tabellen, Fließtext, CSV, etc.
Wenn keine E-Mail angegeben ist, generiere KEINE - lass sie leer.`,
          },
          {
            role: "user",
            content: `Extrahiere alle Mitarbeiter aus folgendem Text:\n\n${text}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_mitarbeiter",
              description: "Extrahierte Mitarbeiter-Daten aus dem Text",
              parameters: {
                type: "object",
                properties: {
                  mitarbeiter: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        vorname: { type: "string" },
                        nachname: { type: "string" },
                        email: { type: "string" },
                        telefon: { type: "string" },
                        strasse: { type: "string" },
                        plz: { type: "string" },
                        stadt: { type: "string" },
                        soll_wochenstunden: { type: "number" },
                      },
                      required: ["vorname", "nachname"],
                    },
                  },
                },
                required: ["mitarbeiter"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_mitarbeiter" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit erreicht, bitte versuchen Sie es später erneut." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Guthaben aufgebraucht." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("KI-Verarbeitung fehlgeschlagen");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("KI konnte keine Mitarbeiter extrahieren");
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ mitarbeiter: parsed.mitarbeiter || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("parse-mitarbeiter-text error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
