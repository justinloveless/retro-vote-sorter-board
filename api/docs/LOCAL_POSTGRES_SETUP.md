# Local Postgres Setup Guide

This guide explains how to set up and use the local Postgres container for development and testing.

## Overview

The Retroscope API supports three data routing modes:

1. **Supabase-only** (default) - All requests go to remote Supabase
2. **Local Postgres** - All requests go to local Postgres container
3. **Dual-path** - Requests go to both simultaneously for comparison

This allows you to:

- Test against a local database without affecting production data
- Migrate from Supabase to self-hosted Postgres
- Compare behavior between Supabase and local Postgres
- Develop offline

## Prerequisites

- Docker and Docker Compose
- Supabase CLI (for schema export)
- Access to your Supabase database

## Step 1: Export Supabase Schema

Export your complete database schema from Supabase:

### Option 1: Using Supabase CLI with connection string

```bash
# Install Supabase CLI if you haven't
brew install supabase/tap/supabase

# Export the schema
supabase db dump \
  --db-url "postgresql://postgres:[YOUR_PASSWORD]@db.nwfwbjmzbwuyxehindpv.supabase.co:5432/postgres" \
  > api/postgres/init/01-schema.sql
```

### Option 2: Using linked Supabase project

```bash
cd supabase
supabase db dump --linked > ../api/postgres/init/01-schema.sql
```

### Option 3: Manual export from dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Use pg_dump or export via the dashboard
4. Save to `api/postgres/init/01-schema.sql`

### What gets exported

The schema dump includes:

- All table definitions
- All RLS (Row Level Security) policies
- Auth schema and helper functions (`auth.uid()`, `auth.jwt()`)
- Custom functions and stored procedures
- Indexes and constraints
- Triggers
- Extensions

## Step 2: Start the Postgres Container

The Postgres container is defined in `docker-compose.yml`. Start it with:

```bash
# Start just the postgres service
docker-compose up postgres -d

# Or start all services
docker-compose up -d
```

The container will:

- Start Postgres 15
- Execute scripts in `api/postgres/init/` directory (in alphabetical order)
- Initialize the database with your Supabase schema
- Expose port 5432 on your host machine

### Verify it's running

```bash
# Check container status
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Connect to the database
docker-compose exec postgres psql -U postgres -d retroscope
```

## Step 3: Configure the API

The API needs to know how to connect to the local Postgres container.

### For Docker development (api-dev service)

The connection string is already configured in `docker-compose.yml`:

```yaml
environment:
  - POSTGRES_CONNECTION_STRING=Host=postgres;Port=5432;Database=retroscope;Username=postgres;Password=postgres
```

### For local development (outside Docker)

Add to `api/src/Retroscope.Api/appsettings.Development.json`:

```json
{
  "POSTGRES_CONNECTION_STRING": "Host=localhost;Port=5432;Database=retroscope;Username=postgres;Password=postgres"
}
```

## Step 4: Using Header-Based Routing

The API routes requests based on HTTP headers. Set these headers in your HTTP client:

### Mode 1: Supabase-only (default)

No special headers needed. This is the default behavior:

```bash
curl http://localhost:5228/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Mode 2: Local Postgres only

Add the `X-UseLocalPostgres: true` header:

```bash
curl http://localhost:5228/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-UseLocalPostgres: true"
```

### Mode 3: Dual-path (both, with comparison)

Add both `X-UseLocalPostgres: true` and `X-DualPath: true`:

```bash
curl http://localhost:5228/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-UseLocalPostgres: true" \
  -H "X-DualPath: true"
```

In dual-path mode:

- Both Supabase and Postgres are called in parallel
- Supabase result is used as the primary response
- Timing and data differences are logged
- Useful for validating migrations

## Row Level Security (RLS)

The local Postgres database uses the same RLS policies as Supabase. The API sets session variables before each query to enable RLS:

### How it works

1. API extracts user ID from JWT token
2. Sets PostgreSQL session variables:
   ```sql
   SELECT set_config('request.jwt.claim.sub', 'user-id', TRUE);
   SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
   ```
3. RLS policies automatically apply based on these session variables
4. Queries return only data the user is authorized to see

### Testing RLS

Connect to the database and test RLS manually:

```sql
-- Connect to database
docker-compose exec postgres psql -U postgres -d retroscope

-- Set session variables for a specific user
SELECT set_config('request.jwt.claim.sub', 'your-user-id-here', TRUE);
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);

-- Query should only return this user's notifications
SELECT * FROM notifications;
```

## Viewing Dual-Path Logs

When using dual-path mode, the API logs timing and data comparisons. View them with:

```bash
# View API logs
docker-compose logs -f api-dev

