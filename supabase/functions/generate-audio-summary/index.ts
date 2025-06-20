// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import * as hash from 'npm:object-hash'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
const openAIEndpoint = "https://api.openai.com/v1/chat/completions";
const ttsEndpoint = "https://api.openai.com/v1/audio/speech";

interface Prompt {
    default: string;
    formal: string;
    humorous: string;
    jackbox: string;
}

const prompts = {
    default: `You are a script generator. Given a list of items from a retrospective board column, generate a concise, engaging, and informative summary script. The script should be suitable for text-to-speech conversion.

Here are the items for the column titled "{columnTitle}":
{itemsText}

Rules:
- Never include punctuation characters that do not affect speech; for example, don't include quotes, apostrophes, or other punctuation that does not affect speech.
- Start with a clear and engaging introduction that mentions the column title.
- Group similar items together and summarize them.
- Highlight key themes and patterns.
- Keep the script concise and under 100 words.
- Use natural language that is easy to understand when spoken.
- End with a brief concluding statement.
- Only output the script, with no preamble.`,

    formal: `You are a professional scriptwriter. Your task is to generate a formal and structured summary script based on items from a retrospective board column. The script must be clear, professional, and suitable for a corporate audience.

Column Title: {columnTitle}
Items:
{itemsText}

Guidelines:
- Never include punctuation characters that do not affect speech; for example, don't include quotes, apostrophes, or other punctuation that does not affect speech.
- Begin with a formal opening, stating the purpose of the summary.
- Address each item or group of items systematically.
- Maintain a professional and objective tone.
- Ensure the language is precise and unambiguous.
- Conclude with a summary of key takeaways and action points.
- The script should be approximately 100 words.
- Only output the script, with no preamble.`,

    humorous: `You are a witty and humorous commentator. Your job is to create a funny and entertaining script summarizing items from a retrospective board column. The script should be light-hearted and engaging.

Column: "{columnTitle}"
The tea:
{itemsText}

Instructions:
- Never include punctuation characters that do not affect speech; for example, don't include quotes, apostrophes, or other punctuation that does not affect speech.
- Start with a funny or quirky introduction.
- Use humor, puns, and clever wordplay to present the items.
- Feel free to gently poke fun at the themes, but keep it positive.
- Keep the tone light and conversational.
- End with a memorable and funny sign-off.
- The script should be around 100 words.
- Only output the script, with no preamble.`,

    jackbox: `You are a fast-talking, high-energy, and slightly unhinged announcer from a Jackbox.tv game like 'You Don't Know Jack'. Your job is to create a zany and hilarious script summarizing items from a retrospective board column. It's time for 'Gibberish or Jabber-dish'!

Column Title: "{columnTitle}"
The Gibberish:
{itemsText}

Rules of the Game:
- Never include punctuation characters that do not affect speech; for example, don't include quotes, apostrophes, or other punctuation that does not affect speech.
- Start with a loud, attention-grabbing, and nonsensical intro.
- Read through the items with rapid-fire, chaotic energy. Use sound effects in text (e.g., "Bzzzt!", "Boop!").
- Make wild, funny, and often incorrect assumptions about what the items mean.
- Use lots of exclamation points and CAPITAL LETTERS for emphasis.
- Keep it short, punchy, and under 100 words. This ain't your grandma's retrospective!
- End with a ridiculously over-the-top outro and a plug for a fake sponsor.
- Only output the script, with no preamble. It's go time!`
};

async function uploadAudioToStorage(stream: ReadableStream, requestHash: string) {
    const { data, error } = await supabase.storage.from('tts-audio-cache').upload(`${requestHash}.mp3`, stream, {
        contentType: 'audio/mpeg'
    });

    if (error) {
        console.error('Storage upload error', error);
        throw error;
    }
    
    console.log('Storage upload result', {
        data
    });
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { items, columnTitle, style = 'default', voice = 'alloy', boardId } = await req.json();
        if (!boardId) {
            throw new Error("boardId is required.");
        }
        
        const requestPayload = { items, columnTitle, style, voice };
        const requestHash = hash.MD5(requestPayload);
        const audioPath = `${requestHash}.mp3`;

        // Check storage for existing audio file first
        const { data: cachedFile } = await supabase.storage.from('tts-audio-cache').getPublicUrl(audioPath);
        
        if (cachedFile && cachedFile.publicUrl) {
            // Check if the URL is accessible
            const headResponse = await fetch(cachedFile.publicUrl);
            if (headResponse.ok) {
                console.log('Audio file found in cache, broadcasting URL.');
                const channel = supabase.channel(`retro-board-${boardId}`);
                await channel.send({
                    type: 'broadcast',
                    event: 'play-summary-audio',
                    payload: { url: cachedFile.publicUrl },
                });
                return new Response(JSON.stringify({ success: true, message: 'Audio URL broadcasted from cache.' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                });
            }
        }

        const itemsText = items.map((item: { text: string }) => `- ${item.text}`).join('\n');

        const selectedPrompt = prompts[style as keyof Prompt] || prompts.default;
        const prompt = selectedPrompt
            .replace('{columnTitle}', columnTitle)
            .replace('{itemsText}', itemsText);

        const scriptResponse = await fetch(openAIEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 300,
            }),
        });

        if (!scriptResponse.ok) {
            const errorBody = await scriptResponse.text();
            console.error('OpenAI script generation failed:', errorBody);
            throw new Error(`OpenAI script generation failed with status ${scriptResponse.status}: ${errorBody}`);
        }

        const { choices } = await scriptResponse.json();
        const script = choices[0].message.content;

        const ttsResponse = await fetch(ttsEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: script,
                voice: voice,
            }),
        });

        if (!ttsResponse.ok) {
            const errorBody = await ttsResponse.text();
            console.error('OpenAI TTS failed:', errorBody);
            throw new Error(`OpenAI TTS failed with status ${ttsResponse.status}: ${errorBody}`);
        }
        
        if (!ttsResponse.body) {
            throw new Error('TTS server response did not contain a body.');
        }

        const [storageStream, responseStream] = ttsResponse.body.tee();
    
        // Upload to Supabase Storage, and wait for it to finish
        await uploadAudioToStorage(storageStream, requestHash);

        const { data: { publicUrl } } = supabase.storage.from('tts-audio-cache').getPublicUrl(audioPath);

        if (!publicUrl) {
            throw new Error('Failed to get public URL for the new audio file.');
        }
        
        // Broadcast the URL to all clients on the board
        const channel = supabase.channel(`retro-board-${boardId}`);
        await channel.send({
            type: 'broadcast',
            event: 'play-summary-audio',
            payload: { url: publicUrl },
        });

        return new Response(JSON.stringify({ success: true, message: 'Audio generated and URL broadcasted.' }), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
            },
            status: 200,
        });

    } catch (error) {
        console.error('Error in generate-audio-summary function:', error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
}); 