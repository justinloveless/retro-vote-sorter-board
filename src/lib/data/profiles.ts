import { supabase } from '@/integrations/supabase/client';
import { shouldUseCSharpApi } from '@/config/environment';
import { ProfileRecord } from './types';
import { client } from './dataClient.ts';

export async function fetchProfile(userId: string): Promise<ProfileRecord | null> {
    // if (shouldUseCSharpApi()) {
    //     const { apiGetProfile } = await import('@/lib/data/csharpApi/apiClient');
    //     try {
    //         const response = await apiGetProfile(userId);
    //         return {
    //             id: response.profile.id,
    //             full_name: response.profile.fullName,
    //             avatar_url: response.profile.avatarUrl,
    //             role: (response.profile.role as 'user' | 'admin') || null,
    //             theme_preference: response.profile.themePreference,
    //             background_preference: response.profile.backgroundPreference
    //         };
    //     } catch (error) {
    //         console.error('Error fetching profile from API:', error);
    //         return null;
    //     }
    // }

    try {
        const { data: profileData, error } = await client
            .from('profiles')
            .select('id, full_name, avatar_url, role, theme_preference, background_preference')
            .eq('id', userId)
            .single();

        if (error) {
            throw error;
        }

        return profileData;
    } catch (error) {
        console.error('Error fetching profile from Supabase:', error);
        return null;
    }
}

export async function fetchProfilesByIds(userIds: string[]): Promise<ProfileRecord[]> {
    if (shouldUseCSharpApi()) {
        const { apiGetProfilesByIds } = await import('@/lib/data/csharpApi/apiClient');
        try {
            const response = await apiGetProfilesByIds(userIds);
            return response.items.map(item => ({
                id: item.id,
                full_name: item.fullName,
                avatar_url: item.avatarUrl,
                role: (item.role as 'user' | 'admin') || null,
                theme_preference: item.themePreference,
                background_preference: item.backgroundPreference
            }));
        } catch (error) {
            console.error('Error fetching profiles from API:', error);
            return [];
        }
    }

    try {
        const { data: profilesData, error } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, role, theme_preference, background_preference')
            .in('id', userIds);

        if (error) {
            throw error;
        }

        return (profilesData || []) as ProfileRecord[];
    } catch (error) {
        console.error('Error fetching profiles from Supabase:', error);
        return [];
    }
}

export async function updateProfile(userId: string, updates: {
    full_name?: string;
    avatar_url?: string;
    theme_preference?: string;
    background_preference?: any;
}): Promise<ProfileRecord | null> {
    if (shouldUseCSharpApi()) {
        const { apiUpdateProfile } = await import('@/lib/data/csharpApi/apiClient');
        try {
            const response = await apiUpdateProfile(userId, {
                fullName: updates.full_name,
                avatarUrl: updates.avatar_url,
                themePreference: updates.theme_preference,
                backgroundPreference: updates.background_preference
            });
            return {
                id: response.profile.id,
                full_name: response.profile.fullName,
                avatar_url: response.profile.avatarUrl,
                role: (response.profile.role as 'user' | 'admin') || null,
                theme_preference: response.profile.themePreference,
                background_preference: response.profile.backgroundPreference
            };
        } catch (error) {
            console.error('Error updating profile from API:', error);
            throw error;
        }
    }

    try {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data as ProfileRecord;
    } catch (error) {
        console.error('Error updating profile from Supabase:', error);
        throw error;
    }
}

export async function upsertProfile(userId: string, data: {
    full_name?: string;
    avatar_url?: string;
    theme_preference?: string;
    background_preference?: any;
}): Promise<void> {
    if (shouldUseCSharpApi()) {
        const { apiUpsertProfile } = await import('@/lib/data/csharpApi/apiClient');
        try {
            await apiUpsertProfile(userId, {
                fullName: data.full_name,
                avatarUrl: data.avatar_url,
                themePreference: data.theme_preference,
                backgroundPreference: data.background_preference
            });
            return;
        } catch (error) {
            console.error('Error upserting profile from API:', error);
            throw error;
        }
    }

    try {
        const { error } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                ...data
            });

        if (error) {
            throw error;
        }
    } catch (error) {
        console.error('Error upserting profile from Supabase:', error);
        throw error;
    }
}
