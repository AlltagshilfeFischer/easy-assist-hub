import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Du bist ein Spalten-Mapper für Kunden-Importe eines deutschen Pflegedienstes.
Du erhältst eine Liste von CSV-Spaltenköpfen und sollst sie den Datenbankfeldern der kunden-Tabelle zuordnen.

DB-Felder der kunden-Tabelle:
- vorname (Vorname des Kunden)
- nachname (Nachname des Kunden)
- telefonnr (Telefonnummer)
- email (E-Mail-Adresse)
- strasse (Straße und Hausnummer)
- plz (Postleitzahl)
- stadt (Stadt/Ort)
- stadtteil (Stadtteil)
- adresse (kombinierte Adresse)
- geburtsdatum (Geburtsdatum, Format TT.MM.JJJJ)
- pflegegrad (Pflegegrad 0-5)
- pflegekasse (Krankenkasse/Pflegekasse)
- versichertennummer (Versichertennummer)
- kategorie (Kunde oder Interessent)
- stunden_kontingent_monat (Stunden pro Monat)
- sonstiges (Sonstige Informationen)
- angehoerige_ansprechpartner (Angehörige/Ansprechpartner)
- eintritt (Eintrittsdatum)
- austritt (Austrittsdatum)
- kassen_privat (Kasse oder Privat)
- mitarbeiter_name (Name des zuständigen Mitarbeiters)
- verhinderungspflege (Verhinderungspflege-Status: Ja / Nein / Beantragt)
- kopie_lw (Kopie Leistungsnachweis: Ja / Nein)
- tage (Besuchstage, z.B. "Mo, Mi, Fr")
- aktiv_status (Aktiv oder Inaktiv)
- initial_budget_entlastung (Vorjahresrest §45b Entlastungsbetrag in €, z.B. 524.50)
- initial_budget_verhinderung (verfügbares VP-Budget-Rest §39 in €, z.B. 2100)
- verhinderungspflege_budget (VP-Jahresbudget §39 in €, Standard 3539)

Bekannte CSV-Spalten in dieser Anwendung (aus Excel-Export):
- "Kundennr" → null (wird nicht importiert, nur interne Nummer)
- "Nachname" → nachname
- "Vorname" → vorname
- "Mitarbeiter" → mitarbeiter_name
- "PfG", "Pflegegrad", "PG" → pflegegrad
- "Adresse" → strasse (oder adresse wenn komplett)
- "Stadtteil" → stadtteil
- "Telefon", "Tel.", "Tel" → telefonnr
- "Geburtsdatum", "geb.", "Geb" → geburtsdatum
- "Pflegekasse", "Kasse" → pflegekasse
- "Versichertennnummer", "Versichertennummer", "Vers.Nr." → versichertennummer
- "Kasse/Privat", "Kasse_Privat" → kassen_privat
- "Stunden", "Std" → stunden_kontingent_monat
- "Angehöriger/Ansprechpartner", "Angehoerige" → angehoerige_ansprechpartner
- "Eintritt" → eintritt
- "Austritt" → austritt
- "Sonstiges", "Bemerkung", "Notizen" → sonstiges
- "Status", "Aktivstatus" → aktiv_status (Werte: "Aktiv" oder "Inaktiv")
- "Verhinderungspflege", "VP" → verhinderungspflege (Ja/Nein/Beantragt)
- "Kopie LW", "Kopie Leistungsnachweis" → kopie_lw
- "Tage", "Besuchstage" → tage
- "Column1" → null
- "Begründung" → sonstiges
- "Vorjahresrest", "Vorjahresrest EB", "Angesparter Betrag" → initial_budget_entlastung
- "VP Budget", "VP-Budget", "VP Rest" → initial_budget_verhinderung
- "VP Jahresbudget", "VP-Jahresbudget" → verhinderungspflege_budget

Antworte NUR mit einem validen JSON-Objekt. Kein Markdown, keine Erklärungen.
Format: { "csvSpalte1": "dbFeld1", "csvSpalte2": null, ... }
null bedeutet: diese Spalte wird beim Import ignoriert.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = req.headers.get("x-openai-key") || Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ mapping: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { columns } = await req.json() as { columns: string[] };

    if (!Array.isArray(columns) || columns.length === 0) {
      return new Response(JSON.stringify({ mapping: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Mappe diese CSV-Spalten: ${JSON.stringify(columns)}` },
        ],
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", response.status, await response.text());
      return new Response(JSON.stringify({ mapping: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const text = data.choices?.[0]?.message?.content ?? "";

    let mapping: Record<string, string | null> = {};
    try {
      mapping = JSON.parse(text);
    } catch {
      console.error("Failed to parse AI mapping response:", text.slice(0, 500));
      return new Response(JSON.stringify({ mapping: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ mapping }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("map-csv-columns error:", error);
    return new Response(JSON.stringify({ mapping: {} }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
