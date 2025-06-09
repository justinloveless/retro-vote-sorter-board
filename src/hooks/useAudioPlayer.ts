import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { currentEnvironment } from '@/config/environment';

export type AudioPlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export const useAudioPlayer = () => {
    const [audioState, setAudioState] = useState<AudioPlayerState>('idle');
    const [error, setError] = useState<string | null>(null);

    // Create a single Audio object and hold it in a ref.
    const audioRef = useRef<HTMLAudioElement>(new Audio());
    const blobUrlRef = useRef<string | null>(null);

    // Setup event listeners and cleanup on mount/unmount.
    useEffect(() => {
        const audio = audioRef.current;

        const handlePlay = () => setAudioState('playing');
        const handlePause = () => {
            // Only set to paused if not at the end of the track.
            if (!audio.ended) {
                setAudioState('paused');
            }
        };
        const handleEnded = () => setAudioState('idle');
        const handleError = (e: Event) => {
            console.error('Audio playback error', e);
            const mediaError = (e.target as HTMLAudioElement).error;
            setError(`Audio playback failed: ${mediaError?.message || 'Unknown error'}`);
            setAudioState('error');
        };

        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);

        // Cleanup function
        return () => {
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause',handlePause);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);

            audio.pause();
            audio.src = '';
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
                blobUrlRef.current = null;
            }
        };
    }, []); // Empty dependency array ensures this runs only once.

    const play = useCallback(async (text: string, options: { autoPlay?: boolean, cache?: boolean } = {}) => {
        const { autoPlay = true, cache = true } = options;
        const audio = audioRef.current;

        if (!text) {
            setError("No text provided to play.");
            setAudioState('error');
            return;
        }

        // Stop any current playback before starting a new one.
        audio.pause();
        if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
        }

        setAudioState('loading');
        setError(null);

        try {
            const functionUrl = `${currentEnvironment.supabaseUrl}/functions/v1/text-to-speech`;

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("User not authenticated.");

            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': currentEnvironment.supabaseAnonKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text, cache }),
            });

            if (!response.ok || !response.body) {
                let errorText = `Failed to fetch audio: ${response.status}`;
                try {
                    const errorJson = await response.json();
                    errorText = errorJson.error || JSON.stringify(errorJson);
                } catch {
                    // Could not parse JSON, use raw text
                    errorText = await response.text();
                }
                throw new Error(errorText);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            blobUrlRef.current = url;
            audio.src = url;

            if (autoPlay) {
                await audio.play();
                setAudioState('playing');
            } else {
                audio.load();
                // When loading but not playing, we are in a 'paused' state, ready to play.
                // The 'pause' event won't fire here, so we set the state manually.
                setAudioState('paused');
            }

        } catch (e: any) {
            console.error('Error playing audio:', e);
            setError(e.message);
            setAudioState('error');
        }
    }, []);

    const pause = useCallback(() => {
        audioRef.current.pause();
    }, []);

    const resume = useCallback(() => {
        audioRef.current.play();
    }, []);

    const stop = useCallback(() => {
        const audio = audioRef.current;
        audio.pause();
        // Resetting time is important for re-playing the same audio.
        if (audio.currentTime) {
            audio.currentTime = 0;
        }
        // The 'idle' state indicates nothing is loaded or ready to play.
        setAudioState('idle');
    }, []);

    return { play, pause, resume, stop, audioState, error };
}; 