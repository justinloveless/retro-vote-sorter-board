import { Sparkles } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";


const NARRATION_STYLES = [
    { label: 'Default', value: 'default' },
    { label: 'Formal', value: 'formal' },
    { label: 'Humorous', value: 'humorous' },
    { label: 'Jackbox Announcer', value: 'jackbox' },
];

interface SummaryButtonProps {
    items: { id: string; text: string }[];
    columnTitle: string;
}

export const SummaryButton: React.FC<SummaryButtonProps> = ({ items, columnTitle }) => {

    const { playAudioUrl, pause, resume, audioState, stop, error } = useAudioPlayer();
    const styleSelected = async (style: string) => {

        // Use fetch directly instead of supabase.functions.invoke
        const response = await fetch(`https://nwfwbjmzbwuyxehindpv.supabase.co/functions/v1/generate-audio-summary`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
            body: JSON.stringify({ items, columnTitle, style }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Function error:', error);
            return;
        }

        // Get the audio data as a blob
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        await playAudioUrl(audioUrl);
    }

    return (
        <div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8">
                        <Sparkles className="w-4 h-4" />
                        <span>Summarize</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {NARRATION_STYLES.map((style) => (
                        <DropdownMenuItem
                            key={style.value}
                            onClick={() => styleSelected(style.value)}
                        >
                            {style.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};