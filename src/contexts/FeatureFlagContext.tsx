import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'react-router-dom';

type FeatureFlags = {
    [key: string]: boolean;
};

type TierFeatureFlags = {
    [tier: string]: { featureFlags?: FeatureFlags };
};

interface FeatureFlagContextType {
    flags: FeatureFlags;
    isFeatureEnabled: (flagName: string, options?: { teamId?: string | null }) => boolean;
    loading: boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

export const FeatureFlagProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [flags, setFlags] = useState<FeatureFlags>({});
    const [tierFeatureFlags, setTierFeatureFlags] = useState<TierFeatureFlags>({});
    const [userOverrides, setUserOverrides] = useState<Record<string, 'enabled' | 'disabled'>>({});
    const [teamOverrides, setTeamOverrides] = useState<Record<string, 'enabled' | 'disabled'>>({});
    const [loading, setLoading] = useState(true);
    const { tier, loading: tierLoading } = useSubscription();
    const { profile } = useAuth();
    const location = useLocation();

    const activeTeamIdFromRoute = useCallback(() => {
        const match = location.pathname.match(/^\/teams\/([^/]+)/);
        return match?.[1] ?? null;
    }, [location.pathname]);

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

    const loadOverrides = useCallback(async () => {
        const userId = profile?.id;
        if (!userId) {
            setUserOverrides({});
            setTeamOverrides({});
            return;
        }

        const activeTeamId = activeTeamIdFromRoute();
        try {
            const [{ data: userData, error: userError }, teamResult] = await Promise.all([
                supabase
                    .from('feature_flag_user_overrides')
                    .select('flag_name, state')
                    .eq('user_id', userId),
                activeTeamId
                    ? supabase
                        .from('feature_flag_team_overrides')
                        .select('flag_name, state')
                        .eq('team_id', activeTeamId)
                    : Promise.resolve({ data: [], error: null }),
            ]);

            if (userError) throw userError;
            if (teamResult.error) throw teamResult.error;

            const nextUser: Record<string, 'enabled' | 'disabled'> = {};
            (userData || []).forEach((row) => {
                if (row.state === 'enabled' || row.state === 'disabled') {
                    nextUser[row.flag_name] = row.state;
                }
            });

            const nextTeam: Record<string, 'enabled' | 'disabled'> = {};
            (teamResult.data || []).forEach((row) => {
                if (row.state === 'enabled' || row.state === 'disabled') {
                    nextTeam[row.flag_name] = row.state;
                }
            });

            setUserOverrides(nextUser);
            setTeamOverrides(nextTeam);
        } catch (error) {
            console.error('Error loading feature overrides:', error);
            setUserOverrides({});
            setTeamOverrides({});
        }
    }, [profile?.id, activeTeamIdFromRoute]);

    useEffect(() => {
        let channel: RealtimeChannel;

        const setupFlags = async () => {
            setLoading(true);
            try {
                const [{ data, error }] = await Promise.all([
                    supabase
                    .from('feature_flags')
                    .select('flag_name, is_enabled'),
                    loadOverrides(),
                ]);

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
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'feature_flag_user_overrides' },
                    () => {
                        void loadOverrides();
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'feature_flag_team_overrides' },
                    () => {
                        void loadOverrides();
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
    }, [loadOverrides]);

    useEffect(() => {
        void loadOverrides();
    }, [loadOverrides]);

    const isFeatureEnabled = useCallback((flagName: string, _options?: { teamId?: string | null }) => {
        // 1. User override (highest precedence)
        const userOverride = userOverrides[flagName];
        if (userOverride === 'enabled') return true;
        if (userOverride === 'disabled') return false;

        // 2. Team override. If a teamId is provided and doesn't match active route context,
        // fetches are handled by the caller route; this map reflects current route team context.
        const teamOverride = teamOverrides[flagName];
        if (teamOverride === 'enabled') return true;
        if (teamOverride === 'disabled') return false;

        // 3. Tier override falls back to global default when no explicit user/team override exists.
        const globalEnabled = flags[flagName] ?? false;
        if (!globalEnabled) return false;

        const tierConfig = tierFeatureFlags[tier];
        if (tierConfig?.featureFlags && flagName in tierConfig.featureFlags) {
            return tierConfig.featureFlags[flagName] ?? false;
        }

        // 4. Global flag default.
        return true;
    }, [userOverrides, teamOverrides, flags, tierFeatureFlags, tier]);

    return (
        <FeatureFlagContext.Provider
            value={{ flags, isFeatureEnabled, loading: loading || tierLoading }}
        >
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
