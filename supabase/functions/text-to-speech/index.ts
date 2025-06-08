import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

// --- CONFIGURATION ---
// IMPORTANT: These environment variables must be set in your Supabase project settings
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Default voice: "Rachel". Change if you like.
const BUCKET_NAME = 'tts-audio-cache';

// Supabase admin client for server-side operations
const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// --- HELPER FUNCTIONS ---
const generateCacheKey = async (text: string): Promise<string> => {
    const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
    const hashArray = Array.from(new Uint8Array(hash));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hashHex}.mp3`;
};

// --- MAIN SERVER LOGIC ---
serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
            }
        });
    }

    try {
        const { text } = await req.json();
        if (!text || typeof text !== 'string') {
            return new Response(JSON.stringify({ error: 'Text is required and must be a string.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const fileName = await generateCacheKey(text);

        // 1. Check for audio in cache
        const { data: fileList, error: listError } = await supabaseAdmin
            .storage
            .from(BUCKET_NAME)
            .list(undefined, { search: fileName, limit: 1 });

        if (listError) {
            console.error("Error checking cache:", listError.message);
            // Don't block request, proceed to generate audio
        }

        if (fileList && fileList.length > 0) {
            // 1a. Cache HIT: File exists, stream it from storage
            const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(fileName);
            return fetch(publicUrl);
        }

        // 1b. Cache MISS: Generate new audio
        if (!ELEVENLABS_API_KEY) {
            console.error("ELEVENLABS_API_KEY is not set.");
            return new Response(JSON.stringify({ error: 'Text-to-speech service is not configured.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`;
        const elevenLabsResponse = await fetch(elevenLabsUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY,
                'Accept': 'audio/mpeg',
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_turbo_v2',
            }),
        });

        if (!elevenLabsResponse.ok || !elevenLabsResponse.body) {
            const errorBody = await elevenLabsResponse.text();
            console.error('ElevenLabs API Error:', errorBody);
            return new Response(JSON.stringify({ error: 'Failed to generate audio from provider.' }), {
                status: 502, // Bad Gateway
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Clone the stream to use it for both response and caching
        const [clientStream, cacheStream] = elevenLabsResponse.body.tee();

        // 2. Asynchronously upload to cache (don't block the client response)
        const uploadPromise = supabaseAdmin
            .storage
            .from(BUCKET_NAME)
            .upload(fileName, cacheStream, {
                contentType: 'audio/mpeg',
                upsert: true,
            });

        uploadPromise.catch(uploadError => {
            // Log errors but don't fail the request
            console.error('Failed to upload audio to cache:', uploadError.message);
        });

        // 3. Stream the audio directly back to the client
        return new Response(clientStream, {
            headers: {
                'Content-Type': 'audio/mpeg',
            },
        });

    } catch (error) {
        // General error handler
        console.error("An unexpected error occurred:", error.message);
        return new Response(JSON.stringify({ error: 'An internal server error occurred.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}); 