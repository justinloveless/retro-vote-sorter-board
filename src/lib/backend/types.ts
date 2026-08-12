export type BackendMode = 'supabase' | 'selfhosted';

export interface BackendProviderConfig {
  mode: BackendMode;
  selfHostedApiBaseUrl: string;
}

export const DEFAULT_BACKEND_PROVIDER: BackendProviderConfig = {
  mode: 'supabase',
  selfHostedApiBaseUrl: '',
};

export const BACKEND_PROVIDER_CONFIG_KEY = 'backend_provider';

export const BACKEND_SESSION_OVERRIDE_KEY = 'retroscope.backend.sessionOverride';

export interface BackendHealthChecks {
  api?: { ok: boolean; error?: string };
  postgres?: { ok: boolean; error?: string };
  postgrest?: { ok: boolean; error?: string; status?: number };
  realtime?: { ok: boolean; error?: string };
}

export interface BackendStatusResponse {
  modeHint: BackendMode | string;
  selfHostedApiBaseUrl: string | null;
  checks: BackendHealthChecks;
  timestamp: string;
}
