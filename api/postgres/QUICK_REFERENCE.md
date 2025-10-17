# Local Postgres - Quick Reference

## Connection Strings

### Application (C# API)

```
Host=postgres;Port=5432;Database=retroscope;Username=retroscope_app;Password=retroscope_app_pass
```

_Already configured in docker-compose.yml_

### Manual Testing

```bash
# As superuser (bypasses RLS)
docker-compose exec postgres psql -U postgres -d retroscope

# As app user (enforces RLS)
PGPASSWORD=retroscope_app_pass docker-compose exec postgres psql -U retroscope_app -d retroscope
```

## Routing Headers

| Mode          | Headers                                          | Result                |
| ------------- | ------------------------------------------------ | --------------------- |
| **Supabase**  | _(none)_                                         | → Supabase only       |
| **Postgres**  | `X-UseLocalPostgres: true`                       | → Local Postgres only |
| **Dual-Path** | `X-UseLocalPostgres: true`<br>`X-DualPath: true` | → Both (logs diff)    |

### SupabaseProxyController Routing

The SupabaseProxyController (`/api/supabase/*`) now supports three routing modes for database requests:

| Mode          | Headers                                          | Database           | Edge Functions |
| ------------- | ------------------------------------------------ | ------------------ | -------------- |
| **Supabase**  | _(none)_                                         | → Supabase         | → Supabase     |
| **Postgres**  | `X-UseLocalPostgres: true`                       | → Local PostgREST  | → Supabase     |
| **Dual-Path** | `X-UseLocalPostgres: true`<br>`X-DualPath: true` | → Both (logs diff) | → Supabase     |

**Note**: Edge Functions (`/api/supabase/functions/*`) always route to Supabase regardless of headers, as no local equivalent exists yet.

#### Example: Testing Database Dual-Path via Proxy

```bash
curl -X GET "http://localhost:5228/api/supabase/notifications?select=*&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-UseLocalPostgres: true" \
  -H "X-DualPath: true"

# Check logs
docker-compose logs -f api-dev | grep "DualPath"
```

**PostgREST**: A PostgREST instance runs on port `3000` (internal) providing the same REST API as Supabase PostgREST, with JWT authentication and automatic RLS enforcement.

## Common Commands

### Database Management

```bash
# Reset database (delete all data)
docker-compose stop postgres && \
docker-compose rm -f postgres && \
docker volume rm retro-vote-sorter-board_postgres-data && \
docker-compose up -d postgres

# View logs
docker-compose logs -f postgres

# Check health
docker-compose ps postgres
```

### Data Inspection

```bash
# List tables
docker-compose exec postgres psql -U postgres -d retroscope -c "\dt public.*"

# Count records
docker-compose exec postgres psql -U postgres -d retroscope -c "
  SELECT
    'notifications' as table, COUNT(*) FROM notifications
  UNION ALL
  SELECT 'teams', COUNT(*) FROM teams;
"

# Check RLS status
docker-compose exec postgres psql -U postgres -d retroscope -c "
  SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
"
```

### RLS Testing

```bash
# Test as specific user
PGPASSWORD=retroscope_app_pass docker-compose exec -T postgres psql -U retroscope_app -d retroscope << 'EOF'
BEGIN;
SELECT set_config('request.jwt.claim.sub', 'YOUR-USER-ID', FALSE);
SELECT COUNT(*) FROM notifications;
COMMIT;
EOF

# Run verification script
./api/postgres/verify-rls.sh
```

## API Testing with curl

### Supabase Mode

```bash
curl -X GET "http://localhost:5228/api/notifications?limit=10" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -H "Content-Type: application/json"
```

### Postgres Mode

```bash
curl -X GET "http://localhost:5228/api/notifications?limit=10" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -H "X-UseLocalPostgres: true" \
  -H "Content-Type: application/json"
```

### Dual-Path Mode

```bash
curl -X GET "http://localhost:5228/api/notifications?limit=10" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -H "X-UseLocalPostgres: true" \
  -H "X-DualPath: true" \
  -H "Content-Type: application/json"

# Check logs for comparison
docker-compose logs api-dev | grep "DualPath" | tail -20
```

## Monitoring Dual-Path

### Watch for differences

```bash
docker-compose logs -f api-dev | grep "Results differ"
```

### Watch timing comparisons

```bash
docker-compose logs -f api-dev | grep "Timing"
```

### Example log output

```
DualPath GetNotificationsAsync: Results match (CorrelationId: abc-123)
DualPath GetNotificationsAsync: Timing - Supabase=45ms, Postgres=32ms, Postgres was faster by 13ms
```

