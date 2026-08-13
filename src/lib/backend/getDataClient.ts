import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import {
  fetchBackendProviderConfig,
  getViteApiBaseUrl,
  resolveBackendMode,
} from './config';
import type { BackendMode, BackendProviderConfig } from './types';

export type DataClient = SupabaseClient<Database>;

export interface ResolvedBackendClient {
  mode: BackendMode;
  config: BackendProviderConfig;
  /**
   * Data client. Phase 2: still hosted Supabase for table CRUD in both modes.
   * Auth switches via `src/lib/auth/client.ts` when mode is selfhosted.
   */
  client: DataClient;
  apiBaseUrl: string;
}

/**
 * Facade for choosing hosted Supabase vs self-hosted clients.
 *
 * Phase 2: auth uses Node `/auth/v1/*` when mode is selfhosted (see
 * `src/lib/auth/client.ts`). Table CRUD still uses hosted Supabase until Phase 3.
 */
export async function getDataClient(): Promise<ResolvedBackendClient> {
  const config = await fetchBackendProviderConfig();
  const mode = resolveBackendMode(config);
  const apiBaseUrl = config.selfHostedApiBaseUrl || getViteApiBaseUrl();

  return {
    mode,
    config,
    client: supabase,
    apiBaseUrl,
  };
}

/** Synchronous helper for call sites that already use the hosted client. */
export function getHostedSupabaseClient(): DataClient {
  return supabase;
}
