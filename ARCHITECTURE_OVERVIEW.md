# Retroscope Architecture Overview

## Dual-Path System Architecture

This application uses a **dual-path architecture** for both authentication and data access, allowing parallel operation of Supabase and local implementations.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Frontend                                │
│                     (React + TypeScript)                         │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ HTTP Requests
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                       C# API Gateway                             │
│                    (ASP.NET Core 8.0)                           │
│                                                                  │
│  ┌──────────────────────────┐  ┌─────────────────────────────┐ │
│  │   Authentication Layer    │  │    Data Access Layer        │ │
│  │  (Dual-Path Routing)     │  │   (Dual-Path Routing)       │ │
│  └────┬──────────────┬──────┘  └─────┬──────────────┬────────┘ │
└───────┼──────────────┼───────────────┼──────────────┼──────────┘
        │              │               │              │
        │              │               │              │
   ┌────▼─────┐   ┌───▼────┐    ┌─────▼─────┐  ┌────▼─────┐
   │ Supabase │   │ Local  │    │ Supabase  │  │  Local   │
   │   Auth   │   │  Auth  │    │ PostgREST │  │PostgREST │
   └──────────┘   └───┬────┘    └───────────┘  └────┬─────┘
                      │                              │
                      │                              │
                  ┌───▼──────────────────────────────▼────┐
                  │      Local Postgres Database          │
                  │      (with RLS Policies)              │
                  └───────────────────────────────────────┘
```

## Authentication Flow

### Supabase Auth Path (Default)

```
Frontend
   │
   │ POST /auth/v1/token
   │ (via Supabase SDK)
   ▼
Supabase Auth Service
   │
   │ Returns JWT (RSA signed)
   ▼
Frontend stores token
   │
   │ API Request
   │ Authorization: Bearer <supabase-token>
   │ (no X-UseLocalAuth header)
   ▼
C# API
   │
   │ Validates JWT via JWKS
   ▼
Supabase JWKS Endpoint
   │
   │ Returns public keys
   ▼
C# API validates signature
   │
   │ Success
   ▼
Protected endpoint accessed
```

### Local Auth Path (Opt-in)

```
Frontend
   │
   │ POST /auth/v1/token
   │ (via local API)
   ▼
C# API AuthController
   │
   │ Validates credentials
   ▼
Local Postgres auth.users
   │
   │ Returns user
   ▼
C# API generates JWT (HMAC-SHA256 signed)
   │
   │ Returns JWT + refresh token
   ▼
Frontend stores token
   │
   │ API Request
   │ Authorization: Bearer <local-token>
   │ X-UseLocalAuth: true
   ▼
C# API
   │
   │ Validates JWT with local secret
   ▼
C# API validates signature
   │
   │ Success
   ▼
Protected endpoint accessed
```

## Data Access Flow

### Supabase PostgREST Path (Default)

```
Frontend
   │
   │ GET /api/supabase/teams?select=*
   │ Authorization: Bearer <token>
   │ (no X-UseLocalPostgres header)
   ▼
C# API SupabaseProxyController
   │
   │ Proxies request
   ▼
Supabase PostgREST
   │
   │ Executes query with RLS
   ▼
Supabase Postgres
   │
   │ Returns data
   ▼
Response sent to frontend
```

### Local Postgres Path (Opt-in)

```
Frontend
   │
   │ GET /api/supabase/teams?select=*
   │ Authorization: Bearer <token>
   │ X-UseLocalPostgres: true
   ▼
C# API SupabaseProxyController
   │
   │ Proxies request
   ▼
Local PostgREST
   │
   │ Executes query with RLS
   ▼
Local Postgres
   │
   │ Returns data
   ▼
Response sent to frontend
```

### Dual-Path Mode (Testing/Comparison)

```
Frontend
   │
   │ GET /api/supabase/teams?select=*
   │ Authorization: Bearer <token>
   │ X-UseLocalPostgres: true
   │ X-DualPath: true
   ▼
C# API SupabaseProxyController
   │
   ├──────────────┬──────────────┐
   │              │              │
   ▼              ▼              │
Supabase     Local PostgREST    │
PostgREST        │              │
   │              │              │
   ▼              ▼              │
Supabase     Local Postgres     │
Postgres         │              │
   │              │              │
   └──────────────┴──────────────┘
                  │
                  ▼
         Compare results
         Log differences
                  │
                  ▼
       Return Supabase response
       (primary)
