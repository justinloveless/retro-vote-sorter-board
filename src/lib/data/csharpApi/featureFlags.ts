import { getApiBaseUrl } from '@/config/environment';
import { getSupabaseAccessToken } from '@/lib/data/csharpApi/utils';

export async function apiGetFeatureFlags(): Promise<{ items: Array<{ flagName: string; description?: string | null; isEnabled: boolean }> }> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/featureflags`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

export async function apiUpdateFeatureFlag(flagName: string, isEnabled: boolean): Promise<void> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/featureflags/${encodeURIComponent(flagName)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(isEnabled)
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
}
