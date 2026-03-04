import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { timeWindows, plz, preferences, frequency } = await req.json();

    if (!timeWindows || !Array.isArray(timeWindows)) {
      return new Response(
        JSON.stringify({ error: 'Time windows are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get employees from database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: employees, error: empError } = await supabase
      .from('mitarbeiter')
      .select('id, vorname, nachname, plz, stadt, zustaendigkeitsbereich, ist_aktiv, soll_wochenstunden, max_termine_pro_tag')
      .eq('ist_aktiv', true);

    if (empError) {
      console.error('Error fetching employees:', empError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch employees' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get employee availability
    const { data: availability, error: avError } = await supabase
      .from('mitarbeiter_verfuegbarkeit')
      .select('mitarbeiter_id, wochentag, von, bis');

    if (avError) {
      console.error('Error fetching availability:', avError);
    }

    const systemPrompt = `Du bist ein intelligenter Assistent für Mitarbeiter-Matching in einem Pflegedienst.

AUFGABE:
Analysiere die Kundenanforderungen und schlage die am besten geeigneten Mitarbeiter vor.

VERFÜGBARE MITARBEITER:
${employees.map(e => `- ${e.vorname} ${e.nachname} (ID: ${e.id}): PLZ ${e.plz || 'N/A'}, ${e.zustaendigkeitsbereich || 'Kein Bereich'}`).join('\n')}

MITARBEITER-VERFÜGBARKEIT:
${availability?.map(a => {
  const emp = employees.find(e => e.id === a.mitarbeiter_id);
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return `- ${emp?.vorname} ${emp?.nachname}: ${days[a.wochentag]} ${a.von}-${a.bis}`;
}).join('\n') || 'Keine Verfügbarkeiten erfasst'}

KUNDEN-ANFORDERUNGEN:
- Zeitfenster: ${timeWindows.map(tw => {
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  return `${days[tw.wochentag]} ${tw.von}-${tw.bis}`;
}).join(', ')}
- PLZ: ${plz || 'Nicht angegeben'}
- Frequenz: ${frequency || 'Nicht angegeben'}
- Präferenzen: ${preferences || 'Keine besonderen Präferenzen'}

BEWERTUNGSKRITERIEN:
1. Verfügbarkeit zur gewünschten Zeit (wichtigster Faktor)
2. Geographische Nähe (PLZ-Übereinstimmung)
3. Zuständigkeitsbereich passt zu Kundenwünschen
4. Auslastung des Mitarbeiters (bevorzuge weniger ausgelastete)

Gib die Top 3-5 Mitarbeiter zurück mit Begründung.`;

    console.log('Suggesting employees with AI');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Bitte analysiere die Anforderungen und schlage geeignete Mitarbeiter vor.' }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'suggest_employees',
              description: 'Suggest suitable employees based on customer requirements',
              parameters: {
                type: 'object',
                properties: {
                  suggestions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        mitarbeiter_id: {
                          type: 'string',
                          description: 'Employee ID'
                        },
                        match_score: {
                          type: 'number',
                          description: 'Match score 1-100'
                        },
                        reasoning: {
                          type: 'string',
                          description: 'Explanation why this employee is a good match'
                        }
                      },
                      required: ['mitarbeiter_id', 'match_score', 'reasoning']
                    }
                  }
                },
                required: ['suggestions']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_employees' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Insufficient credits. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('AI response:', JSON.stringify(data, null, 2));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'suggest_employees') {
      console.error('Unexpected AI response format');
      return new Response(
        JSON.stringify({ error: 'Failed to get employee suggestions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = JSON.parse(toolCall.function.arguments);
    
    // Enrich with employee details
    const enrichedSuggestions = result.suggestions.map((s: any) => {
      const emp = employees.find(e => e.id === s.mitarbeiter_id);
      return {
        ...s,
        employee: emp
      };
    });

    console.log('Employee suggestions:', enrichedSuggestions);

    return new Response(
      JSON.stringify({ suggestions: enrichedSuggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in suggest-employees:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
