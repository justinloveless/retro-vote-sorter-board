# Supabase Proxy Controller

## Overview

The `SupabaseProxyController` is a generic pass-through controller that forwards all HTTP requests to the Supabase PostgREST API without caring about data types or request structure. It acts as a transparent proxy between your frontend and Supabase.

## Key Features

- **Type-Agnostic**: Forwards any request/response without parsing or validating the data
- **All HTTP Methods**: Supports GET, POST, PATCH, PUT, DELETE, HEAD, and OPTIONS
- **Header Forwarding**: Automatically forwards relevant headers (Authorization, Prefer, Range, etc.)
- **Query Parameter Preservation**: Maintains all query parameters from the original request
- **Error Pass-Through**: Forwards Supabase errors directly to the client
- **Future-Ready**: Designed to eventually support direct PostgreSQL queries

## Usage

### Base Route

All proxy requests go through the `/api/supabase/` route:

```
/api/supabase/{path}
```

Where `{path}` is any valid PostgREST endpoint (e.g., `teams`, `retro_boards`, `rpc/custom_function`)

### Examples

#### Get All Teams
```http
GET /api/supabase/teams?select=*&order=created_at.desc
Authorization: Bearer {your-jwt-token}
```

This forwards to:
```http
GET {SUPABASE_URL}/teams?select=*&order=created_at.desc
```

#### Create a New Item
```http
POST /api/supabase/items
Authorization: Bearer {your-jwt-token}
Prefer: return=representation
Content-Type: application/json

{
  "name": "New Item",
  "description": "Item description"
}
```

#### Update with Prefer Header
```http
PATCH /api/supabase/items?id=eq.123
Authorization: Bearer {your-jwt-token}
Prefer: return=representation
Content-Type: application/json

{
  "name": "Updated Name"
}
```

#### Call an RPC Function
```http
POST /api/supabase/rpc/custom_function
Authorization: Bearer {your-jwt-token}
Content-Type: application/json

{
  "param1": "value1",
  "param2": 42
}
```

#### Delete a Record
```http
DELETE /api/supabase/items?id=eq.123
Authorization: Bearer {your-jwt-token}
```

## Forwarded Headers

The controller automatically forwards the following headers from your request to Supabase:

- `Authorization` (required) - Your JWT token from Supabase auth
- `Prefer` - PostgREST preferences (e.g., `return=representation`, `resolution=merge-duplicates`)
- `Range` - For pagination requests
- `Accept` - Content type preferences
- `Accept-Encoding` - Compression preferences
- `Accept-Language` - Language preferences
- `X-Tenant` - Multi-tenancy support
- `X-Correlation-Id` - Request tracing

## Response Headers

The controller forwards these response headers from Supabase back to you:

- `Content-Type` - The response content type
- `Content-Range` - Pagination information
- All custom headers from Supabase (except `Transfer-Encoding` and `Connection`)

## Authentication

The controller requires authentication via the `[Authorize]` attribute. You must include a valid `Authorization` header with a Bearer token:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Without a valid token, the controller returns `401 Unauthorized`.

## Error Handling

The controller passes through all Supabase errors with their original status codes and error messages:

- `401 Unauthorized` - Invalid or expired token
- `403 Forbidden` - Insufficient permissions (RLS policy violation)
- `404 Not Found` - Resource not found
- `409 Conflict` - Constraint violation (e.g., foreign key, unique)
- `422 Unprocessable Entity` - Invalid data format
- `500 Internal Server Error` - Supabase service error
- `502 Bad Gateway` - Proxy/network error

## PostgREST Features

Since this is a direct proxy to PostgREST, all PostgREST features are supported:

### Filtering
```http
GET /api/supabase/teams?name=eq.MyTeam&created_at=gt.2024-01-01
```

### Ordering
```http
GET /api/supabase/teams?order=created_at.desc,name.asc
```

### Pagination
```http
GET /api/supabase/teams?limit=10&offset=20
```

Or with Range header:
```http
GET /api/supabase/teams
Range: 0-9
```

### Selecting Columns
```http
GET /api/supabase/teams?select=id,name,created_at
```

### Embedded Resources
```http
GET /api/supabase/teams?select=id,name,team_members(user_id,role)
```

### RPC Functions
```http
POST /api/supabase/rpc/function_name
Content-Type: application/json

{
  "param1": "value"
}
```

## Configuration

The controller uses these configuration values:

- `SUPABASE_POSTGREST_URL` - Base URL for PostgREST API
- `SUPABASE_ANON_KEY` - Anonymous key for Supabase
- `ALLOW_ORIGINS` - CORS origins (configured in Program.cs)

## Future Enhancements

### Direct PostgreSQL Support (Planned)

In the future, this controller will support optionally bypassing Supabase and directly querying a PostgreSQL database:

```csharp
// Future implementation
if (useDirectPostgres)
{
    return await ExecutePostgresQuery(request);
}
else
{
    return await ForwardToSupabase(request);
}
```

This will allow for:
- Better performance by eliminating the extra network hop
- More control over query optimization
- Support for database features not available in PostgREST
- Easier migration away from Supabase if needed

## Testing

The controller includes comprehensive integration tests in `SupabaseProxyIntegrationTests.cs`:

```bash
cd api
dotnet test --filter "FullyQualifiedName~SupabaseProxyIntegrationTests"
```

## See Also

- [PostgREST Documentation](https://postgrest.org/en/stable/)
- [Supabase REST API Documentation](https://supabase.com/docs/guides/api)
- [TeamsController](../src/Retroscope.Api/Controllers/TeamsController.cs) - Example of typed controller
- [SupabaseGateway](../src/Retroscope.Infrastructure/Supabase/) - Typed Supabase client

