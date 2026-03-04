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
            content: `Du bist ein Daten-Parser für Kunden-Importe eines Pflegedienstes.
Extrahiere aus dem Freitext alle Kunden-Informationen.
Jeder Kunde braucht mindestens Vorname und Nachname.

Die Daten können in beliebigen Formaten vorliegen: Tabellen, Listen, Fließtext, CSV, Tab-getrennt etc.
Die Spaltenreihenfolge kann variieren. Typische Felder sind:
- Kundennummer (ignorieren, wird nicht importiert)
- Nachname, Vorname (manchmal mit Zweitnamen wie "Alfred Sabine" = Vorname + Zweitvorname)
- Pflegegrad (0-5)
- Adresse (Straße mit Hausnummer, PLZ, Stadt) - oft als "Karlstraße 29, 30559 Hannover"
- Stadtteil
- Telefonnummer(n) - können mehrere sein, nimm die erste
- Geburtsdatum - kann in verschiedenen Formaten sein (M/D/YYYY, DD.MM.YYYY etc.), konvertiere zu TT.MM.JJJJ
- Pflegekasse (z.B. "AOK Niedersachsen", "DAK-Gesundheit", "Techniker")
- Versichertennummer
- Kategorie: "Kunde" wenn "Aktiv", "Interessent" wenn "Inaktiv"
- Angehörige/Ansprechpartner (Name und Telefon der Kontaktperson)
- Sonstiges/Notizen

WICHTIG:
- Adressen müssen in Straße, PLZ und Stadt aufgeteilt werden
- Geburtsdaten in TT.MM.JJJJ Format konvertieren
- Bei mehreren Telefonnummern die erste als Hauptnummer nehmen
- Wenn "Aktiv" steht → kategorie "Kunde", wenn "Inaktiv" → kategorie "Interessent"
- Pflegegrad als Zahl (0-5)
- Wenn keine E-Mail angegeben ist, generiere KEINE

EXTREM WICHTIG: Extrahiere ALLE Kunden aus dem Text, auch wenn es 50+ sind. Überspringe KEINE Einträge. Gib JEDEN einzelnen Kunden zurück.`,
          },
          {
            role: "user",
            content: `Extrahiere alle Kunden aus folgendem Text:\n\n${text}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_kunden",
              description: "Extrahierte Kunden-Daten aus dem Text",
              parameters: {
                type: "object",
                properties: {
                  kunden: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        vorname: { type: "string", description: "Vorname(n) des Kunden" },
                        nachname: { type: "string", description: "Nachname des Kunden" },
                        telefonnr: { type: "string", description: "Haupttelefonnummer" },
                        email: { type: "string", description: "E-Mail-Adresse falls vorhanden" },
                        strasse: { type: "string", description: "Straße mit Hausnummer" },
                        plz: { type: "string", description: "Postleitzahl (5 Ziffern)" },
                        stadt: { type: "string", description: "Stadt" },
                        stadtteil: { type: "string", description: "Stadtteil" },
                        geburtsdatum: { type: "string", description: "Geburtsdatum im Format TT.MM.JJJJ" },
                        pflegegrad: { type: "string", description: "Pflegegrad als Zahl 0-5" },
                        kategorie: { type: "string", description: "Kunde oder Interessent" },
                        pflegekasse: { type: "string", description: "Name der Pflegekasse" },
                        versichertennummer: { type: "string", description: "Versichertennummer" },
                        sonstiges: { type: "string", description: "Angehörige, Notizen, besondere Hinweise" },
                      },
                      required: ["vorname", "nachname"],
                    },
                  },
                },
                required: ["kunden"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_kunden" } },
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
      throw new Error("KI konnte keine Kunden extrahieren");
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ kunden: parsed.kunden || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("parse-kunden-text error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
