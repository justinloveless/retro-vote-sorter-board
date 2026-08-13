import type { AuthIdentityRow, AuthUserPublic, AuthUserRow } from './types.js';

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore
    }
  }
  return {};
}

export function serializeUser(
  row: AuthUserRow,
  identities: AuthIdentityRow[] = []
): AuthUserPublic {
  const emailConfirmedAt = toIso(row.email_confirmed_at);
  return {
    id: row.id,
    aud: row.aud || 'authenticated',
    role: row.role || 'authenticated',
    email: row.email,
    email_confirmed_at: emailConfirmedAt,
    phone: null,
    confirmed_at: emailConfirmedAt,
    last_sign_in_at: toIso(row.last_sign_in_at),
    app_metadata: asObject(row.raw_app_meta_data),
    user_metadata: asObject(row.raw_user_meta_data),
    identities: identities.map((identity) => ({
      id: identity.id,
      user_id: identity.user_id,
      identity_data: asObject(identity.identity_data),
      provider: identity.provider,
      created_at: toIso(identity.created_at) ?? new Date().toISOString(),
      last_sign_in_at: toIso(identity.last_sign_in_at),
      updated_at: toIso(identity.updated_at) ?? new Date().toISOString(),
    })),
    created_at: toIso(row.created_at) ?? new Date().toISOString(),
    updated_at: toIso(row.updated_at) ?? new Date().toISOString(),
    is_anonymous: Boolean(row.is_anonymous),
  };
}
