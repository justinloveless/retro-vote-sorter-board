import { FeatureFlagRecord } from './types';
import { client } from './dataClient';
// import { supabase as client } from '@/integrations/supabase/client';

export async function fetchFeatureFlags(): Promise<FeatureFlagRecord[]> {
    // if (shouldUseCSharpApi()) {
    //     const response = await apiGetFeatureFlags();
    //     return (response.items || []).map(item => ({
    //         flag_name: item.flagName,
    //         description: item.description ?? null,
    //         is_enabled: item.isEnabled
    //     }));
    // }

    const { data, error } = await client
        .from('feature_flags')
        .select('*');
    if (error) throw error;
    return data || [];
}

export async function updateFeatureFlag(flagName: string, isEnabled: boolean): Promise<void> {
    // if (shouldUseCSharpApi()) {
    //     await apiUpdateFeatureFlag(flagName, isEnabled);
    //     return;
    // }

    const { error } = await client
        .from('feature_flags')
        .update({ is_enabled: isEnabled })
        .eq('flag_name', flagName);
    if (error) throw error;
}
