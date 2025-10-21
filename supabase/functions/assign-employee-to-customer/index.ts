import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { kunden_id, zeitfenster } = await req.json();

    if (!kunden_id) {
      return new Response(
        JSON.stringify({ error: 'kunden_id ist erforderlich' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching customer data for kunden_id:', kunden_id);

    // Get customer data
    const { data: kunde, error: kundeError } = await supabaseClient
      .from('kunden')
      .select('*')
      .eq('id', kunden_id)
      .single();

    if (kundeError || !kunde) {
      console.error('Customer fetch error:', kundeError);
      return new Response(
        JSON.stringify({ error: 'Kunde nicht gefunden' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching employees...');

    // Get all active employees with their data
    const { data: mitarbeiter, error: mitarbeiterError } = await supabaseClient
      .from('mitarbeiter')
      .select(`
        id,
        vorname,
        nachname,
        adresse,
        zustaendigkeitsbereich,
        standort,
        soll_wochenstunden,
        ist_aktiv,
        benutzer:benutzer_id (
          email
        )
      `)
      .eq('ist_aktiv', true);

    if (mitarbeiterError) {
      console.error('Employee fetch error:', mitarbeiterError);
      return new Response(
        JSON.stringify({ error: 'Fehler beim Laden der Mitarbeiter' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!mitarbeiter || mitarbeiter.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Keine aktiven Mitarbeiter gefunden' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${mitarbeiter.length} active employees`);

    // Get employee workload (count of scheduled appointments)
    const mitarbeiterIds = mitarbeiter.map(m => m.id);
    const { data: termine, error: termineError } = await supabaseClient
      .from('termine')
      .select('mitarbeiter_id')
      .in('mitarbeiter_id', mitarbeiterIds)
      .in('status', ['scheduled', 'confirmed']);

    const workloadMap = new Map<string, number>();
    if (termine) {
      termine.forEach(t => {
        if (t.mitarbeiter_id) {
          workloadMap.set(t.mitarbeiter_id, (workloadMap.get(t.mitarbeiter_id) || 0) + 1);
        }
      });
    }

    // Get employee availability
    const { data: verfuegbarkeit } = await supabaseClient
      .from('mitarbeiter_verfuegbarkeit')
      .select('*')
      .in('mitarbeiter_id', mitarbeiterIds);

    const verfuegbarkeitMap = new Map<string, any[]>();
    if (verfuegbarkeit) {
      verfuegbarkeit.forEach(v => {
        if (!verfuegbarkeitMap.has(v.mitarbeiter_id)) {
          verfuegbarkeitMap.set(v.mitarbeiter_id, []);
        }
        verfuegbarkeitMap.get(v.mitarbeiter_id)!.push(v);
      });
    }

    // Prepare employee data for AI
    const employeeContext = mitarbeiter.map(m => ({
      id: m.id,
      name: `${m.vorname} ${m.nachname}`,
      adresse: m.adresse || 'Keine Adresse',
      zustaendigkeitsbereich: m.zustaendigkeitsbereich || 'Nicht zugewiesen',
      standort: m.standort || 'Hannover',
      workload: workloadMap.get(m.id) || 0,
      soll_wochenstunden: m.soll_wochenstunden || 0,
      availability: verfuegbarkeitMap.get(m.id) || []
    }));

    console.log('Calling Lovable AI for employee matching...');

    // Call Lovable AI for intelligent matching
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: `Du bist ein intelligentes Matching-System für Pflegekräfte. 
Analysiere die gegebenen Mitarbeiter und wähle den besten Match basierend auf:
1. Geografische Nähe (Adresse des Mitarbeiters zur Kundenadresse)
2. Zuständigkeitsbereich (Stadtteil/Region)
3. Aktuelle Arbeitsauslastung (weniger Termine = besser)
4. Verfügbarkeit zu den gewünschten Zeitfenstern des Kunden

Antworte NUR mit der employee_id des besten Matches und einer kurzen Begründung.` 
          },
          { 
            role: "user", 
            content: `Kunde:
- Adresse: ${kunde.adresse || 'Keine Adresse'}
- Stadtteil: ${kunde.stadtteil || 'Nicht angegeben'}
- Gewünschte Zeitfenster: ${JSON.stringify(zeitfenster || [])}

Verfügbare Mitarbeiter:
${JSON.stringify(employeeContext, null, 2)}

Welcher Mitarbeiter passt am besten?` 
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "select_employee",
              description: "Wähle den besten Mitarbeiter für den Kunden",
              parameters: {
                type: "object",
                properties: {
                  employee_id: {
                    type: "string",
                    description: "Die ID des ausgewählten Mitarbeiters"
                  },
                  reasoning: {
                    type: "string",
                    description: "Begründung für die Auswahl"
                  },
                  match_score: {
                    type: "number",
                    description: "Match-Score von 0-100"
                  }
                },
                required: ["employee_id", "reasoning", "match_score"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "select_employee" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit überschritten, bitte später erneut versuchen" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Lovable AI Guthaben aufgebraucht, bitte aufladen" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    console.log('AI Response:', JSON.stringify(aiResult));

    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('Keine Tool-Call-Antwort von der KI');
    }

    const matchResult = JSON.parse(toolCall.function.arguments);
    console.log('AI Match Result:', matchResult);

    // Update customer with assigned employee
    const { error: updateError } = await supabaseClient
      .from('kunden')
      .update({ mitarbeiter: matchResult.employee_id })
      .eq('id', kunden_id);

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    // Get selected employee details
    const selectedEmployee = mitarbeiter.find(m => m.id === matchResult.employee_id);

    return new Response(
      JSON.stringify({ 
        success: true,
        employee_id: matchResult.employee_id,
        employee_name: selectedEmployee ? `${selectedEmployee.vorname} ${selectedEmployee.nachname}` : 'Unbekannt',
        reasoning: matchResult.reasoning,
        match_score: matchResult.match_score
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error("Error in assign-employee-to-customer:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unbekannter Fehler" }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});