# Retroscope API Documentation

This directory contains documentation for the Retroscope C# API.

## Available Documentation

### [Supabase Proxy Controller](./SUPABASE_PROXY.md)
Complete documentation for the generic Supabase proxy controller, including:
- Overview and key features
- Usage examples for all HTTP methods
- Headers and error handling
- PostgREST features support
- Future enhancements

### [Supabase Proxy Frontend Examples](./SUPABASE_PROXY_EXAMPLES.md)
Practical frontend examples for using the proxy controller:
- JavaScript/TypeScript implementation
- React hooks for queries and mutations
- Filtering, pagination, and embedded resources
- Error handling strategies
- Comparison with direct Supabase client

## Quick Start

### Using the Proxy from Frontend

```typescript
// 1. Make a request to any Supabase table
const teams = await fetch('/api/supabase/teams?select=*', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  }
}).then(r => r.json());

// 2. Create a record
await fetch('/api/supabase/teams', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  },
  body: JSON.stringify({ name: 'My Team' }),
});

// 3. Call an RPC function
await fetch('/api/supabase/rpc/my_function', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ param: 'value' }),
});
```

## Architecture Overview

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│              │         │              │         │              │
│   Frontend   │────────>│  C# API      │────────>│  Supabase    │
│   (React)    │         │  (Proxy)     │         │  PostgREST   │
│              │<────────│              │<────────│              │
└──────────────┘         └──────────────┘         └──────────────┘
```

### Benefits of this Architecture

1. **Centralized Authentication**: JWT validation happens once in the C# API
2. **Backend Control**: Add logging, rate limiting, or custom logic
3. **Future-Ready**: Can switch to direct PostgreSQL without changing frontend
4. **Type Safety**: Generate TypeScript types from C# DTOs
5. **Consistent Error Handling**: All errors flow through the same pipeline

## Project Structure

```
api/
├── docs/                           # Documentation (you are here)
│   ├── README.md                  # This file
│   ├── SUPABASE_PROXY.md          # Proxy controller docs
│   └── SUPABASE_PROXY_EXAMPLES.md # Frontend examples
├── src/
│   ├── Retroscope.Api/
│   │   ├── Controllers/
│   │   │   ├── SupabaseProxyController.cs    # Generic proxy
│   │   │   ├── TeamsController.cs            # Typed controller example
│   │   │   └── ...
│   │   └── Program.cs                        # API configuration
│   ├── Retroscope.Application/
│   │   ├── DTOs/                             # Data transfer objects
│   │   └── Interfaces/                       # Service interfaces
│   └── Retroscope.Infrastructure/
│       ├── Supabase/
│       │   ├── SupabaseGateway.Base.cs      # Gateway foundation
│       │   ├── SupabaseGateway.Teams.cs     # Teams-specific methods
│       │   └── ...
│       └── ServiceCollectionExtensions.cs    # DI setup
└── tests/
    ├── Retroscope.Api.IntegrationTests/
    │   ├── SupabaseProxyIntegrationTests.cs  # Proxy tests
    │   └── ...
    └── Retroscope.Api.UnitTests/
```

## Controllers Comparison

### Typed Controller (TeamsController)
```csharp
[HttpGet("{teamId}")]
public async Task<ActionResult<TeamDetailsResponse>> GetTeamById(string teamId)
{
    var response = await supabaseGateway.GetTeamByIdAsync(authHeader, teamId);
    if (response.Team == null) return NotFound();
    return Ok(response);
}
```

**Pros:**
- Strong typing and validation
- Better IDE support
- Explicit API contract
- Easy to add custom logic

**Cons:**
- More code to maintain
- Slower to develop
- Need DTOs for each entity

### Proxy Controller (SupabaseProxyController)
```csharp
[HttpGet]
[HttpPost]
[HttpPatch]
[HttpPut]
[HttpDelete]
public async Task<IActionResult> ProxyRequest(string? path = null)
{
    // Forwards everything to Supabase
}
```

**Pros:**
- Zero-maintenance forwarding
- Works with any Supabase feature
- Fast to develop
- Type-agnostic

**Cons:**
- No compile-time type safety
- Harder to add custom logic
- Less explicit API contract

### When to Use Each

**Use Typed Controllers when:**
- You need custom business logic
- You want strong type safety
- The endpoint is frequently used
- You need detailed API documentation

**Use Proxy Controller when:**
- Rapid prototyping
- CRUD operations without logic
- One-off queries
- Admin/internal tools

## Testing

### Run All Tests
```bash
cd api
dotnet test
```

### Run Proxy Tests Only
```bash
cd api
dotnet test --filter "FullyQualifiedName~SupabaseProxyIntegrationTests"
```

### Run with Coverage
```bash
cd api
dotnet test --collect:"XPlat Code Coverage"
```

## Development

### Prerequisites
- .NET 10.0 SDK or later
- Supabase project with PostgREST enabled

### Configuration

Set these environment variables or add to `appsettings.Development.json`:

```json
{
  "SUPABASE_URL": "https://your-project.supabase.co",
  "SUPABASE_POSTGREST_URL": "https://your-project.supabase.co/rest/v1",
  "SUPABASE_ANON_KEY": "your-anon-key",
  "ALLOW_ORIGINS": "http://localhost:5173,http://localhost:3000"
}
```

### Run the API

```bash
cd api/src/Retroscope.Api
dotnet run
```

The API will be available at `http://localhost:5000` (or as configured).

## Roadmap

### Current Features
- ✅ Generic proxy to Supabase PostgREST
- ✅ Support for all HTTP methods
- ✅ Header forwarding (Authorization, Prefer, Range, etc.)
- ✅ Query parameter preservation
- ✅ Error pass-through
- ✅ Comprehensive integration tests

### Planned Features
- 🚧 Direct PostgreSQL support (bypass Supabase)
- 🚧 Query optimization and caching
- 🚧 Request/response logging
- 🚧 Rate limiting
- 🚧 SQL query generation from PostgREST syntax
- 🚧 TypeScript type generation from database schema

## Contributing

When adding new controllers or features:

1. Follow the existing patterns in `TeamsController` or `SupabaseProxyController`
2. Add DTOs to `Retroscope.Application/DTOs`
3. Create gateway methods in `Retroscope.Infrastructure/Supabase`
4. Write integration tests
5. Update documentation

## See Also

- [PostgREST Documentation](https://postgrest.org/en/stable/)
- [Supabase REST API](https://supabase.com/docs/guides/api)
- [ASP.NET Core Documentation](https://learn.microsoft.com/en-us/aspnet/core/)

