import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { shouldUseCSharpApi } from '@/config/environment';
import { apiGetFeatureFlags, apiUpdateFeatureFlag } from '@/lib/apiClient';

interface FeatureFlag {
    flag_name: string;
    description: string | null;
    is_enabled: boolean;
}

export const FeatureFlagManager: React.FC = () => {
    const [flags, setFlags] = useState<FeatureFlag[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchFlags = async () => {
            setLoading(true);
            try {
                if (shouldUseCSharpApi()) {
                    const response = await apiGetFeatureFlags();
                    const mapped = (response.items || []).map(item => ({
                        flag_name: item.flagName,
                        description: item.description ?? null,
                        is_enabled: item.isEnabled
                    }));
                    setFlags(mapped);
                } else {
                    const { data, error } = await supabase
                        .from('feature_flags')
                        .select('*');
                    if (error) throw error;
                    setFlags(data || []);
                }
            } catch (error) {
                console.error('Error fetching feature flags:', error);
                toast({ title: 'Error fetching flags', variant: 'destructive' });
            }
            setLoading(false);
        };

        fetchFlags();
    }, [toast]);

    const handleToggle = async (flagName: string, isEnabled: boolean) => {
        // Optimistic update
        setFlags(currentFlags =>
            currentFlags.map(flag =>
                flag.flag_name === flagName ? { ...flag, is_enabled: isEnabled } : flag
            )
        );

        try {
            if (shouldUseCSharpApi()) {
                await apiUpdateFeatureFlag(flagName, isEnabled);
            } else {
                const { error } = await supabase
                    .from('feature_flags')
                    .update({ is_enabled: isEnabled })
                    .eq('flag_name', flagName);
                if (error) throw error;
            }
            toast({ title: 'Feature flag updated!' });
        } catch (error) {
            console.error('Error updating feature flag:', error);
            // Revert on error
            setFlags(currentFlags =>
                currentFlags.map(flag =>
                    flag.flag_name === flagName ? { ...flag, is_enabled: !isEnabled } : flag
                )
            );
            toast({ title: 'Error updating flag', description: 'Please try again.', variant: 'destructive' });
        }
    };

    if (loading) {
        return <div>Loading feature flags...</div>;
    }

    return (
        <div className="space-y-4">
            {flags.map(flag => (
                <div key={flag.flag_name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                        <Label htmlFor={flag.flag_name} className="font-bold">{flag.flag_name}</Label>
                        <p className="text-sm text-gray-500">{flag.description}</p>
                    </div>
                    <Switch
                        id={flag.flag_name}
                        checked={flag.is_enabled}
                        onCheckedChange={(checked) => handleToggle(flag.flag_name, checked)}
                    />
                </div>
            ))}
        </div>
    );
}; 