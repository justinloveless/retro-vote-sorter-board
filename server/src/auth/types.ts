export interface AuthUserRow {
  id: string;
  email: string | null;
  encrypted_password: string | null;
  email_confirmed_at: Date | string | null;
  last_sign_in_at: Date | string | null;
  raw_app_meta_data: Record<string, unknown> | null;
  raw_user_meta_data: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string;
  aud: string | null;
  role: string | null;
  banned_until: Date | string | null;
  deleted_at: Date | string | null;
  is_anonymous: boolean | null;
}

export interface AuthIdentityRow {
  id: string;
  user_id: string;
  provider: string;
  provider_id: string;
  identity_data: Record<string, unknown> | null;
  email: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  last_sign_in_at: Date | string | null;
}

export interface AuthUserPublic {
  id: string;
  aud: string;
  role: string;
  email: string | null;
  email_confirmed_at: string | null;
  phone: string | null;
  confirmed_at: string | null;
  last_sign_in_at: string | null;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  identities?: Array<{
    id: string;
    user_id: string;
    identity_data: Record<string, unknown>;
    provider: string;
    created_at: string;
    last_sign_in_at: string | null;
    updated_at: string;
  }>;
  created_at: string;
  updated_at: string;
  is_anonymous: boolean;
}

/** Supabase GoTrue-compatible token response. */
export interface AuthTokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: AuthUserPublic;
}
