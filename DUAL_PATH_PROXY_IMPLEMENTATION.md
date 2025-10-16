# Dual-Path SupabaseProxyController Implementation

## Summary

Implementation of dual-path support for the `SupabaseProxyController` using PostgREST for local Postgres database access.

## ✅ Completed

### 1. PostgREST Container

- **File**: `docker-compose.yml`
- Added PostgREST service (v12.2.3) that provides a REST API in front of local Postgres
- Configured with:
  - JWT authentication (using same secret as Supabase)
  - RLS enforcement via `retroscope_app` user
  - PostgREST schema: `public`
  - Anonymous role: `anon`
- Exposes port 3000 internally (not exposed to host)

### 2. LocalPostgrestClient Registration

- **File**: `api/src/Retroscope.Infrastructure/ServiceCollectionExtensions.cs`
- Registered `LocalPostgrestClient` HttpClient
- Configured with:
  - Base address: `http://postgrest:3000`
  - Automatic decompression
  - Retry policies (same as other clients)
- Added `LOCAL_POSTGREST_URL` environment variable to `docker-compose.yml`

### 3. SupabaseProxyController Dual-Path Logic

- **File**: `api/src/Retroscope.Api/Controllers/SupabaseProxyController.cs`
- **Updated** `ProxyRequest` method to detect routing headers:
  - `X-UseLocalPostgres`: Route to local PostgREST instead of Supabase
  - `X-DualPath`: Send to both, compare results, return Supabase as primary
- **Edge Functions**: Always route to Supabase (no local equivalent yet)
- **Database requests**: Support three routing modes based on headers

### 4. New Helper Methods

Added three new private methods to `SupabaseProxyController`:

#### a. `ProxySingleRequest`

- Routes request to a single backend (Supabase or local PostgREST)
- Accepts `clientName` parameter to select HttpClient
- Logs which client is being used

#### b. `ProxyDualPath`

- Executes request to both Supabase and local PostgREST in parallel
- Measures execution time for both
- Compares results and logs any differences
- Returns Supabase response as primary

#### c. `CompareResponses`

- Compares HTTP status codes and response content
- Logs matches vs. differences
- For small responses (<5000 chars), logs full content diff
- Includes correlation ID and timing information

### 5. Updated BuildSupabaseRequest

- **File**: `api/src/Retroscope.Api/Controllers/SupabaseProxyController.cs`
- Added `clientName` parameter (default: `"PostgrestClient"`)
- Conditionally adds `apikey` header:
  - **Supabase**: Includes `apikey` header
  - **Local PostgREST**: Omits `apikey` (uses JWT auth only)

### 6. Controller Deprecation

Added `[Obsolete]` attribute and XML comments to all typed controllers:

- `NotificationsController`
- `TeamsController`
- `ProfilesController`
- `TeamInvitationsController`
- `TeamMembersController`
- `RetroCommentsController`
- `RetroBoardsController`
- `FeatureFlagsController`
- `AvatarsController`
- `AdminNotificationsController`

**Note**: Controllers are marked deprecated but still functional for gradual migration.

### 7. Documentation Updates

- **File**: `api/postgres/QUICK_REFERENCE.md`
- Added "SupabaseProxyController Routing" section
- Documented three routing modes with examples
- Clarified Edge Functions always route to Supabase
- Added example curl commands for testing dual-path

### 8. Fixed Interface Signatures

- **Files**:
  - `api/src/Retroscope.Application/Interfaces/IPostgresGateway.Storage.cs`
  - `api/src/Retroscope.Infrastructure/Postgres/PostgresGateway.Storage.cs`
- Fixed `UploadAvatarAsync` signature to match `ISupabaseGateway`:
  - From: `Task<string> UploadAvatarAsync(string bearerToken, AvatarUpload upload, ...)`
  - To: `Task<AvatarUploadResponse> UploadAvatarAsync(string bearerToken, string userId, byte[] bytes, string contentType, ...)`
- Renamed `GetAvatarUrlAsync` to `GetAvatarPublicUrlAsync` to match `ISupabaseGateway`

## ✅ Clean Architecture

All typed controllers and the DataGatewayRouter infrastructure have been removed for a clean, single-path architecture:

**Removed Components**:

- All typed controllers (`NotificationsController`, `TeamsController`, `ProfilesController`, etc.)
- `DataGatewayRouter` (routing layer)
- `DualPathComparer` (comparison service)
- `IDataGateway` interface
- `IPostgresGateway` interface and all implementations
- `PostgresGateway` class (all partial files)
- `PostgresContext` (EF Core DbContext)
- All Postgres entity classes

