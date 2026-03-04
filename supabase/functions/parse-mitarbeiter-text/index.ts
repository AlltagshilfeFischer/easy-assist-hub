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
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const { text } = await req.json();
    if (!text?.trim()) throw new Error("Kein Text angegeben");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 16000,
        messages: [
          {
            role: "system",
            content: `Du bist ein Daten-Parser für Mitarbeiter-Importe eines Pflegedienstes. 
Extrahiere aus dem Freitext alle Mitarbeiter-Informationen. 
Jeder Mitarbeiter braucht mindestens Vorname und Nachname.
Optional: Telefon, Straße, PLZ, Stadt, Soll-Wochenstunden, Zuständigkeitsbereich (Stadtteil/Gebiet).
Wenn keine E-Mail angegeben ist, generiere KEINE - lass sie leer.

WICHTIG - Verfügbarkeit / Zeitfenster:
Mitarbeiter können Verfügbarkeiten haben, z.B. "Mo-Fr 1,2,3,4,5" oder "Di,Mi" oder "Mo-Do 1,2,3,4,5".
Die Zahlen 1-5 sind Schichtnummern mit festen Zeiten:
- Schicht 1 = 08:30-10:00
- Schicht 2 = 10:15-11:45
- Schicht 3 = 12:00-13:30
- Schicht 4 = 13:45-15:15
- Schicht 5 = 15:30-17:00

Wochentage als Zahlen: Mo=1, Di=2, Mi=3, Do=4, Fr=5, Sa=6, So=0.

"Mo-Fr" bedeutet Montag bis Freitag (1,2,3,4,5).
"Di-Fr" bedeutet Dienstag bis Freitag (2,3,4,5).
"Mo-Do" bedeutet Montag bis Donnerstag (1,2,3,4).
"Di,Mi" bedeutet nur Dienstag und Mittwoch.

Wenn Schichtnummern angegeben sind, erzeuge für jeden Wochentag und jede Schicht einen Eintrag in "verfuegbarkeit" mit wochentag, von, bis.
Wenn KEINE Schichtnummern angegeben sind (z.B. nur "Di,Mi"), erzeuge Einträge für den ganzen Tag (08:30-17:00) an diesen Tagen.

EXTREM WICHTIG: Extrahiere ALLE Mitarbeiter aus dem Text, auch wenn es 30+ sind. Überspringe KEINE Einträge. Gib JEDEN einzelnen Mitarbeiter zurück.

Erkenne verschiedene Formate: Listen, Tabellen, Fließtext, CSV, etc.`,
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
                        zustaendigkeitsbereich: { type: "string", description: "Stadtteil oder Gebiet des Mitarbeiters" },
                        verfuegbarkeit: {
                          type: "array",
                          description: "Verfügbare Zeitfenster pro Wochentag",
                          items: {
                            type: "object",
                            properties: {
                              wochentag: { type: "number", description: "0=So, 1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr, 6=Sa" },
                              von: { type: "string", description: "Startzeit HH:MM" },
                              bis: { type: "string", description: "Endzeit HH:MM" },
                            },
                            required: ["wochentag", "von", "bis"],
                          },
                        },
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
      JSON.stringify({ error: (error as Error).message || "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
