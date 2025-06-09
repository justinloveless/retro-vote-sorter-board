import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { currentEnvironment } from '@/config/environment';

export type AudioPlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export const useAudioPlayer = () => {
    const [audioState, setAudioState] = useState<AudioPlayerState>('idle');
    const [error, setError] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const blobUrlRef = useRef<string | null>(null);

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

    const play = useCallback(async (text: string, autoPlay = true) => {
        if (!text) {
            setError("No text provided to play.");
            setAudioState('error');
            return;
        }

        if (audioRef.current) {
            audioRef.current.pause();
        }
        if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
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
                body: JSON.stringify({ text }),
            });

            if (!response.ok || response.headers.get('Content-Type') !== 'audio/wav') {
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

            const audio = new Audio(url);
            audioRef.current = audio;

            audio.onplay = () => setAudioState('playing');
            audio.onpause = () => setAudioState('paused');
            audio.onended = () => setAudioState('idle');
            audio.onerror = (e) => {
                console.error('Audio playback error', e);
                setError('Audio playback failed.');
                setAudioState('error');
                audioRef.current = null;
            };

            if (autoPlay) {
                await audio.play();
            } else {
                setAudioState('paused'); // Ready to be played
            }

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

    const resume = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.play();
        }
    }, []);

    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
        }
        if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
        }
        setAudioState('idle');
    }, []);

    return { play, pause, resume, stop, audioState, error };
}; 