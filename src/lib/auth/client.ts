import { supabase } from '@/integrations/supabase/client';
import {
  fetchBackendProviderConfig,
  getViteApiBaseUrl,
  resolveBackendMode,
} from '@/lib/backend/config';
import { createSelfHostedAuthClient } from '@/lib/backend/selfhosted/authClient';
import type { BackendMode } from '@/lib/backend/types';

export type AuthClient = ReturnType<typeof getHostedAuth> | ReturnType<typeof getSelfHostedAuth>;

let cachedMode: BackendMode | null = null;
let cachedApiBase = '';
let selfHostedClient: ReturnType<typeof createSelfHostedAuthClient> | null = null;
let modePromise: Promise<BackendMode> | null = null;

function getHostedAuth() {
  return supabase.auth;
}

function getSelfHostedAuth(apiBaseUrl: string) {
  if (!selfHostedClient || cachedApiBase !== apiBaseUrl) {
    cachedApiBase = apiBaseUrl;
    selfHostedClient = createSelfHostedAuthClient(apiBaseUrl);
  }
  return selfHostedClient;
}

/** Force the next resolve to re-read app_config / session override. */
export function invalidateAuthBackendModeCache(): void {
  cachedMode = null;
  modePromise = null;
  selfHostedClient = null;
  cachedApiBase = '';
}

/** Warm / refresh the cached backend mode used by sync auth helpers. */
export async function resolveAuthBackendMode(force = false): Promise<BackendMode> {
  if (force) {
    invalidateAuthBackendModeCache();
  }
  if (!modePromise) {
    modePromise = (async () => {
      try {
        const config = await fetchBackendProviderConfig();
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

export function getCachedAuthBackendMode(): BackendMode {
  return cachedMode ?? 'supabase';
}

/**
 * Synchronous auth client for call sites. Defaults to hosted Supabase until
 * `resolveAuthBackendMode()` has run (AuthProvider does this on mount).
 */
export function getAuthClient(): AuthClient {
  const mode = getCachedAuthBackendMode();
  if (mode === 'selfhosted') {
    const apiBase = cachedApiBase || getViteApiBaseUrl();
    if (!apiBase) {
      console.warn(
        'Self-hosted auth selected but no API base URL is configured; falling back to hosted Supabase auth'
      );
      return getHostedAuth();
    }
    return getSelfHostedAuth(apiBase);
  }
  return getHostedAuth();
}

/** Convenience wrappers matching the plan facade surface. */
export async function signInWithPassword(email: string, password: string) {
  await resolveAuthBackendMode();
  return getAuthClient().signInWithPassword({ email, password });
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string,
  emailRedirectTo: string
) {
  await resolveAuthBackendMode();
  return getAuthClient().signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo,
    },
  });
}

export async function signInWithOAuth(
  provider: 'google',
  redirectTo?: string
) {
  await resolveAuthBackendMode();
  return getAuthClient().signInWithOAuth({
    provider,
    options: redirectTo ? { redirectTo } : undefined,
  });
}

export async function resetPasswordForEmail(email: string, redirectTo: string) {
  await resolveAuthBackendMode();
  return getAuthClient().resetPasswordForEmail(email, { redirectTo });
}

export async function signOut() {
  await resolveAuthBackendMode();
  return getAuthClient().signOut();
}

export async function updateAuthUser(payload: { password?: string; data?: Record<string, unknown> }) {
  await resolveAuthBackendMode();
  return getAuthClient().updateUser(payload);
}

export async function setAuthSession(accessToken: string, refreshToken: string) {
  await resolveAuthBackendMode();
  return getAuthClient().setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
}

export async function getAuthSession() {
  await resolveAuthBackendMode();
  return getAuthClient().getSession();
}

export async function getAuthUser() {
  await resolveAuthBackendMode();
  return getAuthClient().getUser();
}

export function onAuthStateChange(
  callback: Parameters<AuthClient['onAuthStateChange']>[0]
) {
  return getAuthClient().onAuthStateChange(callback);
}
