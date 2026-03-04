import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
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

const systemPrompt = `Du bist ein Assistent für Pflegedienstplanung. Deine Aufgabe ist es, aus natürlicher Sprache Zeitfenster für Kunden zu extrahieren.

WICHTIGE SCHICHT-DEFINITIONEN:
- Schicht 1: 08:30 - 10:00 Uhr
- Schicht 2: 10:15 - 11:45 Uhr  
- Schicht 3: 12:00 - 13:30 Uhr
- Schicht 4: 13:45 - 15:15 Uhr
- Schicht 5: 15:30 - 17:00 Uhr

WOCHENTAGE (als Nummer):
- Montag: 1
- Dienstag: 2
- Mittwoch: 3
- Donnerstag: 4
- Freitag: 5
- Samstag: 6
- Sonntag: 0

Beispiel-Eingaben:
- "Montag und Mittwoch Schicht 1"
- "Jeden Dienstag von 14 bis 16 Uhr"
- "Mo, Mi, Fr vormittags zwischen 9 und 11"

Extrahiere alle Zeitfenster und gib sie strukturiert zurück. Priorität ist immer 3 (mittel) als Standard.`;

    console.log('Parsing time windows with AI:', text);

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
          { role: 'user', content: text }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'create_time_windows',
              description: 'Generate time windows for a customer based on natural language input',
              parameters: {
                type: 'object',
                properties: {
                  windows: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        wochentag: {
                          type: 'number',
                          description: 'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)'
                        },
                        von: {
                          type: 'string',
                          description: 'Start time in HH:MM format (24-hour)'
                        },
                        bis: {
                          type: 'string',
                          description: 'End time in HH:MM format (24-hour)'
                        },
                        prioritaet: {
                          type: 'number',
                          description: 'Priority level (1-5, default 3)'
                        }
                      },
                      required: ['wochentag', 'von', 'bis']
                    }
                  }
                },
                required: ['windows']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'create_time_windows' } }
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
    if (!toolCall || toolCall.function.name !== 'create_time_windows') {
      console.error('Unexpected AI response format');
      return new Response(
        JSON.stringify({ error: 'Failed to parse time windows' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log('Parsed time windows:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-time-windows:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
