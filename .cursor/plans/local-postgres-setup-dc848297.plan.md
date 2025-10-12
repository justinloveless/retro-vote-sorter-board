<!-- dc848297-5590-453e-ac32-4b9ccf581963 88f5d939-d521-4de5-b406-ed9302664ca0 -->
# Local Postgres Migration Plan

## Overview

Configure the C# API to support three modes:

1. **Supabase-only** (default, no headers)
2. **Local Postgres** (`X-UseLocalPostgres: true`)
3. **Dual-path** (`X-UseLocalPostgres: true` + `X-DualPath: true`) - sends to both, uses Supabase as primary, logs differences

## Architecture Changes

### 1. Postgres Container Setup

Add a `postgres` service to `docker-compose.yml`:

- Use `postgres:15` image (matching Supabase version)
- Expose port 5432
- Configure volume for persistence
- Environment variables for connection

### 2. Schema Export and Import

Export the complete Supabase schema:

```bash
supabase db dump --db-url postgresql://postgres:[password]@db.nwfwbjmzbwuyxehindpv.supabase.co:5432/postgres > schema.sql
```

Create initialization script:

- `api/postgres/init/01-schema.sql` (from dump)
- `api/postgres/init/02-seed-data.sql` (optional test data)

### 3. Entity Framework Core Integration

**Install packages** in `Retroscope.Infrastructure`:

- `Npgsql.EntityFrameworkCore.PostgreSQL`
- `Microsoft.EntityFrameworkCore.Design`

**Create `PostgresContext.cs`**:

- DbContext with DbSets for main tables (teams, team_members, profiles, notifications, retro_boards, retro_items, retro_comments, etc.)
- Configure connection string from `POSTGRES_CONNECTION_STRING`
- Map to existing schema (no migrations yet, schema from dump)

**Key entities to map**:

- Profiles
- Teams
- TeamMembers
- RetroBoards
- RetroItems
- RetroComments
- Notifications
- TeamInvitations
- Storage files/buckets

### 4. Data Access Layer

**Create `IPostgresGateway` interface** (partial, mirroring `ISupabaseGateway`):

```csharp
namespace Retroscope.Application.Interfaces;

public partial interface IPostgresGateway
{
    // Same method signatures as ISupabaseGateway
    Task<NotificationsResponse> GetNotificationsAsync(string bearerToken, int limit, string? correlationId, CancellationToken ct);
    // ... etc for all operations
}
```

**Create `PostgresGateway` implementation**:

- Located in `Retroscope.Infrastructure/Postgres/PostgresGateway.cs`
- Uses Entity Framework Core
- Implements RLS by extracting user ID from JWT and filtering queries
- Returns same DTOs as SupabaseGateway for consistency

### 5. Routing Strategy

**Create `IDataGateway` abstraction**:

```csharp
public interface IDataGateway : ISupabaseGateway, IPostgresGateway { }
```

**Create `DataGatewayRouter`** middleware/service:

- Checks `X-UseLocalPostgres` header
- Checks `X-DualPath` header
- Routes to appropriate gateway
- In dual-path mode:
  - Execute both in parallel (Task.WhenAll)
  - Use Supabase response as primary
  - Compare results and log differences with Serilog
  - Include metrics (timing, data diffs)

**Update DI registration** in `ServiceCollectionExtensions.cs`:

```csharp
services.AddScoped<ISupabaseGateway, SupabaseGateway>();
services.AddScoped<IPostgresGateway, PostgresGateway>();
services.AddScoped<IDataGateway, DataGatewayRouter>();
services.AddDbContext<PostgresContext>(options => 
    options.UseNpgsql(configuration["POSTGRES_CONNECTION_STRING"]));
```

**Update controllers**:

- Inject `IDataGateway` instead of `ISupabaseGateway`
- No other changes needed (same interface)

### 6. Configuration

**Add to `appsettings.Development.json`**:

```json
{
  "POSTGRES_CONNECTION_STRING": "Host=localhost;Port=5432;Database=retroscope;Username=postgres;Password=postgres",
  "POSTGRES_ENABLE_RLS_SIMULATION": true
}
```

**Add to docker-compose environment**:

