import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;

const STORAGE_KEY = 'retroscope.selfhosted.session';

export interface SelfHostedAuthClient {
  signInWithPassword: (credentials: {
    email: string;
    password: string;
  }) => Promise<{ data: { user: User | null; session: Session | null }; error: Error | null }>;
  signUp: (credentials: {
    email: string;
    password: string;
    options?: { data?: Record<string, unknown>; emailRedirectTo?: string };
  }) => Promise<{ data: { user: User | null; session: Session | null }; error: Error | null }>;
  signInWithOAuth: (credentials: {
    provider: 'google';
    options?: { redirectTo?: string };
  }) => Promise<{ data: { provider: string; url: string }; error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  resetPasswordForEmail: (
    email: string,
    options?: { redirectTo?: string }
  ) => Promise<{ data: Record<string, never>; error: Error | null }>;
  updateUser: (attributes: {
    password?: string;
    data?: Record<string, unknown>;
  }) => Promise<{ data: { user: User | null }; error: Error | null }>;
  setSession: (tokens: {
    access_token: string;
    refresh_token: string;
  }) => Promise<{ data: { user: User | null; session: Session | null }; error: Error | null }>;
  getSession: () => Promise<{ data: { session: Session | null }; error: Error | null }>;
  getUser: () => Promise<{ data: { user: User | null }; error: Error | null }>;
  onAuthStateChange: (
    callback: AuthListener
  ) => { data: { subscription: { unsubscribe: () => void } } };
}

function toUser(raw: Record<string, unknown>): User {
  return {
    id: String(raw.id),
    aud: String(raw.aud ?? 'authenticated'),
    role: String(raw.role ?? 'authenticated'),
    email: (raw.email as string | null) ?? undefined,
    email_confirmed_at: (raw.email_confirmed_at as string | null) ?? undefined,
    phone: (raw.phone as string | null) ?? undefined,
    confirmed_at: (raw.confirmed_at as string | null) ?? undefined,
    last_sign_in_at: (raw.last_sign_in_at as string | null) ?? undefined,
    app_metadata: (raw.app_metadata as Record<string, unknown>) ?? {},
    user_metadata: (raw.user_metadata as Record<string, unknown>) ?? {},
    identities: (raw.identities as User['identities']) ?? [],
    created_at: String(raw.created_at ?? new Date().toISOString()),
    updated_at: String(raw.updated_at ?? new Date().toISOString()),
    is_anonymous: Boolean(raw.is_anonymous),
  } as User;
}

function toSession(payload: {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  user: Record<string, unknown>;
}): Session {
  const expiresIn = payload.expires_in ?? 3600;
  const expiresAt =
    payload.expires_at ?? Math.floor(Date.now() / 1000) + expiresIn;
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_in: expiresIn,
    expires_at: expiresAt,
    token_type: 'bearer',
    user: toUser(payload.user),
  } as Session;
}

function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function writeStoredSession(session: Session | null): void {
  try {
    if (!session) {
      localStorage.removeItem(STORAGE_KEY);
      // Keep parity with useAuth cache key
      localStorage.removeItem('session');
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem('session', JSON.stringify(session));
  } catch {
    // ignore
  }
}

function parseHashSession(): { session: Session; type?: string } | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;

  const expiresIn = Number(params.get('expires_in') || '3600');
  const type = params.get('type') || undefined;

  // Minimal user placeholder; refreshed via /auth/v1/user immediately after.
  const session = toSession({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
    user: {
      id: 'pending',
      aud: 'authenticated',
      role: 'authenticated',
      email: null,
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_anonymous: false,
    },
  });

  return { session, type };
}

