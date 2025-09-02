import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client.ts';
import { type RealtimeChannel } from '@supabase/supabase-js';

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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let channel: RealtimeChannel;

        const setupFlags = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase.from('feature_flags').select('flag_name, is_enabled');
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
                                const newFlag = payload.new as { flag_name: string; is_enabled: boolean };
                                setFlags(currentFlags => ({
                                    ...currentFlags,
                                    [newFlag.flag_name]: newFlag.is_enabled
                                }));
                                break;
                            case 'UPDATE':
                                const updatedFlag = payload.new as { flag_name: string; is_enabled: boolean };
                                setFlags(currentFlags => ({
                                    ...currentFlags,
                                    [updatedFlag.flag_name]: updatedFlag.is_enabled
                                }));
                                break;
                            case 'DELETE':
                                const deletedFlag = payload.old as { flag_name: string };
                                setFlags(currentFlags => {
                                    const newFlags = { ...currentFlags };
                                    delete newFlags[deletedFlag.flag_name];
                                    return newFlags;
                                });
                                break;
                            default:
                                break;
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