```

## Header-Based Routing

### Authentication Headers

| Header           | Value  | Effect            |
| ---------------- | ------ | ----------------- |
| _(none)_         | -      | Use Supabase Auth |
| `X-UseLocalAuth` | `true` | Use Local Auth    |

### Data Access Headers

| Header                              | Value           | Effect                               |
| ----------------------------------- | --------------- | ------------------------------------ |
| _(none)_                            | -               | Use Supabase PostgREST               |
| `X-UseLocalPostgres`                | `true`          | Use Local PostgREST                  |
| `X-UseLocalPostgres` + `X-DualPath` | `true` + `true` | Query both, compare, return Supabase |

## Database Schema

### Supabase (Cloud)

- Full Supabase schema
- RLS policies
- auth.users managed by Supabase Auth

### Local Postgres (Self-hosted)

- Replicated Supabase schema
- Same RLS policies
- auth.users managed by Local Auth
- Additional tables:
  - `auth.identities` - OAuth identities
  - `auth.refresh_tokens` - Refresh tokens
  - `auth.verification_codes` - Email verification

## Component Responsibilities

### Frontend

- Makes HTTP requests to C# API
- Stores JWT tokens
- Adds routing headers (`X-UseLocalAuth`, `X-UseLocalPostgres`)
- Handles OAuth flows

### C# API Gateway

- Routes authentication requests
- Routes data access requests
- Validates JWTs (both Supabase and local)
- Proxies requests to appropriate backend
- Logs dual-path comparisons

### Supabase

- OAuth provider (GitHub, Google)
- JWT signing (RSA keys)
- PostgREST API
- Postgres database with RLS

### Local Auth

- Custom JWT signing (HMAC-SHA256)
- OAuth provider (configurable)
- User management
- Token refresh

### Local PostgREST

- REST API over Postgres
- JWT validation
- RLS enforcement
- Same API as Supabase PostgREST

### Local Postgres

- Replicated schema
- RLS policies
- Auth tables
- Application data

## Security Layers

### 1. Authentication

- JWT validation (signature, expiration, issuer, audience)
- Dual-path support (Supabase RSA or local HMAC)

### 2. Authorization

- Row Level Security (RLS) policies
- User ID extracted from JWT
- Applied at database level

### 3. Transport

- HTTPS in production
- CORS configuration
- Bearer token authentication

### 4. Database

- Connection strings in environment variables
- Separate users for different access levels
- RLS policies enforce data isolation

## Migration Strategy

### Phase 1: Parallel Operation (Current)

```
All Users
  ├─→ 95% → Supabase Auth + Supabase Data
  └─→ 5% → Local Auth + Local Data (testing)
```

### Phase 2: Gradual Migration

```
All Users
  ├─→ 70% → Supabase Auth + Supabase Data
  ├─→ 20% → Local Auth + Local Data
  └─→ 10% → Mixed (testing combinations)
```

### Phase 3: Complete Local

```
All Users
  └─→ 100% → Local Auth + Local Data
```

Supabase can be removed after Phase 3.

## Monitoring and Debugging

### Response Headers

- `X-Auth-System: Supabase` or `Local`
- `X-Correlation-Id` - Request tracking

### Logs

```bash
# Watch auth routing
docker-compose logs -f api-dev | grep "X-Auth-System"

# Watch data routing
docker-compose logs -f api-dev | grep "DualPath"
```

### Metrics

- Request counts by auth system
- Response times (Supabase vs Local)
- Dual-path comparison results

## Technology Stack

### Frontend

- React 18
- TypeScript
- Supabase JS Client (for Supabase auth)
- Fetch API (for local auth)

### Backend

- ASP.NET Core 8.0
- C#
- Serilog (logging)
- Entity Framework Core (local auth)

### Database

- PostgreSQL 15
- PostgREST 12
- Row Level Security

### Infrastructure

- Docker & Docker Compose
- Nginx (reverse proxy in production)

## Key Files

### Documentation

- `DUAL_PATH_QUICK_REFERENCE.md` - Quick reference
- `DUAL_PATH_AUTH_IMPLEMENTATION.md` - Auth details
- `DUAL_PATH_PROXY_IMPLEMENTATION.md` - Data proxy details
- `ARCHITECTURE_OVERVIEW.md` - This file

### Configuration

- `docker-compose.yml` - Service configuration
- `appsettings.json` - API configuration
- `.env` - Environment variables (local)

### Code

- `Program.cs` - Application setup
- `ServiceCollectionExtensions.cs` - Dual-path auth config
- `SupabaseProxyController.cs` - Dual-path data routing
- `AuthController.cs` - Local auth endpoints

## Benefits of Dual-Path Architecture

### ✅ Zero Downtime Migration

- Both systems work simultaneously
- Switch per-request with headers
- No service interruption

### ✅ Risk Mitigation

- Can roll back instantly
- Test thoroughly before full migration
- Validate data consistency

### ✅ Flexibility

- Test different combinations
- Compare performance
- Gradual user migration

### ✅ Developer Experience

- Familiar patterns
- Easy to test locally
- Clear documentation