# Look for log entries like:
# DualPath GetNotificationsAsync: Results match
# DualPath GetNotificationsAsync: Timing - Supabase=45ms, Postgres=32ms, Postgres was faster by 13ms
```

The logs will show:

- **Operation name** - Which API method was called
- **Timing comparison** - Execution time for each path
- **Data differences** - Full JSON comparison if results differ
- **Correlation ID** - For tracing requests

## Seed Data (Optional)

To add test data to your local Postgres:

1. Create `api/postgres/init/02-seed-data.sql`:

```sql
-- Insert test profile
INSERT INTO profiles (id, full_name, email, role) VALUES
  ('test-user-id', 'Test User', 'test@example.com', 'user');

-- Insert test team
INSERT INTO teams (id, name, created_by) VALUES
  ('test-team-id', 'Test Team', 'test-user-id');

-- Insert test team member
INSERT INTO team_members (id, team_id, user_id, role) VALUES
  (gen_random_uuid(), 'test-team-id', 'test-user-id', 'admin');
```

2. Restart the container to apply seed data:

```bash
docker-compose down postgres
docker-compose up postgres -d
```

## Troubleshooting

### Schema didn't apply

Check init script execution:

```bash
docker-compose logs postgres | grep -A 10 "database system is ready"
```

If the schema wasn't applied, the container may have already been initialized. Remove the volume:

```bash
docker-compose down -v postgres
docker-compose up postgres -d
```

### Connection refused

Ensure postgres is running and healthy:

```bash
docker-compose ps postgres
docker-compose exec postgres pg_isready -U postgres
```

### RLS not working

Verify the auth schema and helper functions exist:

```sql
-- Check if auth.uid() function exists
SELECT proname FROM pg_proc WHERE proname = 'uid' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth');

-- Check RLS is enabled on tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

### Dual-path results differ

This is expected during migration. The logs show what differs:

1. Check the log output for specifics
2. Verify your PostgresGateway implementation matches SupabaseGateway
3. Check for data type or format differences
4. Ensure timezone handling is consistent

### Cannot drop database

If you need to reset completely:

```bash
# Stop and remove containers and volumes
docker-compose down postgres -v

# Remove postgres data volume
docker volume rm retro-vote-sorter-board_postgres-data

# Start fresh
docker-compose up postgres -d
```

## Development Workflow

### Recommended workflow

1. **Start with dual-path mode** - Ensure both paths return the same data
2. **Monitor logs** - Check for differences and timing
3. **Implement missing features** - Add NotImplementedException methods as needed
4. **Switch to Postgres-only** - Once confident, test with local only
5. **Iterate** - Fix any issues, re-test with dual-path

### Testing checklist

- [ ] Schema imported successfully
- [ ] Container starts and stays healthy
- [ ] API connects to Postgres
- [ ] RLS policies apply correctly
- [ ] Dual-path mode shows matching results
- [ ] Timing is acceptable (< 100ms difference)
- [ ] All CRUD operations work

## Next Steps

### Implementing remaining gateway methods

Many PostgresGateway methods are stubs. To implement them:

1. Find the method in `api/src/Retroscope.Infrastructure/Postgres/PostgresGateway.*.cs`
2. Look at the corresponding SupabaseGateway method for reference
3. Use Entity Framework to query the database
4. Remember to call `SetRLSContextAsync(userId)` first
5. Return the same DTO structure as SupabaseGateway

Example:

```csharp
public async Task<TeamsResponse> GetTeamsAsync(
    string bearerToken,
    string? correlationId = null,
    CancellationToken cancellationToken = default)
{
    var userId = ExtractUserIdFromToken(bearerToken);
    if (string.IsNullOrEmpty(userId))
    {
        throw new UnauthorizedAccessException("Invalid bearer token");
    }

    // Set RLS context
    await SetRLSContextAsync(userId);

    // Query with RLS automatically applied
    var teams = await _context.Teams
        .OrderBy(t => t.Name)
        .Select(t => new TeamItem
        {
            Id = t.Id.ToString(),
            Name = t.Name,
            Description = t.Description,
            CreatedBy = t.CreatedBy.ToString(),
            CreatedAt = t.CreatedAt
        })
        .ToListAsync(cancellationToken);

    return new TeamsResponse { Items = teams };
}
```

### Migrating to production

When ready to use Postgres in production:

1. Set up a managed Postgres instance (AWS RDS, Azure Database, etc.)
2. Import the schema using the same SQL dump
3. Migrate data from Supabase (using pg_dump or data pipeline)
4. Update `POSTGRES_CONNECTION_STRING` in production environment
5. Initially use dual-path mode to verify
6. Switch to Postgres-only once confident
7. Decommission Supabase

## Summary

You now have:

- ✅ Local Postgres with Supabase schema
- ✅ Header-based routing (3 modes)
- ✅ RLS working with session variables
- ✅ Dual-path comparison logging
- ✅ Development workflow

Happy developing! 🚀
