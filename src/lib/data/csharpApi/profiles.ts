import { fetchApi } from '@/lib/data/csharpApi/utils';

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
    const res = await fetchApi(`/api/profiles/${userId}`);
    return res.json();
}

export async function apiGetProfilesByIds(userIds: string[]): Promise<ProfilesResponse> {
    const res = await fetchApi(`/api/profiles`, {
        params: { userIds: userIds.join(',') }
    });
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
    const res = await fetchApi(`/api/profiles/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
    });
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
    const res = await fetchApi(`/api/profiles/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
    return res.json();
}
