import { getApiBaseUrl } from '../../../config/environment.ts';
import { getAuthSession } from '../dataClient';

/**
 * Gets the current Supabase access token from the session
 * @returns Promise<string> - The access token
 * @throws Error if no valid session is found
 */
export async function getSupabaseAccessToken(): Promise<string> {
    const { data: { session }, error } = await getAuthSession();

    if (error) {
        throw new Error(`Failed to get session: ${error.message}`);
    }

    if (!session?.access_token) {
        throw new Error('No valid session found');
    }

    return session.access_token;
}

export async function fetchApi(url: string, options: RequestInit & { params?: Record<string, string> } = {}): Promise<Response> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    if (!url.startsWith('/')) {
        url = `/${url}`;
    }
    if (options.params) {
        url += `?${new URLSearchParams(options.params).toString()}`;
    }
    const res = await fetch(`${base}${url}`, {
        ...options,
        method: options.method || 'GET',
        headers: { Authorization: `Bearer ${token}`, ...options.headers },
        body: options.body
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res;
}
