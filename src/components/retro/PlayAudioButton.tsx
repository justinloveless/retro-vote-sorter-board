import React from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, Loader2, Pause, AlertTriangle } from 'lucide-react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';

interface PlayAudioButtonProps {
    itemText: string;
}

export const PlayAudioButton: React.FC<PlayAudioButtonProps> = ({ itemText }) => {
    const { play, pause, audioState } = useAudioPlayer();

    const handleTogglePlay = () => {
        if (audioState === 'playing') {
            pause();
        } else {
            play(itemText);
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
            onClick={handleTogglePlay}
            disabled={audioState === 'loading'}
            className="h-8 w-8 p-0"
            title={audioState === 'playing' ? "Pause" : "Read aloud"}
        >
            {getIcon()}
        </Button>
    );
}; 