import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sparkles, Loader2, Play, Pause, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AudioSummaryState } from '@/hooks/useRetroBoard';
import { cn } from '@/lib/utils';

interface ColumnSummaryProps {
    items: { id: string; text: string }[];
    columnTitle: string;
    columnId: string;
    presenceChannel?: any;
    audioSummaryState: AudioSummaryState | null;
    updateAudioSummaryState: (state: AudioSummaryState | null) => void;
}

const NARRATION_STYLES = [
    { label: 'Default', value: 'default' },
    { label: 'Formal', value: 'formal' },
    { label: 'Humorous', value: 'humorous' },
    { label: 'Jackbox Announcer', value: 'jackbox' },
];

export const ColumnSummary: React.FC<ColumnSummaryProps> = ({
    items,
    columnTitle,
    columnId,
    presenceChannel,
    audioSummaryState,
    updateAudioSummaryState,
}) => {
    const { play, pause, resume, audioState, stop, error } = useAudioPlayer();
    const { toast } = useToast();

    const isThisColumnActive = audioSummaryState?.columnId === columnId;

    // This effect synchronizes remote actions to the local player
    useEffect(() => {
        if (!isThisColumnActive) {
            if (audioState !== 'idle') {
                stop();
            }
            return;
        }

        const globalStatus = audioSummaryState?.status;

        if (globalStatus === 'playing' && audioState === 'paused') {
            resume();
        } else if (globalStatus === 'paused' && audioState === 'playing') {
            pause();
        } else if (globalStatus === 'generating' && audioState !== 'idle') {
            stop();
        }

    }, [audioSummaryState, isThisColumnActive, audioState, resume, pause, stop]);

    // This effect handles the initial loading of the audio when a script is ready
    useEffect(() => {
        if (isThisColumnActive && audioSummaryState?.status === 'ready' && audioSummaryState.script && audioState === 'idle') {
            play(audioSummaryState.script, false);
        }
    }, [audioSummaryState, isThisColumnActive, audioState, play]);

    // This effect cleans up the global state when audio ends or errors out
    useEffect(() => {
        if (isThisColumnActive && (audioState === 'idle' || audioState === 'error')) {
            if (audioSummaryState?.status === 'playing' || audioSummaryState?.status === 'paused') {
                updateAudioSummaryState(null);
            }
        }
    }, [audioState, isThisColumnActive, audioSummaryState, updateAudioSummaryState]);

    const handleStyleSelect = async (style: string) => {
        if (items.length === 0) {
            toast({
                title: "Column is empty",
                description: "Add some items to the column to generate a summary.",
            });
            return;
        }

        // Announce intent to generate
        updateAudioSummaryState({ columnId, status: 'generating' });

        try {
            const { data, error } = await supabase.functions.invoke('generate-script', {
                body: { items, columnTitle, style },
            });

            if (error) throw error;
            if (!data.script) throw new Error("The generated script was empty.");

            // Announce that the script is ready for all clients
            updateAudioSummaryState({ columnId, status: 'ready', script: data.script });

        } catch (error) {
            console.error(`Error generating ${style} script:`, error);
            toast({
                title: `Failed to generate ${style} summary`,
                description: error.message,
                variant: "destructive",
            });
            // Clear global state on error
            updateAudioSummaryState(null);
        }
    };

    const handleTogglePlayPause = () => {
        if (!isThisColumnActive) return;

        const currentStatus = audioSummaryState?.status;
        const script = audioSummaryState?.script;

        if (currentStatus === 'paused' || currentStatus === 'ready') {
            updateAudioSummaryState({ columnId, status: 'playing', script });
        } else if (currentStatus === 'playing') {
            updateAudioSummaryState({ columnId, status: 'paused', script });
        }
    };

    const isLoading = isThisColumnActive && (audioSummaryState?.status === 'generating' || audioState === 'loading');
    const isPlaying = isThisColumnActive && audioState === 'playing';
    const isPaused = isThisColumnActive && audioState === 'paused';
    // The "ready" state is now purely when the player is loaded and paused.
    const isReady = isThisColumnActive && isPaused;

    const isAnyColumnActive = audioSummaryState !== null;
    const isDisabled = (isAnyColumnActive && !isThisColumnActive) || isLoading;

    const getButtonIcon = () => {
        if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
        if (isPlaying) return <Pause className="h-4 w-4" />;
        if (isPaused) return <Play className="h-4 w-4" />;
        // If we have a script but are paused, show play icon
        if (isThisColumnActive && audioSummaryState?.script && audioState === 'paused') return <Play className="h-4 w-4" />;
        return <Sparkles className="h-4 w-4" />;
    };

    if (error) {
        // Handle error state specifically
    }

    // Determine the primary display mode based on local audio state and global active state
    if (isThisColumnActive && (isPlaying || isPaused || isLoading)) {
        return (
            <div className="relative group">
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "h-8",
                        { "bg-purple-100 dark:bg-purple-800/20": isReady && !isPlaying }
                    )}
                    onClick={handleTogglePlayPause}
                    disabled={isLoading}
                >
                    <div className="relative z-10 flex items-center">
                        {getButtonIcon()}
                        <span className="ml-2 hidden sm:inline">Summarize</span>
                    </div>
                </Button>
                {isReady && !isPlaying && (
                    <div className="absolute inset-0 bg-white/10 dark:bg-white/5 animate-shine group-hover:animate-none -z-1" />
                )}
            </div>
        );
    }

    // Default state: Dropdown menu to select a style
    return (
        <div className="relative group">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8" disabled={isDisabled}>
                        {getButtonIcon()}
                        <span className="ml-2 hidden sm:inline">Summarize</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {NARRATION_STYLES.map((style) => (
                        <DropdownMenuItem
                            key={style.value}
                            onClick={() => handleStyleSelect(style.value)}
                            disabled={isDisabled}
                        >
                            {style.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}; 