export function createSelfHostedAuthClient(apiBaseUrl: string): SelfHostedAuthClient {
  const base = apiBaseUrl.replace(/\/$/, '');
  const listeners = new Set<AuthListener>();
  let currentSession: Session | null = readStoredSession();

  const emit = (event: AuthChangeEvent, session: Session | null) => {
    currentSession = session;
    writeStoredSession(session);
    for (const listener of listeners) {
      listener(event, session);
    }
  };

  const authFetch = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    const text = await response.text();
    let json: Record<string, unknown> = {};
    if (text) {
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        json = { msg: text };
      }
    }
    if (!response.ok) {
      const message =
        (json.msg as string) ||
        (json.error_description as string) ||
        (json.error as string) ||
        `Auth request failed (${response.status})`;
      throw new Error(message);
    }
    return json;
  };

  const hydrateUser = async (session: Session): Promise<Session> => {
    const user = await authFetch('/auth/v1/user', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    return {
      ...session,
      user: toUser(user),
    };
  };

  // Consume OAuth / recovery hash on construction
  void (async () => {
    const fromHash = parseHashSession();
    if (!fromHash) {
      if (currentSession) {
        emit('INITIAL_SESSION', currentSession);
      }
      return;
    }

    try {
      const hydrated = await hydrateUser(fromHash.session);
      const event: AuthChangeEvent =
        fromHash.type === 'recovery' ? 'PASSWORD_RECOVERY' : 'SIGNED_IN';
      emit(event, hydrated);
      // Clear tokens from the URL
      const cleanUrl = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState({}, document.title, cleanUrl);
    } catch (error) {
      console.error('Failed to hydrate self-hosted auth hash session', error);
      emit('SIGNED_OUT', null);
    }
  })();

  return {
    async signInWithPassword({ email, password }) {
      try {
        const json = await authFetch('/auth/v1/token?grant_type=password', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        const session = toSession(json as never);
        emit('SIGNED_IN', session);
        return { data: { user: session.user, session }, error: null };
      } catch (error) {
        return { data: { user: null, session: null }, error: error as Error };
      }
    },

    async signUp({ email, password, options }) {
      try {
        const json = await authFetch('/auth/v1/signup', {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            data: options?.data,
          }),
        });
        const session = toSession(json as never);
        emit('SIGNED_IN', session);
        return { data: { user: session.user, session }, error: null };
      } catch (error) {
        return { data: { user: null, session: null }, error: error as Error };
      }
    },

    async signInWithOAuth({ provider, options }) {
      try {
        if (provider !== 'google') {
          throw new Error('Only Google OAuth is supported in self-hosted mode');
        }
        const url = new URL(`${base}/auth/v1/authorize`);
        url.searchParams.set('provider', 'google');
        if (options?.redirectTo) {
          url.searchParams.set('redirect_to', options.redirectTo);
        }
        window.location.assign(url.toString());
        return { data: { provider, url: url.toString() }, error: null };
      } catch (error) {
        return {
          data: { provider, url: '' },
          error: error as Error,
        };
      }
    },

    async signOut() {
      try {
        const refresh = currentSession?.refresh_token;
        await authFetch('/auth/v1/logout', {
          method: 'POST',
          headers: currentSession?.access_token
            ? { Authorization: `Bearer ${currentSession.access_token}` }
            : {},
          body: JSON.stringify({
            refresh_token: refresh,
            scope: 'local',
          }),
        });
      } catch {
        // still clear local session
      }
      emit('SIGNED_OUT', null);
      return { error: null };
    },

    async resetPasswordForEmail(email, options) {
      try {
        await authFetch('/auth/v1/recover', {
          method: 'POST',
          body: JSON.stringify({
            email,
            redirect_to: options?.redirectTo,
          }),
        });
        return { data: {}, error: null };
      } catch (error) {
        return { data: {}, error: error as Error };
      }
    },

    async updateUser(attributes) {
      try {
        if (!currentSession?.access_token) {
          throw new Error('Not authenticated');
        }
        const json = await authFetch('/auth/v1/user', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${currentSession.access_token}` },
          body: JSON.stringify(attributes),
        });
        const user = toUser((json.user as Record<string, unknown>) ?? json);
        const next: Session = { ...currentSession, user };
        emit('USER_UPDATED', next);
        return { data: { user }, error: null };
      } catch (error) {
        return { data: { user: null }, error: error as Error };
      }
    },

    async setSession(tokens) {
      try {
        const session = await hydrateUser(
          toSession({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            user: {
              id: 'pending',
              aud: 'authenticated',
              role: 'authenticated',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_anonymous: false,
              app_metadata: {},
              user_metadata: {},
            },
          })
        );
        emit('SIGNED_IN', session);
        return { data: { user: session.user, session }, error: null };
      } catch (error) {
        return { data: { user: null, session: null }, error: error as Error };
      }
    },

    async getSession() {
      return { data: { session: currentSession }, error: null };
    },

    async getUser() {
      if (!currentSession?.access_token) {
        return { data: { user: null }, error: null };
      }
      try {
        const userJson = await authFetch('/auth/v1/user', {
          headers: { Authorization: `Bearer ${currentSession.access_token}` },
        });
        const user = toUser(userJson);
        currentSession = { ...currentSession, user };
        writeStoredSession(currentSession);
        return { data: { user }, error: null };
      } catch (error) {
        return { data: { user: null }, error: error as Error };
      }
    },

    onAuthStateChange(callback) {
      listeners.add(callback);
      // Mirror supabase-js: emit current session shortly after subscribe
      queueMicrotask(() => {
        callback('INITIAL_SESSION', currentSession);
      });
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              listeners.delete(callback);
            },
          },
        },
      };
    },
  };
}
