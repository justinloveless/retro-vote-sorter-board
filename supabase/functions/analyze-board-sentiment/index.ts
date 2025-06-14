
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { boardItems } = await req.json();

    if (!boardItems || boardItems.length === 0) {
      return new Response(
        JSON.stringify({ sentiment: 'neutral', confidence: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Combine all board items into a single text for analysis
    const combinedText = boardItems.map((item: any) => item.text).join('. ');

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
            content: `You are a sentiment analysis expert. Analyze the overall sentiment of retrospective board items and respond ONLY with a JSON object in this exact format: {"sentiment": "positive|negative|neutral", "confidence": 0.0-1.0}. Consider the collective mood and tone of all items together.`
          },
          {
            role: 'user',
            content: `Analyze the overall sentiment of these retrospective items: ${combinedText}`
          }
        ],
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    try {
      const sentimentResult = JSON.parse(aiResponse);
      return new Response(JSON.stringify(sentimentResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      return new Response(
        JSON.stringify({ sentiment: 'neutral', confidence: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in analyze-board-sentiment function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', sentiment: 'neutral', confidence: 0 }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
