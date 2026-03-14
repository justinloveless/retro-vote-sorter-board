import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useSubscription } from '@/hooks/useSubscription';

type FeatureFlags = {
    [key: string]: boolean;
};

type TierFeatureFlags = {
    [tier: string]: { featureFlags?: FeatureFlags };
};

interface FeatureFlagContextType {
    flags: FeatureFlags;
    isFeatureEnabled: (flagName: string) => boolean;
    loading: boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

export const FeatureFlagProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [flags, setFlags] = useState<FeatureFlags>({});
    const [tierFeatureFlags, setTierFeatureFlags] = useState<TierFeatureFlags>({});
    const [loading, setLoading] = useState(true);
    const { tier, loading: tierLoading } = useSubscription();

    // Fetch tier_limits from app_config for per-tier feature flags
    useEffect(() => {
        const fetchTierFlags = async () => {
            try {
                const { data, error } = await supabase
                    .from('app_config')
                    .select('value')
                    .eq('key', 'tier_limits')
                    .maybeSingle();
                if (error || !data?.value) return;
                const parsed = JSON.parse(data.value);
                setTierFeatureFlags(parsed);
            } catch (e) {
                console.error('Error fetching tier feature flags:', e);
            }
        };
        fetchTierFlags();
    }, []);

    useEffect(() => {
        let channel: RealtimeChannel;

        const setupFlags = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('feature_flags')
                    .select('flag_name, is_enabled');

                if (error) throw error;

                const flagsObject = (data || []).reduce((acc, flag) => {
                    acc[flag.flag_name] = flag.is_enabled;
                    return acc;
                }, {} as FeatureFlags);
                setFlags(flagsObject);
            } catch (error) {
                console.error("Error fetching initial feature flags:", error);
            } finally {
                setLoading(false);
            }

            channel = supabase
                .channel('feature-flags-realtime')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'feature_flags' },
                    (payload) => {
                        switch (payload.eventType) {
                            case 'INSERT':
                            case 'UPDATE': {
                                const flag = payload.new as { flag_name: string; is_enabled: boolean };
                                setFlags(currentFlags => ({
                                    ...currentFlags,
                                    [flag.flag_name]: flag.is_enabled
                                }));
                                break;
                            }
                            case 'DELETE': {
                                const deletedFlag = payload.old as { flag_name: string };
                                setFlags(currentFlags => {
                                    const newFlags = { ...currentFlags };
                                    delete newFlags[deletedFlag.flag_name];
                                    return newFlags;
                                });
                                break;
                            }
                        }
                    }
                )
                .subscribe();
        };

        setupFlags();

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, []);

    const isFeatureEnabled = useCallback((flagName: string) => {
        // 1. Check global toggle - if off globally, feature is off
        const globalEnabled = flags[flagName] ?? false;
        if (!globalEnabled) return false;

        // 2. Check tier-specific feature flags
        const tierConfig = tierFeatureFlags[tier];
        if (tierConfig?.featureFlags && flagName in tierConfig.featureFlags) {
            return tierConfig.featureFlags[flagName] ?? false;
        }

        // If no tier-specific override exists, the global flag being on is sufficient
        return true;
    }, [flags, tierFeatureFlags, tier]);

    return (
        <FeatureFlagContext.Provider value={{ flags, isFeatureEnabled, loading: loading || tierLoading }}>
            {children}
        </FeatureFlagContext.Provider>
    );
};

export const useFeatureFlags = () => {
    const context = useContext(FeatureFlagContext);
    if (context === undefined) {
        throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
    }
    return context;
};
