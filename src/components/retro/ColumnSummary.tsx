import React, { useState } from 'react';
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

interface ColumnSummaryProps {
    items: { id: string; text: string }[];
    columnTitle: string;
}

const NARRATION_STYLES = ["News Anchor", "Comedian", "Roast Me", "Documentary", "Epic"];

export const ColumnSummary: React.FC<ColumnSummaryProps> = ({ items, columnTitle }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const { play, pause, audioState } = useAudioPlayer();
    const { toast } = useToast();

    const handleStyleSelect = async (style: string) => {
        if (items.length === 0) {
            toast({
                title: "Column is empty",
                description: "Add some items to the column to generate a summary.",
            });
            return;
        }

        setIsGenerating(true);

        try {
            const { data, error } = await supabase.functions.invoke('generate-script', {
                body: { items, style },
            });

            if (error) throw error;

            const { script } = data;
            if (script) {
                play(script);
            } else {
                throw new Error("The generated script was empty.");
            }

        } catch (error) {
            console.error(`Error generating ${style} script:`, error);
            toast({
                title: `Failed to generate ${style} summary`,
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleTogglePlay = () => {
        if (audioState === 'playing') {
            pause();
        } else {
            // This button is only for pause/resume, not for initiating a new summary.
            // The `play` function from the hook expects text, but we can't easily get the last script here.
            // For now, we only support pausing. A 'resume' would require more state management.
            console.warn("Resume functionality is not implemented. Only pause is available.");
        }
    };

    const isLoading = isGenerating || audioState === 'loading';

    const getButtonIcon = () => {
        if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
        if (audioState === 'playing') return <Pause className="h-4 w-4" />;
        if (audioState === 'error') return <AlertTriangle className="h-4 w-4 text-red-500" />;
        return <Sparkles className="h-4 w-4" />;
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8" disabled={isLoading}>
                    {getButtonIcon()}
                    <span className="ml-2 hidden sm:inline">Summarize</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                {NARRATION_STYLES.map((style) => (
                    <DropdownMenuItem
                        key={style}
                        onClick={() => handleStyleSelect(style)}
                        disabled={isLoading}
                    >
                        {style}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}; 