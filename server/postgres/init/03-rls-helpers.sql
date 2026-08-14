-- Phase 3 (DUN-78): RLS helpers + PostgREST grants.
-- PostgREST sets request.jwt.claim.* / request.jwt.claims from the access JWT.
--
-- Coolify compose embeds this via configs.content — keep compose in sync.
-- SQL must stay free of dollar signs (Compose interpolates them).

CREATE SCHEMA IF NOT EXISTS auth;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, retroscope_app, authenticator;

-- auth.uid() — current user id from JWT (PostgREST-compatible)
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS '
  SELECT NULLIF(
    COALESCE(
      current_setting(''request.jwt.claim.sub'', true),
      (current_setting(''request.jwt.claims'', true)::jsonb ->> ''sub'')
    ),
    ''''
  )::uuid;
';

-- auth.role() — JWT role claim (authenticated / anon / service_role)
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS '
  SELECT COALESCE(
    NULLIF(current_setting(''request.jwt.claim.role'', true), ''''),
    NULLIF(current_setting(''request.jwt.claims'', true)::jsonb ->> ''role'', ''''),
    ''anon''
  );
';

-- auth.jwt() — full JWT claims as jsonb
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS '
  SELECT COALESCE(
    NULLIF(current_setting(''request.jwt.claims'', true), '''')::jsonb,
    jsonb_build_object(
      ''sub'', NULLIF(current_setting(''request.jwt.claim.sub'', true), ''''),
      ''role'', COALESCE(
        NULLIF(current_setting(''request.jwt.claim.role'', true), ''''),
        ''anon''
      )
    )
  );
';

GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role, retroscope_app, authenticator;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role, retroscope_app, authenticator;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role, retroscope_app, authenticator;

-- Table / sequence / function grants for PostgREST roles (idempotent after restore)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, retroscope_app, authenticator;
GRANT ALL ON SCHEMA public TO retroscope_app;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO retroscope_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO retroscope_app;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO retroscope_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO retroscope_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO retroscope_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO retroscope_app;
