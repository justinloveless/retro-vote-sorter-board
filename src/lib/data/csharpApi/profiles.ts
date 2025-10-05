import { getApiBaseUrl } from '@/config/environment';
import { getSupabaseAccessToken } from '@/lib/data/csharpApi/utils';

export type ProfileItem = {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
    role: string | null;
    themePreference: string | null;
    backgroundPreference: any | null;
};

export type ProfileResponse = {
    profile: ProfileItem;
};

export type ProfilesResponse = {
    items: ProfileItem[];
};

export async function apiGetProfile(userId: string): Promise<ProfileResponse> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/profiles/${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

export async function apiGetProfilesByIds(userIds: string[]): Promise<ProfilesResponse> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();

    const params = new URLSearchParams();
    userIds.forEach(id => params.append('userIds', id));

    const res = await fetch(`${base}/api/profiles?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

export async function apiUpdateProfile(
    userId: string,
    updates: {
        fullName?: string;
        avatarUrl?: string;
        themePreference?: string;
        backgroundPreference?: any;
    }
): Promise<ProfileResponse> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/profiles/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

export async function apiUpsertProfile(
    userId: string,
    data: {
        fullName?: string;
        avatarUrl?: string;
        themePreference?: string;
        backgroundPreference?: any;
    }
): Promise<void> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/profiles/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
}
