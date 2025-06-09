// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import * as hash from 'npm:object-hash';

const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apiKey, content-type'
};

// Memoize the function to avoid fetching the config on every invocation.
// The cache will be valid for the lifetime of the Edge Function instance.
let ttsUrl: string | null = null;
async function getSelfHostedTtsUrl(supabaseClient: SupabaseClient): Promise<string> {
    if (ttsUrl) {
        return ttsUrl;
    }

    const { data, error } = await supabaseClient
        .from('app_config')
        .select('value')
        .eq('key', 'SELF_HOSTED_TTS_URL')
        .single();

    if (error || !data) {
        console.error('Failed to fetch TTS URL from config:', error);
        throw new Error('TTS URL not configured in app_config table.');
    }

    ttsUrl = data.value;
    return ttsUrl;
}

// Upload audio to Supabase Storage in a background task
async function uploadAudioToStorage(stream, requestHash) {
    const { data, error } = await supabase.storage.from('tts-audio-cache').upload(`${requestHash}.wav`, stream, {
        contentType: 'audio/wav'
    });
    console.log('Storage upload result', {
        data,
        error
    });
}

Deno.serve(async (req) => {
    // To secure your function for production, you can for example validate the request origin,
    // or append a user access token and validate it with a Supabase Auth.
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: corsHeaders
        });
    }

    try {
        if (req.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
                status: 405,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { text, cache: shouldCache = true } = await req.json();

        if (!text) {
            return new Response(JSON.stringify({ error: 'Text parameter is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const SELF_HOSTED_TTS_URL = await getSelfHostedTtsUrl(supabase);

        const requestHash = hash.MD5({ text });

        if (shouldCache) {
            // Check storage for existing audio file first
            const { data: signedUrlData } = await supabase.storage.from('tts-audio-cache').createSignedUrl(`${requestHash}.wav`, 60 * 60); // 1 hour expiry
            if (signedUrlData) {
                const storageRes = await fetch(signedUrlData.signedUrl);
                if (storageRes.ok) {
                    console.log('Audio file found in cache, returning from storage.');
                    // For cached files, we still need to stream the body back correctly.
                    const headers = new Headers(storageRes.headers);
                    for (const [key, value] of Object.entries(corsHeaders)) {
                        headers.set(key, value);
                    }
                    return new Response(storageRes.body, { status: storageRes.status, headers });
                }
            }
        }

        const ttsUrl = `${SELF_HOSTED_TTS_URL}/api/tts`;
        const formData = new FormData();
        formData.append('text', text);

        const response = await fetch(ttsUrl, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`TTS server returned an error: ${response.status} ${await response.text()}`);
        }

        if (!response.body) {
            throw new Error('TTS server response did not contain a body.');
        }

        if (shouldCache) {
            // Branch stream to Supabase Storage
            const [browserStream, storageStream] = response.body.tee();
    
            // Upload to Supabase Storage in the background, don't await it
            EdgeRuntime.waitUntil(uploadAudioToStorage(storageStream, requestHash));

            // Return the streaming response immediately
            return new Response(browserStream, {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'audio/wav'
                }
            });
        }

        // Return the streaming response immediately
        return new Response(response.body, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'audio/wav'
            }
        });

    } catch (error) {
        console.error('Error in text-to-speech function:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
