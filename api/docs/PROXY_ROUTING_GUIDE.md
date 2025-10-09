# Supabase Proxy Controller Routing Guide

## Overview

The `SupabaseProxyController` acts as a smart proxy that routes requests to the appropriate Supabase endpoints (PostgREST for database operations, Edge Functions for serverless functions).

## How It Works

### 1. Request Flow

```
Client → C# API Proxy Controller → Supabase Service
```

### 2. Automatic Routing

The controller automatically determines the correct Supabase service based on the request path:

| Request Path                           | Detects As        | Uses Client      | Routes To                                      |
|----------------------------------------|-------------------|------------------|------------------------------------------------|
| `/api/supabase/teams`                  | Database Query    | PostgrestClient  | `https://.../rest/v1/teams`                    |
| `/api/supabase/rpc/get_team_stats`     | RPC Function      | PostgrestClient  | `https://.../rest/v1/rpc/get_team_stats`       |
| `/api/supabase/functions/send-email`   | Edge Function     | FunctionsClient  | `https://.../functions/v1/send-email`          |

### 3. Detection Logic

```csharp
var isEdgeFunctionRequest = path?.StartsWith("functions/", StringComparison.OrdinalIgnoreCase) ?? false;
var clientName = isEdgeFunctionRequest ? "FunctionsClient" : "PostgrestClient";
```

- **Edge Functions**: Path starts with `functions/` → Uses `FunctionsClient`
- **Everything Else**: Database queries, RPC calls → Uses `PostgrestClient`

### 4. Path Transformation

#### For Edge Functions:
```
Client Request:  /api/supabase/functions/admin-send-notification
Path Extracted:  functions/admin-send-notification
Strip Prefix:    admin-send-notification
Base URL:        https://nwfwbjmzbwuyxehindpv.supabase.co/functions/v1/
Final URL:       https://nwfwbjmzbwuyxehindpv.supabase.co/functions/v1/admin-send-notification
```

#### For Database Queries:
```
Client Request:  /api/supabase/teams?select=*
Path Extracted:  teams
Base URL:        https://nwfwbjmzbwuyxehindpv.supabase.co/rest/v1/
Final URL:       https://nwfwbjmzbwuyxehindpv.supabase.co/rest/v1/teams?select=*
```

#### For RPC Functions:
```
Client Request:  /api/supabase/rpc/get_team_stats
Path Extracted:  rpc/get_team_stats
Base URL:        https://nwfwbjmzbwuyxehindpv.supabase.co/rest/v1/
Final URL:       https://nwfwbjmzbwuyxehindpv.supabase.co/rest/v1/rpc/get_team_stats
```

## Configuration

### Required Environment Variables

Set in `appsettings.json`:

```json
{
  "SUPABASE_POSTGREST_URL": "https://[project-ref].supabase.co/rest/v1",
  "SUPABASE_FUNCTIONS_URL": "https://[project-ref].supabase.co/functions/v1",
  "SUPABASE_ANON_KEY": "your-anon-key-here"
}
```

### HTTP Client Registration

From `ServiceCollectionExtensions.cs`:

```csharp
// PostgREST client for database operations
services.AddHttpClient("PostgrestClient", client => {
    client.BaseAddress = new Uri(configuration["SUPABASE_POSTGREST_URL"]);
});

// Functions client for Edge Functions
services.AddHttpClient("FunctionsClient", client => {
    client.BaseAddress = new Uri(configuration["SUPABASE_FUNCTIONS_URL"]);
});
```

## Header Handling

### Common Headers (All Requests)
- `Authorization`: User's JWT token
- `apikey`: Supabase anon key
- `Accept`: application/json
- `X-Correlation-Id`: Request tracking

### PostgREST-Specific Headers
- `Prefer`: Controls return format (e.g., `return=representation`)
- `Range`: Pagination support

### Edge Functions
- Custom headers from client are forwarded
- PostgREST-specific headers are excluded

## Client Usage Examples

### TypeScript Client

```typescript
import { supabaseProxy } from '@/lib/data/csharpApi/supabaseProxyInstance';

// Database query
const { data, error } = await supabaseProxy
  .from('teams')
  .select('*')
  .eq('id', teamId);

// RPC function call
const { data, error } = await supabaseProxy
  .rpc('get_team_stats', { team_id: teamId });

// Edge Function invocation
const { data, error } = await supabaseProxy.functions
  .invoke('admin-send-notification', {
    body: { message: 'Hello' }
  });
```

## Error Handling

The controller returns appropriate HTTP status codes:

- `401 Unauthorized`: Missing authorization header
- `502 Bad Gateway`: Failed to proxy request to Supabase
- Other codes: Forwarded from Supabase response

## Logging

The controller logs:
- Request method and URL
- Client type used (PostgrestClient vs FunctionsClient)
- Response status and content length
- Errors with full exception details

## Security

1. **Authorization Required**: All requests must include a valid JWT token
2. **API Key Injection**: Supabase anon key is added server-side
3. **Header Filtering**: Only safe headers are forwarded
4. **No Token Exposure**: Client never sees the anon key

## Performance Features

1. **Retry Policy**: Automatic retries with exponential backoff for transient errors
2. **Compression**: Automatic decompression of responses
3. **Connection Pooling**: HttpClient reuse for better performance

## Troubleshooting

### 404 Not Found on Edge Function

**Symptom**: Edge function call returns 404

**Cause**: Wrong routing (going to `/rest/v1/functions/` instead of `/functions/v1/`)

**Solution**: Ensure path starts with `functions/` and configuration is correct

### RPC Function Not Working

**Symptom**: RPC call fails

**Cause**: Path should be `rpc/function_name`, not `functions/rpc/function_name`

**Solution**: Use client.rpc() which automatically adds the correct prefix

### Missing Headers

**Symptom**: PostgREST returns unexpected format

**Cause**: Missing `Prefer` header

**Solution**: Client should add appropriate headers for the operation:
```typescript
.insert(data, { returning: 'representation' })
```

## Future Enhancements

Potential additions:
- Auth endpoint proxying (`/auth/v1/`)
- Storage endpoint proxying (`/storage/v1/`)
- Realtime WebSocket proxying
- Request/response transformation middleware
- Caching layer for read operations