```yaml
POSTGRES_CONNECTION_STRING: "Host=postgres;Port=5432;Database=retroscope;Username=postgres;Password=postgres"
```

### 7. Row Level Security (RLS)

The schema dump from Supabase will include all RLS policies. To make them work with local Postgres:

**Set JWT claims as session variables**:

Supabase RLS policies use `auth.uid()` which reads from session variables. Before each query, set the user context:

```csharp
// In PostgresGateway, before executing queries
var userId = ExtractUserIdFromToken(bearerToken);

// Set session variables that RLS policies expect
await _context.Database.ExecuteSqlRawAsync(
    "SELECT set_config('request.jwt.claim.sub', {0}, TRUE);", 
    userId);
    
// Optional: Set role for policies that check role
await _context.Database.ExecuteSqlRawAsync(
    "SELECT set_config('request.jwt.claim.role', {0}, TRUE);", 
    "authenticated");
```

**Ensure auth schema is included**:

The schema dump should include:

- `auth` schema with helper functions (`auth.uid()`, `auth.jwt()`)
- All RLS policies on tables (`profiles`, `teams`, `team_members`, `notifications`, etc.)
- `ENABLE ROW LEVEL SECURITY` statements on all tables

**Verify RLS policies**:

After importing the schema, test that:

```sql
-- Should only return current user's notifications
SET request.jwt.claim.sub = 'user-id-here';
SELECT * FROM notifications;  -- RLS automatically filters
```

**PostgresGateway pattern**:

```csharp
public async Task<NotificationsResponse> GetNotificationsAsync(
    string bearerToken, int limit, string? correlationId, CancellationToken ct)
{
    var userId = ExtractUserIdFromToken(bearerToken);
    
    // Set RLS context
    await SetRLSContext(userId, "authenticated");
    
    // Query normally - RLS policies apply automatically
    var notifications = await _context.Notifications
        .OrderByDescending(n => n.CreatedAt)
        .Take(limit)
        .ToListAsync(ct);
        
    // No manual filtering needed - RLS handles it!
    return new NotificationsResponse { Items = notifications };
}
```

### 8. Dual-Path Logging

**Create `DualPathComparer` service**:

```csharp
public class DualPathComparer
{
    public void LogDifferences<T>(string operation, T supabaseResult, T postgresResult, string correlationId)
    {
        // Serialize both results
        // Compare JSON
        // Log differences with structured logging
        // Include metrics: timing difference, data differences
    }
}
```

**Usage in `DataGatewayRouter`**:

```csharp
if (useDualPath)
{
    var sw1 = Stopwatch.StartNew();
    var supabaseTask = _supabaseGateway.GetNotificationsAsync(...);
    
    var sw2 = Stopwatch.StartNew();
    var postgresTask = _postgresGateway.GetNotificationsAsync(...);
    
    await Task.WhenAll(supabaseTask, postgresTask);
    sw1.Stop();
    sw2.Stop();
    
    _comparer.LogDifferences("GetNotifications", supabaseTask.Result, postgresTask.Result, correlationId);
    _logger.LogInformation("Timing: Supabase={SupabaseMs}ms, Postgres={PostgresMs}ms", sw1.ElapsedMilliseconds, sw2.ElapsedMilliseconds);
    
    return supabaseTask.Result; // Use Supabase as primary
}
```

### 9. Testing

**Unit tests** for `PostgresGateway`:

- Mock `PostgresContext` using InMemory provider
- Test RLS filtering logic
- Test all CRUD operations

**Integration tests** for `DataGatewayRouter`:

- Test header-based routing
- Test dual-path mode with WireMock for Supabase + InMemory for Postgres
- Verify comparison logic

**Test scenarios**:

1. No headers → routes to Supabase
2. `X-UseLocalPostgres: true` → routes to Postgres
3. `X-UseLocalPostgres: true` + `X-DualPath: true` → calls both, returns Supabase, logs diff
4. Invalid header values → defaults to Supabase

### 10. Documentation

**Create `api/docs/LOCAL_POSTGRES_SETUP.md`**:

- How to export schema from Supabase
- How to start local postgres container
- How to use headers for routing
- How to interpret dual-path logs

**Update `api/README.md`**:

- Add section on local development with Postgres
- Document environment variables
- Add troubleshooting section

