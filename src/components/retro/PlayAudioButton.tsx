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

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                URL.revokeObjectURL(audioRef.current.src);
            }
        };
    }, []);

    const handlePlay = async () => {
        if (audioState === 'playing' && audioRef.current) {
            audioRef.current.pause();
            return;
        }

        if (audioRef.current && audioRef.current.paused && audioState === 'idle') {
            audioRef.current.play();
            return;
        }

        setAudioState('loading');

        try {
            const { data, error } = await supabase.functions.invoke('text-to-speech', {
                body: { text: itemText },
                responseType: 'blob'
            } as any);

            if (error) throw error;

            const audioUrl = URL.createObjectURL(data);

            if (audioRef.current) {
                URL.revokeObjectURL(audioRef.current.src);
            }

            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            audio.onplay = () => setAudioState('playing');
            audio.onpause = () => setAudioState('idle');
            audio.onended = () => {
                setAudioState('idle');
            };
            audio.onerror = (e) => {
                console.error('Audio playback error', e);
                setAudioState('error');
                URL.revokeObjectURL(audioUrl);
            };

            audio.play();
        } catch (e) {
            console.error('Error fetching or playing audio:', e);
            setAudioState('error');
        }
    };

    const getIcon = () => {
        switch (audioState) {
            case 'loading':
                return <Loader2 className="h-4 w-4 animate-spin" />;
            case 'playing':
                return <Pause className="h-4 w-4" />;
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