# PostgreSQL Deployment Troubleshooting

## Issue: "Role 'retroscope_app' does not exist"

### Problem

When deploying to Coolify (or any Docker environment with persistent volumes), you may encounter:

```
FATAL: password authentication failed for user "retroscope_app"
DETAIL: Role "retroscope_app" does not exist.
```

### Root Cause

PostgreSQL init scripts in `/docker-entrypoint-initdb.d/` only run when the database is **first initialized** (i.e., when the data directory is empty). If the volume already contains data from a previous deployment, the init scripts are skipped, and the `retroscope_app` user is never created.

### Solution 1: Use the postgres-init Service (Recommended)

The `docker-compose.dev.yml` now includes a `postgres-init` service that ensures the user exists even with existing volumes. This service:

1. Runs after postgres is healthy
2. Creates the `retroscope_app` user if it doesn't exist
3. Updates the password if the user already exists
4. Grants necessary permissions

No manual intervention required - just deploy normally.

### Solution 2: Delete the Volume (Clean Slate)

If you need to start fresh:

**In Coolify:**

1. Go to your application → Storages
2. Delete the `postgres-data` volume
3. Redeploy the application

**With Docker Compose:**

```bash
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

### Solution 3: Manual User Creation

If you have access to the database, create the user manually:

```sql
-- Connect as postgres superuser
psql -U postgres -d retroscope

-- Create the user
CREATE ROLE retroscope_app WITH LOGIN PASSWORD 'retroscope_app_pass';

-- Grant permissions
GRANT USAGE ON SCHEMA public TO retroscope_app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO retroscope_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO retroscope_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO retroscope_app;

-- Set default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO retroscope_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO retroscope_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO retroscope_app;
```

## Verification

Check if the user exists:

```bash
docker exec -it <postgres-container> psql -U postgres -d retroscope -c "\du retroscope_app"
```

Test the connection:

```bash
docker exec -it <postgres-container> psql -U retroscope_app -d retroscope -c "SELECT current_user;"
```

## Prevention

The `postgres-init` service in `docker-compose.dev.yml` prevents this issue by:

1. Running as a separate one-time service
2. Executing after postgres is healthy
3. Using idempotent SQL (safe to run multiple times)
4. Automatically granting necessary permissions

All dependent services (api-dev, postgrest) wait for `postgres-init` to complete before starting.
