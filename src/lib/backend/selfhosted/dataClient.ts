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
  createRealtimeClient,
  type SelfHostedRealtimeChannel,
  type SelfHostedRealtimeClient,
} from '@/lib/backend/selfhosted/realtimeClient';
import {
  createStorageClient,
  type SelfHostedStorageClient,
} from '@/lib/backend/selfhosted/storageClient';

/**
 * Hybrid self-hosted data client (Phase 5):
 * - `.from()` / `.rpc()` → local PostgREST via Node `/rest/v1`
 * - `.storage` → Node Docker volume (`/storage/v1/object/*`)
 * - `.functions` → Node P0 ports (`/functions/v1/*`); Stripe/Jira/Slack may 501
 * - `.channel()` → Socket.IO realtime adapter (Phase 5)
 * - `.auth` → FE auth facade (Node `/auth/v1` when mode is selfhosted)
 */
export type SelfHostedDataClient = SelfHostedRestClient & {
  auth: ReturnType<typeof getAuthClient>;
  channel: (
    topic: string,
    opts?: Parameters<SelfHostedRealtimeClient['channel']>[1]
  ) => SelfHostedRealtimeChannel;
  removeChannel: (channel: SelfHostedRealtimeChannel) => Promise<'ok' | 'timed out' | 'error'>;
  getChannels: () => SelfHostedRealtimeChannel[];
  functions: SelfHostedFunctionsClient;
  storage: SelfHostedStorageClient;
  realtime: SelfHostedRealtimeClient;
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
  const realtime = createRealtimeClient(apiBaseUrl, resolveAccessToken);

  return {
    from: rest.from,
    rpc: rest.rpc,
    get auth() {
      return getAuthClient();
    },
    channel: (topic, opts) => realtime.channel(topic, opts),
    removeChannel: (channel) => realtime.removeChannel(channel),
    getChannels: () => realtime.getChannels(),
    functions,
    storage,
    realtime,
  };
}

/** @deprecated internal helper for debugging */
export function isSelfHostedDataMode(): boolean {
  return getCachedAuthBackendMode() === 'selfhosted';
}
