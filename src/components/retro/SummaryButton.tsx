import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { currentEnvironment } from '@/config/environment';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { getAuthSession } from '@/lib/dataClient';


const NARRATION_STYLES = [
    { label: 'Default', value: 'default' },
    { label: 'Formal', value: 'formal' },
    { label: 'Humorous', value: 'humorous' },
    { label: 'Jackbox Announcer', value: 'jackbox' },
];

interface SummaryButtonProps {
    items: { id: string; text: string }[];
    columnTitle: string;
    boardId: string;
}

export const SummaryButton: React.FC<SummaryButtonProps> = ({ items, columnTitle, boardId }) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const styleSelected = async (style: string) => {
        if (items.length === 0) {
            toast({
                title: "Column is empty",
                description: "Add some items to the column to generate a summary.",
            });
            return;
        }

        setIsLoading(true);

        try {
            // The function will broadcast the audio URL via realtime channels
            const response = await fetch(`${currentEnvironment.supabaseUrl}/functions/v1/generate-audio-summary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(await getAuthSession()).data.session?.access_token}`,
                },
                body: JSON.stringify({ items, columnTitle, style, boardId }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            const result = await response.json();

            toast({
                title: "Summary generated!",
                description: "Audio will play automatically for all users.",
            });

        } catch (error: any) {
            console.error('Function error:', error);
            toast({
                title: `Failed to generate ${style} summary`,
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="ml-1">Working...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                <span className="ml-1">Summarize</span>
                            </>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {NARRATION_STYLES.map((style) => (
                        <DropdownMenuItem
                            key={style.value}
                            onClick={() => styleSelected(style.value)}
                            disabled={isLoading}
                        >
                            {style.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};