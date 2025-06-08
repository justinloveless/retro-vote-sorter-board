import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FeatureFlag {
    flag_name: string;
    is_enabled: boolean;
}

const useFeatureFlags = () => {
    const [flags, setFlags] = useState<FeatureFlag[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchFlags = async () => {
            setLoading(true);
            setError(null);
            const { data, error } = await supabase
                .from('feature_flags')
                .select('flag_name, is_enabled');

            if (error) {
                console.error('Error fetching feature flags:', error);
                setError(error.message);
            } else {
                setFlags(data || []);
            }
            setLoading(false);
        };

        fetchFlags();
    }, []);

    const isFeatureEnabled = useCallback((flagName: string): boolean => {
        const flag = flags.find(f => f.flag_name === flagName);
        return flag ? flag.is_enabled : false;
    }, [flags]);

    return { flags, loading, error, isFeatureEnabled };
};

export default useFeatureFlags; 