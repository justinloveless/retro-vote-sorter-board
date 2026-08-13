-- Minimal roles so PostgREST can start in Phase 1.
-- Full schema + RLS bootstrap lands in Phase 3.
--
-- Coolify compose embeds this SQL via configs.content (not file: / bind mounts).
-- Keep docker-compose.selfhost*.yml `retroscope_roles_sql` in sync when editing.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'retroscope_authenticator_pass';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'retroscope_app') THEN
    CREATE ROLE retroscope_app LOGIN PASSWORD 'retroscope_app_pass';
  END IF;
END
$$;

GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT authenticated TO retroscope_app;
GRANT anon TO retroscope_app;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, retroscope_app, authenticator;
GRANT ALL ON SCHEMA public TO retroscope_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO retroscope_app;
