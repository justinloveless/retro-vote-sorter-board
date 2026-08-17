import { supabase } from '@/integrations/supabase/client';
import {
  BACKEND_PROVIDER_CONFIG_KEY,
  BACKEND_SESSION_OVERRIDE_KEY,
  DEFAULT_BACKEND_PROVIDER,
  type BackendMode,
  type BackendProviderConfig,
} from './types';

function parseProviderValue(raw: string | null | undefined): BackendProviderConfig {
  if (!raw) {
    return { ...DEFAULT_BACKEND_PROVIDER };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<BackendProviderConfig>;
    const mode: BackendMode = parsed.mode === 'selfhosted' ? 'selfhosted' : 'supabase';
    return {
      mode,
      selfHostedApiBaseUrl:
        typeof parsed.selfHostedApiBaseUrl === 'string'
          ? parsed.selfHostedApiBaseUrl
          : DEFAULT_BACKEND_PROVIDER.selfHostedApiBaseUrl,
    };
  } catch {
    return { ...DEFAULT_BACKEND_PROVIDER };
  }
}

function parseProviderObject(raw: unknown): BackendProviderConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Partial<BackendProviderConfig>;
  if (parsed.mode !== 'supabase' && parsed.mode !== 'selfhosted') return null;
  return {
    mode: parsed.mode,
    selfHostedApiBaseUrl:
      typeof parsed.selfHostedApiBaseUrl === 'string'
        ? parsed.selfHostedApiBaseUrl
        : DEFAULT_BACKEND_PROVIDER.selfHostedApiBaseUrl,
  };
}

/**
 * Hosted Supabase app_config is often admin-only via RLS. Non-admins then get
 * an empty read and silently default to supabase while admins use selfhosted.
 * Fall back to the public Node advertisement so every browser agrees.
 */
async function fetchProviderFromSelfHostedApi(): Promise<BackendProviderConfig | null> {
  const apiBase = getViteApiBaseUrl();
  if (!apiBase) return null;
  try {
    const res = await fetch(`${apiBase}/api/backend-provider`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return parseProviderObject(await res.json());
  } catch {
    return null;
  }
}

export async function fetchBackendProviderConfig(): Promise<BackendProviderConfig> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', BACKEND_PROVIDER_CONFIG_KEY)
      .maybeSingle();

    if (!error && data?.value) {
      return parseProviderValue(data.value);
    }
  } catch {
    // Fall through to Node advertisement.
  }

  const fromApi = await fetchProviderFromSelfHostedApi();
  if (fromApi) {
    return fromApi;
  }

  return { ...DEFAULT_BACKEND_PROVIDER };
}

export async function saveBackendProviderConfig(
  config: BackendProviderConfig
): Promise<BackendProviderConfig> {
  const value = JSON.stringify({
    mode: config.mode,
    selfHostedApiBaseUrl: config.selfHostedApiBaseUrl ?? '',
  });

  const { error } = await supabase
    .from('app_config')
    .upsert({ key: BACKEND_PROVIDER_CONFIG_KEY, value }, { onConflict: 'key' });

  if (error) {
    throw error;
  }

  // Mirror onto the self-hosted API so non-admins (blocked by hosted RLS) still
  // observe the same mode via GET /api/backend-provider.
  const apiBase = (config.selfHostedApiBaseUrl || getViteApiBaseUrl()).replace(/\/$/, '');
  if (apiBase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      // Prefer selfhosted session token when already in that mode.
      let authToken = token;
      try {
        const raw = localStorage.getItem('retroscope.selfhosted.session');
        if (raw) {
          const parsed = JSON.parse(raw) as { access_token?: string };
          if (parsed.access_token) authToken = parsed.access_token;
        }
      } catch {
        // ignore
      }
      if (authToken) {
        await fetch(`${apiBase}/api/backend-provider`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            mode: config.mode,
            selfHostedApiBaseUrl: config.selfHostedApiBaseUrl ?? apiBase,
          }),
        });
      }
    } catch {
      // Hosted save already succeeded; mirror is best-effort.
    }
  }

  return {
    mode: config.mode === 'selfhosted' ? 'selfhosted' : 'supabase',
    selfHostedApiBaseUrl: config.selfHostedApiBaseUrl ?? '',
  };
}

export function getSessionBackendOverride(): BackendMode | null {
  try {
    const raw = sessionStorage.getItem(BACKEND_SESSION_OVERRIDE_KEY);
    if (raw === 'supabase' || raw === 'selfhosted') {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function setSessionBackendOverride(mode: BackendMode | null): void {
  try {
    if (!mode) {
      sessionStorage.removeItem(BACKEND_SESSION_OVERRIDE_KEY);
      return;
    }
    sessionStorage.setItem(BACKEND_SESSION_OVERRIDE_KEY, mode);
  } catch {
    // Ignore sessionStorage failures (private mode, etc.)
  }
}

/** Effective mode: admin session preview override wins over persisted app_config. */
export function resolveBackendMode(persisted: BackendProviderConfig): BackendMode {
  return getSessionBackendOverride() ?? persisted.mode;
}

export function getViteApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return (fromEnv || '').replace(/\/$/, '');
}
