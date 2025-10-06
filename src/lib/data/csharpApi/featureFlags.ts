import { fetchApi } from '@/lib/data/csharpApi/utils';

export async function apiGetFeatureFlags(): Promise<{ items: Array<{ flagName: string; description?: string | null; isEnabled: boolean }> }> {
    const res = await fetchApi(`/api/featureflags`);
    return res.json();
}

export async function apiUpdateFeatureFlag(flagName: string, isEnabled: boolean): Promise<void> {
    const res = await fetchApi(`/api/featureflags/${encodeURIComponent(flagName)}`, {
        method: 'PATCH',
        body: JSON.stringify(isEnabled)
    });
    return res.json();
}