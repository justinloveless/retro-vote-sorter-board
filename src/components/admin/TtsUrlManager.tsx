import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const TTS_CONFIG_KEY = 'SELF_HOSTED_TTS_URL';

export const TtsUrlManager: React.FC = () => {
    const [ttsUrl, setTtsUrl] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const fetchTtsUrl = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('app_config')
                    .select('value')
                    .eq('key', TTS_CONFIG_KEY)
                    .single();

                if (error && error.code !== 'PGRST116') { // PGRST116 = 'exact one row not found'
                    throw error;
                }
                if (data) {
                    setTtsUrl(data.value || '');
                }
            } catch (error) {
                toast({
                    title: 'Error fetching TTS URL',
                    description: error.message,
                    variant: 'destructive',
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchTtsUrl();
    }, [toast]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('app_config')
                .upsert({ key: TTS_CONFIG_KEY, value: ttsUrl }, { onConflict: 'key' });

            if (error) throw error;

            toast({
                title: 'Success',
                description: 'TTS Server URL saved successfully.',
            });
        } catch (error) {
            toast({
                title: 'Error saving TTS URL',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Text-to-Speech Server Configuration</CardTitle>
                <CardDescription>
                    Update the URL for the self-hosted Coqui TTS server. This change will take effect immediately.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col space-y-4">
                    <label htmlFor="tts-url" className="font-medium">TTS Server URL</label>
                    {isLoading ? (
                        <div className="flex items-center space-x-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Loading configuration...</span>
                        </div>
                    ) : (
                        <Input
                            id="tts-url"
                            value={ttsUrl}
                            onChange={(e) => setTtsUrl(e.target.value)}
                            placeholder="https://your-tts-server.ngrok-free.app/"
                        />
                    )}
                    <div className="flex justify-end">
                        <Button onClick={handleSave} disabled={isSaving || isLoading}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isSaving ? 'Saving...' : 'Save URL'}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}; 