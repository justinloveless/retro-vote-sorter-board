/**
 * Helper to create authenticated Supabase proxy client instances.
 */

import { supabase } from '../../../integrations/supabase/client';
import { createSupabaseProxyClient, SupabaseProxyClient } from './supabaseProxyClient';

/**
 * Get an authenticated Supabase proxy client instance.
 * Uses the current user's access token from the Supabase session.
 */
export async function getAuthenticatedProxyClient(): Promise<SupabaseProxyClient> {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token || null;
    return createSupabaseProxyClient(accessToken);
}

/**
 * Create a proxy client with a specific access token.
 */
export function createAuthenticatedProxyClient(accessToken: string | null): SupabaseProxyClient {
    return createSupabaseProxyClient(accessToken);
}

