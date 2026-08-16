import { supabase } from '@/integrations/supabase/client';
import { getAuthClient, getCachedAuthBackendMode } from '@/lib/auth/client';
import {
  createFunctionsClient,
  type SelfHostedFunctionsClient,
} from '@/lib/backend/selfhosted/functionsClient';
import {
  createRestClient,
  type SelfHostedRestClient,
} from '@/lib/backend/selfhosted/restClient';
import {
  createStorageClient,
  type SelfHostedStorageClient,
} from '@/lib/backend/selfhosted/storageClient';

/**
 * Hybrid self-hosted data client (Phase 4):
 * - `.from()` / `.rpc()` → local PostgREST via Node `/rest/v1`
 * - `.storage` → Node Docker volume (`/storage/v1/object/*`)
 * - `.functions` → Node P0 ports (`/functions/v1/*`); Stripe/Jira/Slack may 501
 * - `.channel()` → hosted Supabase temporarily (Phase 5 realtime)
 * - `.auth` → FE auth facade (Node `/auth/v1` when mode is selfhosted)
 */
export type SelfHostedDataClient = SelfHostedRestClient & {
  auth: ReturnType<typeof getAuthClient>;
  channel: typeof supabase.channel;
  removeChannel: typeof supabase.removeChannel;
  getChannels: typeof supabase.getChannels;
  functions: SelfHostedFunctionsClient;
  storage: SelfHostedStorageClient;
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
  const storage = createStorageClient(apiBaseUrl, resolveAccessToken);
  const functions = createFunctionsClient(apiBaseUrl, resolveAccessToken);

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
    functions,
    storage,
    realtime: supabase.realtime,
  };
}

/** @deprecated internal helper for debugging */
export function isSelfHostedDataMode(): boolean {
  return getCachedAuthBackendMode() === 'selfhosted';
}
