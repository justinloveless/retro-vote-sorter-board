import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type FeatureFlags = {
    [key: string]: boolean;
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
    const { tier } = useSubscription();

    useEffect(() => {
        let channel: RealtimeChannel;

        const setupFlags = async () => {
            setLoading(true);
            try {
                const [flagsRes, configRes] = await Promise.all([
                    supabase.from('feature_flags').select('flag_name, is_enabled'),
                    supabase.from('app_config').select('value').eq('key', 'tier_limits').maybeSingle(),
                ]);

                if (flagsRes.error) throw flagsRes.error;

                const flagsObject = (flagsRes.data || []).reduce((acc, flag) => {
                    acc[flag.flag_name] = flag.is_enabled;
                    return acc;
                }, {} as FeatureFlags);
                setFlags(flagsObject);

                // Extract per-tier featureFlags from tier_limits config
                if (configRes.data?.value) {
                    try {
                        const parsed = JSON.parse(configRes.data.value);
                        const tierFlags: TierFeatureFlags = {};
                        for (const t of ['free', 'pro', 'business', 'enterprise']) {
                            if (parsed[t]?.featureFlags) {
                                tierFlags[t] = parsed[t].featureFlags;
                            }
                        }
                        setTierFeatureFlags(tierFlags);
                    } catch { /* ignore parse errors */ }
                }
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
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'app_config', filter: 'key=eq.tier_limits' },
                    (payload) => {
                        const row = payload.new as { value: string };
                        try {
                            const parsed = JSON.parse(row.value);
                            const tierFlags: TierFeatureFlags = {};
                            for (const t of ['free', 'pro', 'business', 'enterprise']) {
                                if (parsed[t]?.featureFlags) {
                                    tierFlags[t] = parsed[t].featureFlags;
                                }
                            }
                            setTierFeatureFlags(tierFlags);
                        } catch { /* ignore */ }
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

    const isFeatureEnabled = (flagName: string) => {
        return flags[flagName] ?? false;
    };

    return (
        <FeatureFlagContext.Provider value={{ flags, isFeatureEnabled, loading }}>
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
