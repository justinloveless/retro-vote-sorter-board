import { supabase } from '@/integrations/supabase/client';
import { getAuthClient, getCachedAuthBackendMode } from '@/lib/auth/client';
import {
  createRestClient,
  type SelfHostedRestClient,
} from '@/lib/backend/selfhosted/restClient';

/**
 * Hybrid self-hosted data client (Phase 3):
 * - `.from()` / `.rpc()` → local PostgREST via Node `/rest/v1`
 * - `.channel()` / `.functions` / `.storage` → hosted Supabase temporarily
 *   (realtime + edge ports land in later phases; auth is already local)
 * - `.auth` → FE auth facade (Node `/auth/v1` when mode is selfhosted)
 */
export type SelfHostedDataClient = SelfHostedRestClient & {
  auth: ReturnType<typeof getAuthClient>;
  channel: typeof supabase.channel;
  removeChannel: typeof supabase.removeChannel;
  getChannels: typeof supabase.getChannels;
  functions: typeof supabase.functions;
  storage: typeof supabase.storage;
  realtime: typeof supabase.realtime;
};

async function resolveAccessToken(): Promise<string | null> {
  try {
    const { data } = await getAuthClient().getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export function createSelfHostedDataClient(apiBaseUrl: string): SelfHostedDataClient {
  const rest = createRestClient(apiBaseUrl, resolveAccessToken);

  return {
    from: rest.from,
    rpc: rest.rpc,
    get auth() {
      return getAuthClient();
    },
    channel: (...args: Parameters<typeof supabase.channel>) => supabase.channel(...args),
    removeChannel: (...args: Parameters<typeof supabase.removeChannel>) =>
      supabase.removeChannel(...args),
    getChannels: (...args: Parameters<typeof supabase.getChannels>) =>
      supabase.getChannels(...args),
    functions: supabase.functions,
    storage: supabase.storage,
    realtime: supabase.realtime,
  };
}

/** @deprecated internal helper for debugging */
export function isSelfHostedDataMode(): boolean {
  return getCachedAuthBackendMode() === 'selfhosted';
}
