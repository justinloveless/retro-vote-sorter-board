import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { currentEnvironment } from '@/config/environment';

export type AudioPlayerState = 'idle' | 'loading' | 'playing' | 'error';

export const useAudioPlayer = () => {
    const [audioState, setAudioState] = useState<AudioPlayerState>('idle');
    const [error, setError] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const blobUrlRef = useRef<string | null>(null);

    // Effect for cleaning up audio object and blob URL on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
            }
        };
    }, []);

    const play = useCallback(async (text: string) => {
        if (!text) {
            setError("No text provided to play.");
            setAudioState('error');
            return;
        }

        // Clean up previous audio before playing new audio
        if (audioRef.current) {
            audioRef.current.pause();
        }
        if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
        }

        setAudioState('loading');
        setError(null);

        try {
            const functionUrl = new URL(`${currentEnvironment.supabaseUrl}/functions/v1/text-to-speech`);
            functionUrl.searchParams.set('text', text);

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("User not authenticated.");

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

            const url = URL.createObjectURL(blob);
            blobUrlRef.current = url;

            const audio = new Audio(url);
            audioRef.current = audio;

            audio.onplay = () => setAudioState('playing');
            audio.onpause = () => setAudioState('idle');
            audio.onended = () => setAudioState('idle');
            audio.onerror = (e) => {
                console.error('Audio playback error', e);
                setError('Audio playback failed.');
                setAudioState('error');
            };

            await audio.play();

        } catch (e) {
            console.error('Error playing audio:', e);
            setError(e.message);
            setAudioState('error');
        }
    }, []);

    const pause = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
    }, []);

    return { play, pause, audioState, error };
}; 