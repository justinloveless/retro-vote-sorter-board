import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';

export type AudioPlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface AudioPlayerContextType {
  audioState: AudioPlayerState;
  error: string | null;
  playAudioUrl: (audioUrl: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [audioState, setAudioState] = useState<AudioPlayerState>('idle');
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);


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
    <AudioPlayerContext.Provider value={{ audioState, error, playAudioUrl, pause, resume, stop }}>
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayerContext = () => {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('useAudioPlayerContext must be used within AudioPlayerProvider');
  return ctx;
}; 