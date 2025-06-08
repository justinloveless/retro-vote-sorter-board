// Import type definitions for Supabase runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'
import { ElevenLabsClient } from 'npm:elevenlabs'
import * as hash from 'npm:object-hash'

// Constants from previous implementation
const BUCKET_NAME = 'tts-audio-cache';
const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Voice: Rachel

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey',
};

// Supabase and ElevenLabs clients
const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const elevenLabsClient = new ElevenLabsClient({
    apiKey: Deno.env.get('ELEVENLABS_API_KEY'),
});

// Background task to upload audio to storage without blocking the response
async function uploadAudioToStorage(stream: ReadableStream, fileName: string) {
    try {
        await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .upload(fileName, stream, {
                contentType: 'audio/mpeg',
                upsert: true,
            });
    } catch (error) {
        console.error('Storage upload error:', error.message);
    }
}

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const text = url.searchParams.get('text');
        const voiceId = url.searchParams.get('voiceId') ?? VOICE_ID;

        if (!text) {
            return new Response(JSON.stringify({ error: 'Text parameter is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // Generate a consistent hash for caching
        const requestHash = hash.MD5({ text, voiceId });
        const fileName = `${requestHash}.mp3`;

        // Check if the file exists in public storage and stream it if so
        const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(fileName);
        const headResponse = await fetch(publicUrl, { method: 'HEAD' });

        if (headResponse.ok) {
            const storageResponse = await fetch(publicUrl);
            return new Response(storageResponse.body, {
                headers: { 'Content-Type': 'audio/mpeg', ...corsHeaders },
            });
        }

        // If not in cache, generate speech with ElevenLabs
        const audioStream = await elevenLabsClient.textToSpeech.convertAsStream(voiceId, {
            text,
            model_id: 'eleven_multilingual_v2',
            output_format: 'mp3_44100_128',
        });

        // Tee the stream to send one copy to the browser and one to storage
        const [browserStream, storageStream] = audioStream.tee();

        // Start uploading to storage in the background without waiting for it to finish
        EdgeRuntime.waitUntil(uploadAudioToStorage(storageStream, fileName));

        // Return the audio stream to the browser immediately
        return new Response(browserStream, {
            headers: { 'Content-Type': 'audio/mpeg', ...corsHeaders },
        });

    } catch (error) {
        console.error('An unexpected error occurred:', error.message);
        return new Response(JSON.stringify({ error: 'Internal server error.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }
}); 