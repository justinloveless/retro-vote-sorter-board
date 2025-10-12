# Postgres Initialization Scripts

This directory contains SQL scripts that are executed when the Postgres container starts for the first time.

## Schema Export

To export the schema from Supabase, you need to run:

```bash
# Make sure you have the supabase CLI installed
# brew install supabase/tap/supabase

# Option 1: Using the Supabase CLI with your project
supabase db dump --db-url "postgresql://postgres:[YOUR_PASSWORD]@db.nwfwbjmzbwuyxehindpv.supabase.co:5432/postgres" > api/postgres/init/01-schema.sql

# Option 2: If you're logged in to your Supabase project
cd supabase
supabase db dump --linked > ../api/postgres/init/01-schema.sql
```

## What Gets Exported

The schema dump should include:

- All table definitions
- All RLS policies
- Auth schema and helper functions (`auth.uid()`, `auth.jwt()`)
- Custom functions and stored procedures
- Indexes and constraints
- Triggers

## File Naming

Scripts are executed in alphabetical order:

- `01-schema.sql` - Main schema from Supabase
- `02-seed-data.sql` - (Optional) Seed data for local development

## RLS Configuration

The dumped schema includes RLS policies that expect session variables:

- `request.jwt.claim.sub` - User ID from JWT
- `request.jwt.claim.role` - User role (typically "authenticated")

The PostgresGateway will set these session variables before each query to enable RLS.
