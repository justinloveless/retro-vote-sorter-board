import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import {
  fetchBackendProviderConfig,
  getViteApiBaseUrl,
  resolveBackendMode,
} from './config';
import { createSelfHostedDataClient, type SelfHostedDataClient } from './selfhosted/dataClient';
import type { BackendMode, BackendProviderConfig } from './types';

/** Hosted Supabase client (full SDK). */
export type HostedDataClient = SupabaseClient<Database>;

/**
 * Facade data client. Hosted Supabase and the self-hosted hybrid have
 * incompatible generic `.from`/`.rpc` overloads; a structural `any`-backed
 * surface keeps call sites callable during dual-path migration.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DataClient = any;

export interface ResolvedBackendClient {
  mode: BackendMode;
  config: BackendProviderConfig;
  client: DataClient;
  apiBaseUrl: string;
}

let cachedMode: BackendMode | null = null;
let cachedApiBase = '';
let cachedConfig: BackendProviderConfig | null = null;
let selfHostedClient: SelfHostedDataClient | null = null;
let modePromise: Promise<BackendMode> | null = null;

function getOrCreateSelfHosted(apiBaseUrl: string): SelfHostedDataClient {
  if (!selfHostedClient || cachedApiBase !== apiBaseUrl) {
    cachedApiBase = apiBaseUrl;
    selfHostedClient = createSelfHostedDataClient(apiBaseUrl);
  }
  return selfHostedClient;
}

/** Force the next resolve to re-read app_config / session override. */
export function invalidateDataBackendModeCache(): void {
  cachedMode = null;
  cachedConfig = null;
  modePromise = null;
  selfHostedClient = null;
  cachedApiBase = '';
}

/** Warm / refresh the cached backend mode used by sync `getDb()`. */
export async function resolveDataBackendMode(force = false): Promise<BackendMode> {
  if (force) {
    invalidateDataBackendModeCache();
  }
  if (!modePromise) {
    modePromise = (async () => {
      try {
        const config = await fetchBackendProviderConfig();
        cachedConfig = config;
        cachedMode = resolveBackendMode(config);
        cachedApiBase = config.selfHostedApiBaseUrl || getViteApiBaseUrl();
      } catch {
        cachedMode = cachedMode ?? 'supabase';
      }
      return cachedMode!;
    })().finally(() => {
      modePromise = null;
    });
  }
  return modePromise;
}

export function getCachedDataBackendMode(): BackendMode {
  return cachedMode ?? 'supabase';
}

/**
 * Synchronous data client for hooks. Defaults to hosted Supabase until
 * `resolveDataBackendMode()` has run (AuthProvider / app bootstrap should call it).
 */
export function getDb(): DataClient {
  const mode = getCachedDataBackendMode();
  if (mode === 'selfhosted') {
    const apiBase = cachedApiBase || getViteApiBaseUrl();
    if (!apiBase) {
      console.warn(
        'Self-hosted data selected but no API base URL is configured; falling back to hosted Supabase'
      );
      return supabase;
    }
    return getOrCreateSelfHosted(apiBase);
  }
  return supabase;
}

/**
 * Facade for choosing hosted Supabase vs self-hosted clients.
 *
 * Phase 4: when mode is selfhosted, `.from()` / `.rpc()` hit local PostgREST
 * via Node `/rest/v1`, `.storage` hits Docker volume routes, and P0
 * `.functions` hit Node `/functions/v1/*`. Realtime still hosted until Phase 5.
 */
export async function getDataClient(): Promise<ResolvedBackendClient> {
  const config = cachedConfig ?? (await fetchBackendProviderConfig());
  const mode = await resolveDataBackendMode();
  const apiBaseUrl = config.selfHostedApiBaseUrl || getViteApiBaseUrl();

  const client: DataClient =
    mode === 'selfhosted' && apiBaseUrl
      ? getOrCreateSelfHosted(apiBaseUrl)
      : supabase;

  return {
    mode,
    config: {
      mode: config.mode,
      selfHostedApiBaseUrl: apiBaseUrl,
    },
    client,
    apiBaseUrl,
  };
}

/** Synchronous helper for call sites that already use the hosted client. */
export function getHostedSupabaseClient(): HostedDataClient {
  return supabase;
}
