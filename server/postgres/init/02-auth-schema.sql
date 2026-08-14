-- Local auth schema for Phase 2 (DUN-77).
-- Shape aligns with Supabase auth.users / auth.identities for UUID-preserving import.
--
-- Coolify compose embeds this via configs.content — keep compose in sync.
-- SQL must stay free of `$` (Compose interpolates dollar signs).

CREATE SCHEMA IF NOT EXISTS auth;

GRANT USAGE ON SCHEMA auth TO retroscope_app;
GRANT ALL ON SCHEMA auth TO retroscope_app;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID,
  aud TEXT DEFAULT 'authenticated',
  role TEXT DEFAULT 'authenticated',
  email TEXT,
  encrypted_password TEXT,
  email_confirmed_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  confirmation_token TEXT,
  confirmation_sent_at TIMESTAMPTZ,
  recovery_token TEXT,
  recovery_sent_at TIMESTAMPTZ,
  email_change_token_new TEXT,
  email_change TEXT,
  email_change_sent_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  raw_app_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_super_admin BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  phone TEXT,
  phone_confirmed_at TIMESTAMPTZ,
  phone_change TEXT,
  phone_change_token TEXT,
  phone_change_sent_at TIMESTAMPTZ,
  email_change_token_current TEXT,
  email_change_confirm_status SMALLINT DEFAULT 0,
  banned_until TIMESTAMPTZ,
  reauthentication_token TEXT,
  reauthentication_sent_at TIMESTAMPTZ,
  is_sso_user BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_email_unique
  ON auth.users (lower(email))
  WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth.users (email);

CREATE TABLE IF NOT EXISTS auth.identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  identity_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email TEXT,
  UNIQUE (provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id ON auth.identities (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_identities_provider_id ON auth.identities (provider, provider_id);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  parent TEXT,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  session_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_token ON auth.refresh_tokens (token);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user_id ON auth.refresh_tokens (user_id);

CREATE TABLE IF NOT EXISTS auth.verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  type TEXT NOT NULL,
  redirect_to TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_verification_codes_code ON auth.verification_codes (code);
CREATE INDEX IF NOT EXISTS idx_auth_verification_codes_user_id ON auth.verification_codes (user_id);

GRANT ALL ON ALL TABLES IN SCHEMA auth TO retroscope_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO retroscope_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO retroscope_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO retroscope_app;