**Rationale**: The SupabaseProxyController provides all routing functionality directly via HTTP, making the typed controller layer unnecessary. PostgREST handles the database access, eliminating the need for EF Core entities and the Postgres gateway layer.

**Result**: Simpler architecture with a single source of truth for routing.

## Routing Modes

### Via SupabaseProxyController (`/api/supabase/*`)

| Mode          | Headers                                          | Database           | Edge Functions |
| ------------- | ------------------------------------------------ | ------------------ | -------------- |
| **Supabase**  | _(none)_                                         | → Supabase         | → Supabase     |
| **Postgres**  | `X-UseLocalPostgres: true`                       | → Local PostgREST  | → Supabase     |
| **Dual-Path** | `X-UseLocalPostgres: true`<br>`X-DualPath: true` | → Both (logs diff) | → Supabase     |

### Via Typed Controllers (`/api/notifications`, `/api/teams`, etc.)

**Status**: ❌ Removed

The typed controllers have been removed entirely. Use `SupabaseProxyController` (`/api/supabase/*`) for all data access.

## Testing

### Test Local PostgREST (Single Path)

```bash
curl -X GET "http://localhost:5228/api/supabase/notifications?select=*&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-UseLocalPostgres: true"
```

### Test Dual-Path

```bash
curl -X GET "http://localhost:5228/api/supabase/notifications?select=*&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-UseLocalPostgres: true" \
  -H "X-DualPath: true"

# Check logs
docker-compose logs -f api-dev | grep "DualPath"
```

Expected log output:

```
DualPath: Results MATCH (CorrelationId: abc-123, Duration: 45ms, Status: OK)
```

or:

```
DualPath: Results DIFFER (CorrelationId: abc-123, Duration: 45ms) StatusMatch: True, ContentMatch: False, Supabase: OK (1234 chars), Postgres: OK (1230 chars)
```

## Next Steps

1. **Test dual-path functionality**

   - Start containers: `docker-compose up -d`
   - Test single-path local: Add `X-UseLocalPostgres: true` header
   - Test dual-path: Add both `X-UseLocalPostgres: true` and `X-DualPath: true` headers
   - Monitor logs: `docker-compose logs -f api-dev | grep "DualPath"`

2. **Migrate frontend to use SupabaseProxyController**

   - Update API calls to use `/api/supabase/*` endpoints
   - Remove direct Supabase client usage
   - Add routing headers as needed for testing

3. **Edge Functions (Future)**
   - Implement local C# equivalents for Supabase Edge Functions
   - Update `SupabaseProxyController` to route to local functions when available

## Key Files Modified/Added

1. `docker-compose.yml` - Added postgrest service, updated api-dev environment
2. `api/src/Retroscope.Infrastructure/ServiceCollectionExtensions.cs` - Registered LocalPostgrestClient, removed typed controller infrastructure
3. `api/src/Retroscope.Api/Controllers/SupabaseProxyController.cs` - Added dual-path logic
4. `api/postgres/QUICK_REFERENCE.md` - Documented routing modes
5. `DUAL_PATH_PROXY_IMPLEMENTATION.md` - Complete implementation documentation

## Key Files Removed

1. All typed controllers (10 files) - `NotificationsController.cs`, `TeamsController.cs`, etc.
2. `api/src/Retroscope.Infrastructure/Routing/DataGatewayRouter.cs` - Routing infrastructure
3. `api/src/Retroscope.Infrastructure/Routing/DualPathComparer.cs` - Comparison service
4. `api/src/Retroscope.Application/Interfaces/IDataGateway.cs` - Gateway interface
5. All `IPostgresGateway` partial files (9 files) - Gateway interfaces
6. All `PostgresGateway` partial files (10 files) - Gateway implementations
7. `api/src/Retroscope.Infrastructure/Postgres/PostgresContext.cs` - EF Core context
8. All Postgres entity files - `Notification.cs`, `Profile.cs`, `Team.cs`, etc.

## Architecture

```
Frontend
   ↓
C# API (SupabaseProxyController)
   ↓
   ├─→ Supabase PostgREST (production)
   ├─→ Local PostgREST (development/testing)
   └─→ Both (dual-path comparison)
       ↓
   Local Postgres (with RLS)
```

PostgREST provides the same REST API interface as Supabase, allowing seamless switching between backends.
