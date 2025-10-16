-- Create application user with RLS enforcement
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'retroscope_app') THEN
        CREATE ROLE retroscope_app WITH LOGIN PASSWORD 'retroscope_app_pass';
    END IF;
END
$$;

-- Grant membership in Supabase roles so RLS policies apply
-- Most RLS policies are scoped "TO authenticated" role
GRANT authenticated TO retroscope_app;
GRANT anon TO retroscope_app;

-- Set default role for connections
ALTER ROLE retroscope_app SET ROLE authenticated;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO retroscope_app;
GRANT USAGE ON SCHEMA auth TO retroscope_app;
GRANT USAGE ON SCHEMA extensions TO retroscope_app;

-- Grant table permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO retroscope_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO retroscope_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO retroscope_app;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO retroscope_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO retroscope_app;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO retroscope_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO retroscope_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO retroscope_app;

-- Important: This user does NOT have BYPASSRLS, so RLS policies will be enforced!

