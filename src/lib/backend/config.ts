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

export async function fetchBackendProviderConfig(): Promise<BackendProviderConfig> {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', BACKEND_PROVIDER_CONFIG_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return parseProviderValue(data?.value);
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
