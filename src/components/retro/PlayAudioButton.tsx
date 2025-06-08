import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Volume2, Loader2, Pause, AlertTriangle } from 'lucide-react';
import { currentEnvironment } from '@/config/environment';

interface PlayAudioButtonProps {
    itemText: string;
}

export const PlayAudioButton: React.FC<PlayAudioButtonProps> = ({ itemText }) => {
    const [audioState, setAudioState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const blobUrlRef = useRef<string | null>(null);

    // This effect ensures we clean up the audio object and blob URL when the component is removed
    useEffect(() => {
        const audio = audioRef.current;
        const blobUrl = blobUrlRef.current;
        return () => {
            if (audio) {
                audio.pause();
                audio.src = '';
            }
            if (blobUrl) {
                URL.revokeObjectURL(blobUrl);
            }
        };
    }, []);

    const handlePlay = async () => {
        // If audio is currently playing, pause it.
        if (audioRef.current && audioState === 'playing') {
            audioRef.current.pause();
            return;
        }

        // If we have already fetched the audio and it's just paused, play it.
        if (audioRef.current && audioRef.current.paused) {
            audioRef.current.play();
            return;
        }

        // Clean up previous audio if we're about to fetch a new one
        if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
        }
        if (audioRef.current) {
            audioRef.current.src = '';
            audioRef.current = null;
        }

        setAudioState('loading');

        try {
            // The user updated the edge function to stream audio directly.
            // This requires a GET request with URL params. We can't use `supabase.functions.invoke()`
            // because it sends a POST request and is designed for JSON responses, which would corrupt the audio data.
            // Instead, we manually `fetch` the function's public URL with the necessary auth headers.

            const functionUrl = new URL(`${currentEnvironment.supabaseUrl}/functions/v1/text-to-speech`);
            functionUrl.searchParams.set('text', itemText);

            // 2. Get the user's session for the auth token.
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("User not authenticated.");

            // 3. Fetch the audio stream with auth headers.
            const response = await fetch(functionUrl.toString(), {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': currentEnvironment.supabaseAnonKey,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch audio: ${response.status} ${errorText}`);
            }

            const blob = await response.blob();

            if (blob.type !== 'audio/mpeg') {
                try {
                    const errorJson = JSON.parse(await blob.text());
                    throw new Error(errorJson.error || "Invalid audio data received.");
                } catch {
                    throw new Error("Invalid audio data received. Expected audio/mpeg.");
                }
            }

            // 4. Create a local URL for the blob and play it.
            const url = URL.createObjectURL(blob);
            blobUrlRef.current = url;

            const audio = new Audio(url);
            audioRef.current = audio;

            audio.onplay = () => setAudioState('playing');
            audio.onpause = () => setAudioState('idle');
            audio.onended = () => setAudioState('idle');
            audio.onerror = (e) => {
                console.error('Audio playback error', e);
                setAudioState('error');
            };

            await audio.play();

        } catch (e) {
            console.error('Error playing audio:', e);
            setAudioState('error');
        }
    };

    const getIcon = () => {
        switch (audioState) {
            case 'playing':
                return <Pause className="h-4 w-4" />;
            case 'loading':
                return <Loader2 className="h-4 w-4 animate-spin" />;
            case 'error':
                return <AlertTriangle className="h-4 w-4 text-red-500" />;
            default:
                return <Volume2 className="h-4 w-4" />;
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handlePlay}
            disabled={audioState === 'loading'}
            className="h-8 w-8 p-0"
            title="Read aloud"
        >
            {getIcon()}
        </Button>
    );
}; 