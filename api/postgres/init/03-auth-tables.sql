-- Auth tables migration for local auth system
-- This extends the existing auth schema with additional tables needed for local authentication

-- Enhance the existing auth.users table
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS encrypted_password TEXT;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_app_meta_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create OAuth identities table
CREATE TABLE IF NOT EXISTS auth.identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'github', 'google', etc.
    provider_user_id TEXT NOT NULL,
    provider_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, provider_user_id)
);

-- Create refresh tokens table
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    parent TEXT,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create verification codes table
CREATE TABLE IF NOT EXISTS auth.verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    type TEXT NOT NULL, -- 'email_verification', 'password_reset'
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth.users(email);
CREATE INDEX IF NOT EXISTS idx_auth_identities_provider_user_id ON auth.identities(provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id ON auth.identities(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_token ON auth.refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user_id ON auth.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_verification_codes_code ON auth.verification_codes(code);
CREATE INDEX IF NOT EXISTS idx_auth_verification_codes_user_id ON auth.verification_codes(user_id);

-- Grant permissions to the retroscope_app user
GRANT ALL ON TABLE auth.identities TO retroscope_app;
GRANT ALL ON TABLE auth.refresh_tokens TO retroscope_app;
GRANT ALL ON TABLE auth.verification_codes TO retroscope_app;

-- Grant sequence permissions (sequences may or may not exist depending on column defaults)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'identities_id_seq' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
        GRANT ALL ON SEQUENCE auth.identities_id_seq TO retroscope_app;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'refresh_tokens_id_seq' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
        GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO retroscope_app;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'verification_codes_id_seq' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
        GRANT ALL ON SEQUENCE auth.verification_codes_id_seq TO retroscope_app;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'users_id_seq' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
        GRANT ALL ON SEQUENCE auth.users_id_seq TO retroscope_app;
    END IF;
END
$$;

-- Update existing auth.users permissions
GRANT ALL ON TABLE auth.users TO retroscope_app;

-- Add RLS policies for auth tables
ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.verification_codes ENABLE ROW LEVEL SECURITY;

-- RLS policies for identities
CREATE POLICY "Users can view their own identities" ON auth.identities
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own identities" ON auth.identities
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own identities" ON auth.identities
    FOR UPDATE USING (user_id = auth.uid());

-- RLS policies for refresh tokens
CREATE POLICY "Users can view their own refresh tokens" ON auth.refresh_tokens
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own refresh tokens" ON auth.refresh_tokens
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own refresh tokens" ON auth.refresh_tokens
    FOR UPDATE USING (user_id = auth.uid());

-- RLS policies for verification codes
CREATE POLICY "Users can view their own verification codes" ON auth.verification_codes
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own verification codes" ON auth.verification_codes
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own verification codes" ON auth.verification_codes
    FOR UPDATE USING (user_id = auth.uid());

-- Add to realtime publication for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE auth.identities;
ALTER PUBLICATION supabase_realtime ADD TABLE auth.refresh_tokens;
