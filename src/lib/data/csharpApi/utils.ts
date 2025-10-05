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
