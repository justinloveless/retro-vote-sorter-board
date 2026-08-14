-- Run after pg_restore from hosted Supabase (Phase 3 staging restore).
-- Re-applies PostgREST roles, RLS helpers, and grants that dumps may omit or
-- that assume Supabase-managed role membership.
--
-- Usage (as postgres superuser):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f server/postgres/init/01-roles.sql \
--     -f server/postgres/init/02-auth-schema.sql \
--     -f server/postgres/init/03-rls-helpers.sql \
--     -f server/postgres/init/04-post-restore-grants.sql
--
-- Then reload PostgREST schema cache:
--   SELECT pg_notify('pgrst', 'reload schema');

-- Ensure authenticator can switch into API roles
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;

-- Ensure app role can use auth helpers for server-side jobs
GRANT USAGE ON SCHEMA auth TO retroscope_app;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO retroscope_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO retroscope_app;

-- Profiles often FK to auth.users; allow authenticated reads via RLS only
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO service_role;

-- Reload PostgREST (no-op if PostgREST is not listening yet)
SELECT pg_notify('pgrst', 'reload schema');
