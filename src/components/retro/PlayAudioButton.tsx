import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Volume2, Loader2, Pause, AlertTriangle } from 'lucide-react';

interface PlayAudioButtonProps {
    itemText: string;
}

export const PlayAudioButton: React.FC<PlayAudioButtonProps> = ({ itemText }) => {
    const [audioState, setAudioState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // This effect ensures we clean up the audio object when the component is removed
    useEffect(() => {
        const audio = audioRef.current;
        return () => {
            if (audio) {
                audio.pause();
                audio.src = '';
            }
        };
    }, []);

    const handlePlay = async () => {
        // If audio is currently playing, pause it.
        if (audioRef.current && !audioRef.current.paused) {
            audioRef.current.pause();
            return;
        }

        // If we have already fetched the audio and it's just paused, play it.
        if (audioRef.current && audioRef.current.paused) {
            audioRef.current.play();
            return;
        }

        setAudioState('loading');

        try {
            const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`;
            const urlWithQuery = `${functionUrl}?text=${encodeURIComponent(itemText)}`;

            const { data: { session } } = await supabase.auth.getSession();

            const response = await fetch(urlWithQuery, {
                headers: {
                    Authorization: `Bearer ${session?.access_token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);

            const audio = new Audio(audioUrl);
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