-- Minimal roles so PostgREST can start in Phase 1.
-- Full schema + RLS bootstrap lands in Phase 3.
--
-- Use psql \gexec instead of PL/pgSQL DO blocks. Docker Compose interpolates
-- dollar signs in compose YAML, which corrupted dollar-quoted DO bodies under
-- Coolify. \gexec runs each SELECT result as SQL (psql only — used by db-init).
--
-- Coolify compose embeds this via configs.content — keep compose in sync.

SELECT format('CREATE ROLE %I NOLOGIN', rolname)
FROM (VALUES ('anon'), ('authenticated')) AS t(rolname)
WHERE NOT EXISTS (SELECT FROM pg_roles r WHERE r.rolname = t.rolname)
\gexec

SELECT format('CREATE ROLE %I NOLOGIN BYPASSRLS', 'service_role')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role')
\gexec

SELECT format(
  'CREATE ROLE %I NOINHERIT LOGIN PASSWORD %L',
  'authenticator',
  'retroscope_authenticator_pass'
)
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator')
\gexec

SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L',
  'retroscope_app',
  'retroscope_app_pass'
)
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'retroscope_app')
\gexec

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