## Implementation Order

### Phase 1: Infrastructure Setup

1. Add postgres service to docker-compose.yml
2. Export schema using `supabase db dump`
3. Create init scripts in `api/postgres/init/`
4. Test postgres container starts with schema

### Phase 2: Entity Framework Setup

1. Install NuGet packages
2. Create `PostgresContext` with all entity mappings
3. Configure in `ServiceCollectionExtensions`
4. Test connection and basic query

### Phase 3: Gateway Implementation

1. Create `IPostgresGateway` interface (copy from `ISupabaseGateway`)
2. Implement `PostgresGateway` with EF Core
3. Implement RLS simulation (user filtering)
4. Write unit tests

### Phase 4: Routing Layer

1. Create `IDataGateway` abstraction
2. Implement `DataGatewayRouter` with header detection
3. Implement dual-path mode with logging
4. Create `DualPathComparer` service
5. Write integration tests

### Phase 5: Controller Updates

1. Update all controllers to use `IDataGateway`
2. Test with all three routing modes
3. Verify logs show proper routing decisions

### Phase 6: Documentation & Polish

1. Write setup documentation
2. Add logging for troubleshooting
3. Add metrics/telemetry for dual-path mode
4. Update task tracker

## Key Files to Create/Modify

**New files**:

- `api/postgres/init/01-schema.sql`
- `api/src/Retroscope.Infrastructure/Postgres/PostgresContext.cs`
- `api/src/Retroscope.Infrastructure/Postgres/PostgresGateway.*.cs` (partial classes)
- `api/src/Retroscope.Infrastructure/Postgres/Entities/*.cs` (EF entities)
- `api/src/Retroscope.Infrastructure/Routing/DataGatewayRouter.cs`
- `api/src/Retroscope.Infrastructure/Routing/DualPathComparer.cs`
- `api/src/Retroscope.Application/Interfaces/IPostgresGateway.*.cs` (partials)
- `api/src/Retroscope.Application/Interfaces/IDataGateway.cs`
- `api/docs/LOCAL_POSTGRES_SETUP.md`

**Modified files**:

- `docker-compose.yml` (add postgres service)
- `api/src/Retroscope.Infrastructure/ServiceCollectionExtensions.cs` (register EF + gateways)
- `api/src/Retroscope.Api/Controllers/*.cs` (inject IDataGateway)
- `api/src/Retroscope.Api/appsettings.Development.json` (add connection string)

## Risks & Mitigations

**Risk**: RLS behavior differs between Supabase and simulated local RLS

- **Mitigation**: Use dual-path mode extensively during development, compare results

**Risk**: Schema drift between Supabase and local Postgres

- **Mitigation**: Document re-export process, consider periodic automated dumps

**Risk**: Supabase functions/RPC calls can't be replicated in Postgres

- **Mitigation**: For now, route function calls only to Supabase; implement in C# later

**Risk**: Performance differences in dual-path mode

- **Mitigation**: Log timing differences, optimize slower path, only use in dev/testing

## Exit Criteria

- ✅ Postgres container runs with full Supabase schema
- ✅ Entity Framework can connect and query all tables
- ✅ `PostgresGateway` implements all methods from `ISupabaseGateway`
- ✅ Header-based routing works for all three modes
- ✅ Dual-path mode logs differences with structured data
- ✅ All unit and integration tests pass
- ✅ Documentation complete and tested

### To-dos

- [ ] Add postgres service to docker-compose.yml with volume and environment configuration
- [ ] Export Supabase schema using db dump and create initialization scripts
- [ ] Install EF Core packages and create PostgresContext with entity mappings
- [ ] Create IPostgresGateway interface matching ISupabaseGateway structure
- [ ] Implement PostgresGateway with EF Core and RLS simulation
- [ ] Create DataGatewayRouter with header-based routing logic
- [ ] Implement DualPathComparer service for logging differences between Supabase and Postgres results
- [ ] Update ServiceCollectionExtensions to register EF Core context and all gateways
- [ ] Update controllers to inject IDataGateway instead of ISupabaseGateway
- [ ] Write unit tests for PostgresGateway and integration tests for DataGatewayRouter
- [ ] Create LOCAL_POSTGRES_SETUP.md and update API README with setup instructions