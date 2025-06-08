import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stylePrompts = {
    'News Anchor': 'You are a professional news anchor. Summarize the following retro items in a formal, objective, and clear news report format. Start with a headline.',
    'Comedian': 'You are a stand-up comedian. Turn these retro items into a comedy routine. Be witty, sarcastic, and find the humor in the situation. Don\'t be afraid to poke fun.',
    'Roast Me': 'You are a roast master. Mercilessly roast the team based on these retro items. Be brutal but funny. No holding back.',
    'Documentary': 'You are a documentary narrator (like David Attenborough). Describe the team\'s activities based on these retro items as if you were observing a newly discovered species in the wild. Be descriptive and profound.',
    'Epic': 'You are a movie trailer voice-over artist. Describe the team\'s retro items in an epic, dramatic, and over-the-top movie trailer style. Use a deep, booming voice. "In a world..."',
};


serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { items, style } = await req.json();

        if (!items || items.length === 0) {
            return new Response(
                JSON.stringify({ script: "Nothing to report. The floor is open." }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (!style || !stylePrompts[style]) {
            return new Response(
                JSON.stringify({ error: "A valid style is required." }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const combinedText = items.map((item: any) => `- ${item.text}`).join('\n');
        const systemPrompt = stylePrompts[style];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openAIApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `${systemPrompt} Keep the script concise and under 150 words.`
                    },
                    {
                        role: 'user',
                        content: `Here are the retro items:\n${combinedText}`
                    }
                ],
                temperature: 0.7,
            }),
        });

        const data = await response.json();
        const script = data.choices[0].message.content;

        return new Response(JSON.stringify({ script }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in generate-script function:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to generate script.', details: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
}); 