## Database Info

- **Database**: `retroscope`
- **Port**: `5432`
- **Tables**: 28
- **RLS Policies**: 105
- **Users**: `postgres` (super), `retroscope_app` (app)
- **Roles**: `anon`, `authenticated`, `service_role`

## PgAdmin Access

If pgadmin is running:

- **URL**: http://localhost:5555
- **Email**: admin@admin.com
- **Password**: admin

Server will be pre-configured to connect to local Postgres.

## Troubleshooting

### No tables found

```bash
# Reset and reinitialize
docker-compose down
docker volume rm retro-vote-sorter-board_postgres-data
docker-compose up -d postgres
sleep 20
docker-compose logs postgres | grep "PostgreSQL init process complete"
```

### RLS not filtering

- Make sure you're connecting as `retroscope_app`, not `postgres`
- Verify session variables are set: `SELECT auth.uid();`
- Check role: `SELECT current_role;` (should be `authenticated`)

### Schema errors during init

- Check logs: `docker-compose logs postgres | grep ERROR`
- Missing extensions are commented out
- Missing schemas are created at the top of 01-schema.sql

## Success Verification

✅ Run this to verify everything works:

```bash
# 1. Check container
docker-compose ps postgres
# Should show: running (healthy)

# 2. Check tables
docker-compose exec postgres psql -U postgres -d retroscope -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
# Should show: 28

# 3. Check RLS
./api/postgres/verify-rls.sh
# Should show: User 1 sees 2, User 2 sees 1, Total: 3

# 4. Test API
curl http://localhost:5228/healthz
# Should show: {"status":"healthy"}
```

## Resources

- **Setup Guide**: `api/docs/LOCAL_POSTGRES_SETUP.md`
- **API README**: `api/README.md`
- **Implementation Summary**: `IMPLEMENTATION_COMPLETE.md`
- **Architecture Details**: `POSTGRES_MIGRATION_SUMMARY.md`

## Database Sync from Supabase

### Overview

The database sync script allows you to synchronize your local PostgreSQL database with your Supabase remote database. This is useful for:

- Getting the latest production data for local development
- Syncing auth data (users, identities, tokens) from Supabase
- Syncing all public schema data from Supabase
- Ensuring your local database matches the remote state

### Setup

1. **Create credentials file:**

   ```bash
   # Copy the template
   cp scripts/.env.sync.example .env.sync

   # Edit with your actual Supabase credentials
   nano .env.sync
   ```

2. **Get Supabase credentials:**

   - **Service Role Key**: Supabase Dashboard > Settings > API > service_role key
   - **Database URL**: Supabase Dashboard > Settings > Database > Connection string > URI
   - **Project Ref**: From your Supabase project URL (e.g., `nwfwbjmzbwuyxehindpv`)

3. **Example .env.sync:**
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_DB_URL=postgresql://postgres:your-password@db.nwfwbjmzbwuyxehindpv.supabase.co:5432/postgres
   SUPABASE_PROJECT_REF=nwfwbjmzbwuyxehindpv
   ```

### Usage

```bash
# Run the sync script
./scripts/sync-from-supabase.sh
```

**What happens during sync:**

1. Validates all credentials and connections
2. Dumps data from Supabase (auth + public schemas)
3. **Clears all local data** in target schemas
4. Loads fresh data from Supabase
5. Provides completion summary

### Configuration

Edit the script to customize what gets synced:

```bash
# In scripts/sync-from-supabase.sh
SCHEMAS=("auth" "public")  # Add more schemas here
AUTH_TABLES=("users" "identities" "refresh_tokens" "verification_codes")
PUBLIC_TABLES=()  # Empty = sync all tables
```

### Troubleshooting

**Connection issues:**

```bash
# Test Supabase connection manually
PGPASSWORD=your-password psql -h db.nwfwbjmzbwuyxehindpv.supabase.co -p 5432 -U postgres -d postgres -c "SELECT 1;"

# Test local connection
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d retroscope -c "SELECT 1;"
```

**Docker not running:**

```bash
docker-compose up -d postgres
```

**Check logs:**

```bash
tail -f scripts/sync-from-supabase.log
```

**Reset and retry:**

```bash
# If sync fails, reset local database
./scripts/reset-database.sh
./scripts/sync-from-supabase.sh
```

### Security Notes

- `.env.sync` is gitignored and never committed
- Service role key has admin access - keep it secure
- Script validates credentials before proceeding
- All operations are logged for audit trail

**You're all set! Happy developing! 🚀**
