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
  /** Phase 1: always the hosted Supabase client for both modes. */
  client: DataClient;
  apiBaseUrl: string;
}

/**
 * Facade for choosing hosted Supabase vs self-hosted clients.
 *
 * Phase 1: both modes return the hosted Supabase client. Self-hosted auth/data
 * clients land in later phases; the toggle still persists mode for cutover prep.
 */
export async function getDataClient(): Promise<ResolvedBackendClient> {
  const config = await fetchBackendProviderConfig();
  const mode = resolveBackendMode(config);
  const apiBaseUrl = config.selfHostedApiBaseUrl || getViteApiBaseUrl();

  // Phase 1 dual-path: selfhosted mode still talks to hosted Supabase.
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
