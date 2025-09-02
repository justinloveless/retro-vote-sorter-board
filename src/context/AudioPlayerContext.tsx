import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client.ts';
import { currentEnvironment } from '../config/environment.ts';
import { useToast } from '../hooks/use-toast.ts';

export type AudioPlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface PlayOptions {
  autoPlay?: boolean;
  cache?: boolean;
}

interface AudioPlayerContextType {
  audioState: AudioPlayerState;
  error: string | null;
  playAudioUrl: (audioUrl: string) => Promise<void>;
  play: (text: string, options: PlayOptions) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [audioState, setAudioState] = useState<AudioPlayerState>('idle');
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const { toast } = useToast();


  // Only create the audio element once
  if (!audioRef.current) {
    audioRef.current = new Audio();
  }

  useEffect(() => {
    const audio = audioRef.current!;
    const handlePlay = () => setAudioState('playing');
    const handlePause = () => { if (!audio.ended) setAudioState('paused'); };
    const handleEnded = () => setAudioState('idle');
    const handleError = (e: Event) => {
      const mediaError = (e.target as HTMLAudioElement).error;
      setError(`Audio playback failed: ${mediaError?.message || 'Unknown error'}`);
      setAudioState('error');
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = '';
    };
  }, []);


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
        toast({
            title: 'Text-to-Speech Error',
            description: "There was an issue with the text-to-speech service. Please try again later.",
            variant: 'destructive',
        });
    }
}, [toast]);

  const playAudioUrl = useCallback(async (audioUrl: string) => {
    try {
      const audio = audioRef.current!;
      audio.src = audioUrl;
      await audio.play();
      setAudioState('playing');
    } catch (err) {
      setError('Failed to play audio');
      setAudioState('error');
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);
  const resume = useCallback(() => {
    audioRef.current?.play();
  }, []);
  const stop = useCallback(() => {
    const audio = audioRef.current!;
    audio.pause();
    audio.currentTime = 0;
    setAudioState('idle');
  }, []);

  return (
    <AudioPlayerContext.Provider value={{ audioState, error, playAudioUrl, play, pause, resume, stop }}>
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayerContext = () => {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('useAudioPlayerContext must be used within AudioPlayerProvider');
  return ctx;
}; 