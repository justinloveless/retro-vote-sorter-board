import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    const { pause, resume, audioState, stop, error, playAudioUrl } = useAudioPlayer();
    const { toast } = useToast();
    const prevAudioState = useRef(audioState);

    useEffect(() => {
        prevAudioState.current = audioState;
    }, [audioState]);



    const isThisColumnActive = audioSummaryState?.columnId === columnId;

    // This effect synchronizes remote actions to the local player
    useEffect(() => {
        if (!isThisColumnActive) {
            // This logic is now handled by the explicit stop() call in handleStyleSelect
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
        // No auto-play when status is 'ready'. Only play on user action.
    }, [audioSummaryState, isThisColumnActive, audioState, playAudioUrl]);

    // This effect cleans up the global state when audio ends or errors out
    useEffect(() => {
        if (isThisColumnActive &&
            (audioState === 'idle' || audioState === 'error') &&
            (prevAudioState.current === 'playing' || prevAudioState.current === 'paused')
        ) {
            if (
                audioSummaryState?.status === 'playing' ||
                audioSummaryState?.status === 'paused'
            ) {
                if (
                    typeof audioSummaryState.script === 'string' &&
                    audioSummaryState.script.startsWith('blob:')
                ) {
                    URL.revokeObjectURL(audioSummaryState.script);
                }
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

        // Stop any currently playing audio before starting a new one.
        stop();

        // Announce intent to generate
        updateAudioSummaryState({ columnId, status: 'generating' });

        try {
            // Use fetch directly to get the audio as a blob
            const session = (await supabase.auth.getSession()).data.session;
            const response = await fetch(`https://nwfwbjmzbwuyxehindpv.supabase.co/functions/v1/generate-audio-summary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({ items, columnTitle, style }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            const audioBlob = await response.blob();
            if (!audioBlob || audioBlob.size === 0) throw new Error("The generated audio was empty.");

            // Store the audioBlob in state instead of the blob URL
            updateAudioSummaryState({ columnId, status: 'ready', script: audioBlob });

        } catch (error: any) {
            console.error('Error generating summary:', error);
            toast({
                title: `Failed to generate ${style} summary`,
                description: error.message,
                variant: "destructive",
            });
            // Clear global state on error
            updateAudioSummaryState(null);
        }
    };

    // Determine the primary display mode based on local audio state and global active state
    const isLoading = isThisColumnActive && (audioSummaryState?.status === 'generating' || audioState === 'loading');
    const isPlaying = isThisColumnActive && (audioState === 'playing' || audioSummaryState?.status === 'playing');
    const isPaused = isThisColumnActive && audioState === 'paused';
    const isReady = isThisColumnActive && audioSummaryState?.status === 'ready' && audioState === 'idle';
    const isAnyColumnActive = audioSummaryState !== null;
    const isDisabled = (isAnyColumnActive && !isThisColumnActive) || isLoading;

    const getButtonIcon = () => {
        if (isLoading) 
            return (
                <div className="relative z-10 flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="ml-2 hidden sm:inline">Working...</span>
                </div>
            );
        if (isPlaying) 
            return (
                <div className="relative z-10 flex items-center">
                    <Pause className="h-4 w-4" />
                    <span className="ml-2 hidden sm:inline">Pause</span>
                </div>
            );
        if (isPaused)
            return (
                <div className="relative z-10 flex items-center">
                    <Play className="h-4 w-4" />
                    <span className="ml-2 hidden sm:inline">Resume</span>
                </div>
            ); 
            if ( isReady) 
            return (
                <div className="relative z-10 flex items-center">
                    <Play className="h-4 w-4" />
                    <span className="ml-2 hidden sm:inline">Play Summary</span>
                </div>
            );
        return (
            <div className="relative z-10 flex items-center">
                <Sparkles className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">Summarize</span>
            </div>
        )
    };

    if (error) {
        // Optionally render an error state here
    }

    if ((isPlaying || isPaused || isLoading || ( audioSummaryState?.status === 'ready'))) {
        return (
            <div className="relative group">
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "h-8",
                        { "bg-purple-100 dark:bg-purple-800/20": isReady && !isPlaying }
                    )}
                    onClick={async () => {
                        const currentStatus = audioSummaryState?.status;
                        const script = audioSummaryState?.script;
                        if (currentStatus === 'paused') {
                            resume();
                            updateAudioSummaryState({ columnId, status: 'playing', script });
                        }
                        else if (currentStatus === 'ready' && script instanceof Blob) {
                            // Play audio if ready or paused and user clicks
                            const audioUrl = URL.createObjectURL(script);
                            await playAudioUrl(audioUrl);
                            // Optionally update state to 'playing'
                            updateAudioSummaryState({ columnId, status: 'playing', script });
                        } else if (currentStatus === 'playing') {
                            updateAudioSummaryState({ columnId, status: 'paused', script });
                        }
                    }}
                    disabled={isLoading}
                >
                    {getButtonIcon()}
                </Button>
                {isReady && !isPlaying && (
                    <div className="absolute inset-0 bg-white/10 dark:bg-white/5 animate-shine group-hover:animate-none -z-1" />
                )}
            </div>
        );
    } else {
    }

    // Default state: Dropdown menu to select a style
    return (
        <div className="relative group">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8" disabled={isDisabled}>
                        {getButtonIcon()}
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
