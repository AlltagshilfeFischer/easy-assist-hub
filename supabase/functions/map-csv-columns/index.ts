import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Du bist ein Spalten-Mapper für Kunden-Importe eines deutschen Pflegedienstes.
Du erhältst eine Liste von CSV-Spaltenköpfen und sollst sie den Datenbankfeldern der kunden-Tabelle zuordnen.

DB-Felder der kunden-Tabelle:
Stammdaten:
- vorname, nachname, titel (Dr./Prof./…), geschlecht (maennlich/weiblich/divers/keine_angabe)
- telefonnr, email
- strasse, plz, stadt, stadtteil, adresse (kombiniert)
- geburtsdatum (TT.MM.JJJJ), pflegegrad (0-5)
- pflegekasse, versichertennummer
- kategorie (Kunde/Interessent), aktiv_status (Aktiv/Inaktiv)
- kassen_privat, kopie_lw (Ja/Nein), tage, stunden_kontingent_monat
- mitarbeiter_name, eintritt, austritt, sonstiges, angehoerige_ansprechpartner

Budgets & Leistungen (alle Geldbeträge in €):
- verhinderungspflege (§39 VP aktiv: Ja/Nein)
- verhinderungspflege_genehmigt (§39 VP von Kasse genehmigt: Ja/Nein)
- verhinderungspflege_budget (§39 Jahresbudget, Standard 3539)
- initial_budget_verhinderung (§39 noch verfügbarer Rest in €)
- kombileistung (§45a Kombileistung/Pflegesachleistung aktiv: Ja/Nein)
- pflegesachleistung_budget (§45a Kombi-Budget in €)
- entlastung_genehmigt (§45b EB von Kasse genehmigt: Ja/Nein, Standard Ja)
- initial_budget_entlastung (§45b Vorjahresrest/angesparter EB in €)

Bekannte CSV-Spalten in dieser Anwendung:
- "Kundennr", "KundenNr", "Nr." → null
- "Column1" → null
- "Nachname" → nachname
- "Vorname" → vorname
- "Anrede" → geschlecht  ("Herr" = maennlich, "Frau" = weiblich)
- "Titel" → titel
- "Mitarbeiter", "Betreuer" → mitarbeiter_name
- "PfG", "Pflegegrad", "PG" → pflegegrad
- "Adresse", "Straße" → strasse
- "Stadtteil" → stadtteil
- "Telefon", "Tel.", "Tel", "Mobil" → telefonnr
- "Geburtsdatum", "Geb.", "Geb" → geburtsdatum
- "Pflegekasse", "Kasse" → pflegekasse
- "Versichertennummer", "Vers.Nr." → versichertennummer
- "Kasse/Privat" → kassen_privat
- "Stunden", "Std" → stunden_kontingent_monat
- "Tage", "Besuchstage" → tage
- "Angehöriger/Ansprechpartner", "Angehörige" → angehoerige_ansprechpartner
- "Eintritt", "Eintrittsdatum", "Beginn" → eintritt
- "Austritt", "Austrittsdatum" → austritt
- "Sonstiges", "Bemerkung", "Notizen", "Begründung" → sonstiges
- "Status", "Aktivstatus" → aktiv_status
- "Verhinderungspflege", "VP" → verhinderungspflege
- "VP genehmigt" → verhinderungspflege_genehmigt
- "VP Budget", "VP-Budget", "VP Rest" → initial_budget_verhinderung
- "VP Jahresbudget" → verhinderungspflege_budget
- "Kombileistung", "Kombi", "§45a", "Pflegesachleistung" → kombileistung
- "Kombi Budget", "§45a Budget" → pflegesachleistung_budget
- "EB genehmigt", "Entlastung genehmigt" → entlastung_genehmigt
- "Vorjahresrest", "Vorjahresrest EB", "Angesparter Betrag" → initial_budget_entlastung
- "Kopie LW", "Kopie Leistungsnachweis" → kopie_lw

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
