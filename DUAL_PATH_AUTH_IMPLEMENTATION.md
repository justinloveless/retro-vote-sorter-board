# Dual-Path Authentication Implementation

## Summary

Implementation of dual-path authentication support for both **Supabase Auth** and **Local Auth** systems, allowing seamless migration and testing with header-based routing.

## Overview

Similar to the dual-path proxy for data access, the authentication system now supports two backends:

1. **Supabase Auth** (default) - Existing Supabase authentication with OAuth providers
2. **Local Auth** (opt-in) - New local authentication system with custom JWT signing

## Architecture

```
Frontend Request
   ↓
   ├─→ Without X-UseLocalAuth header → Supabase JWT Validation
   └─→ With X-UseLocalAuth: true → Local JWT Validation
```

Both systems:

- Use JWT tokens
- Support the same `authenticated` audience
- Return compatible user structures
- Work with the same `Authorization: Bearer <token>` header format

## Authentication Routing Modes

### 1. Supabase Auth (Default)

**When to use**: Production, existing users, OAuth providers

**Request headers**:

```
Authorization: Bearer <supabase-jwt-token>
```

**How it works**:

- Validates JWT against Supabase JWKS endpoint
- Uses RSA signature validation
- Checks issuer matches Supabase URL
- Audience must be "authenticated"

**Example**:

```bash
curl http://localhost:5228/api/teams \
  -H "Authorization: Bearer eyJhbGc...supabase-token"
```

### 2. Local Auth (Opt-in)

**When to use**: Testing, new users, development, migration

**Request headers**:

```
Authorization: Bearer <local-jwt-token>
X-UseLocalAuth: true
```

**How it works**:

- Validates JWT against local JWT secret (HMAC-SHA256)
- Checks issuer matches local API URL
- Audience must be "authenticated"
- User data comes from local Postgres `auth.users` table

**Example**:

```bash
curl http://localhost:5228/api/teams \
  -H "Authorization: Bearer eyJhbGc...local-token" \
  -H "X-UseLocalAuth: true"
```

## Authentication Endpoints

### Supabase Auth Endpoints

All existing Supabase auth endpoints continue to work:

| Method | Endpoint                                                  | Description       |
| ------ | --------------------------------------------------------- | ----------------- |
| POST   | `https://nwfwbjmzbwuyxehindpv.supabase.co/auth/v1/signup` | Supabase signup   |
| POST   | `https://nwfwbjmzbwuyxehindpv.supabase.co/auth/v1/token`  | Supabase signin   |
| GET    | `https://nwfwbjmzbwuyxehindpv.supabase.co/auth/v1/user`   | Get Supabase user |

### Local Auth Endpoints

New local auth endpoints (proxied through C# API):

| Method | Endpoint                         | Description         |
| ------ | -------------------------------- | ------------------- |
| POST   | `/auth/v1/signup`                | Local signup        |
| POST   | `/auth/v1/token`                 | Local signin        |
| POST   | `/auth/v1/refresh`               | Refresh local token |
| GET    | `/auth/v1/user`                  | Get local user      |
| GET    | `/auth/v1/authorize`             | OAuth authorization |
| GET    | `/auth/v1/callback`              | OAuth callback      |
| GET    | `/auth/v1/.well-known/jwks.json` | Local JWKS endpoint |

## Configuration

### Environment Variables

```bash
# Supabase Auth (existing)
SUPABASE_URL=https://nwfwbjmzbwuyxehindpv.supabase.co
SUPABASE_JWKS_URL=https://nwfwbjmzbwuyxehindpv.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_ANON_KEY=eyJhbGc...

# Local Auth (new)
ConnectionStrings__DefaultConnection=Host=postgres;Port=5432;Database=retroscope;Username=retroscope_app;Password=retroscope_app_pass
JWT__Secret=your-super-secret-key-min-32-chars-long-for-jwt-signing
JWT__Issuer=http://localhost:5228

# OAuth Providers (for local auth)
OAuth__GitHub__ClientId=your-github-client-id
OAuth__GitHub__ClientSecret=your-github-client-secret
OAuth__GitHub__RedirectUri=http://localhost:5228/auth/v1/callback
OAuth__Google__ClientId=your-google-client-id
OAuth__Google__ClientSecret=your-google-client-secret
OAuth__Google__RedirectUri=http://localhost:5228/auth/v1/callback
```

### appsettings.json

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=retroscope;Username=retroscope_app;Password=retroscope_app_pass"
  },
  "JWT": {
    "Secret": "your-super-secret-key-min-32-chars-long-for-jwt-signing",
    "Issuer": "http://localhost:5228"
  },
  "OAuth": {
    "GitHub": {
      "ClientId": "your-github-client-id",
      "ClientSecret": "your-github-client-secret",
      "RedirectUri": "http://localhost:5228/auth/v1/callback"
    },
    "Google": {
      "ClientId": "your-google-client-id",
      "ClientSecret": "your-google-client-secret",
      "RedirectUri": "http://localhost:5228/auth/v1/callback"
    }
  },
  "SUPABASE_URL": "https://nwfwbjmzbwuyxehindpv.supabase.co",
  "SUPABASE_JWKS_URL": "https://nwfwbjmzbwuyxehindpv.supabase.co/auth/v1/.well-known/jwks.json"
}
```

## Development Mode

In development (`ASPNETCORE_ENVIRONMENT=Development`):

- Uses `DevelopmentAuthHandler` that bypasses full JWT validation
- Allows easy testing without real tokens
- Automatically sets user context for debugging

## Production Mode

In production:

- Full JWT validation for both auth systems
- Multi-scheme authentication with policy-based routing
- Header-based selection between Supabase and Local auth

## Testing

### Test Supabase Auth

```bash
# Sign in with Supabase
curl -X POST https://nwfwbjmzbwuyxehindpv.supabase.co/auth/v1/token?grant_type=password \
  -H "Content-Type: application/json" \
  -H "apikey: <anon-key>" \
  -d '{"email": "user@example.com", "password": "password123"}'

# Use token to access API (no X-UseLocalAuth header)
curl http://localhost:5228/api/notifications \
  -H "Authorization: Bearer <supabase-token>"

# Response includes:
# X-Auth-System: Supabase
```

### Test Local Auth

```bash
# Sign up with local auth
curl -X POST http://localhost:5228/auth/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "localuser@example.com", "password": "password123"}'

# Sign in with local auth
curl -X POST http://localhost:5228/auth/v1/token?grant_type=password \
  -H "Content-Type: application/json" \
  -d '{"email": "localuser@example.com", "password": "password123"}'

# Use token to access API (WITH X-UseLocalAuth header)
curl http://localhost:5228/api/notifications \
  -H "Authorization: Bearer <local-token>" \
  -H "X-UseLocalAuth: true"

# Response includes:
# X-Auth-System: Local
```

### Test OAuth with Local Auth

```bash
# Initiate GitHub OAuth flow
curl http://localhost:5228/auth/v1/authorize?provider=github&redirect_to=http://localhost:5173
# Redirects to GitHub login

# After callback:
# Frontend receives access_token and refresh_token as URL params
```

## Response Headers

All authenticated requests include a response header indicating which auth system was used:

```
X-Auth-System: Supabase
# or
X-Auth-System: Local
```

This helps with debugging and monitoring the migration progress.

## Database Schema

Local auth uses tables in the `auth` schema:

```sql
-- Core user table (enhanced)
auth.users
  - id (uuid)
  - email (text)
  - encrypted_password (text)
  - email_confirmed_at (timestamptz)
  - created_at (timestamptz)
  - updated_at (timestamptz)
  - last_sign_in_at (timestamptz)
  - raw_app_meta_data (jsonb)
  - raw_user_meta_data (jsonb)

-- OAuth identities
auth.identities
  - id (uuid)
  - user_id (uuid)
  - provider (text) -- 'github', 'google'
  - provider_user_id (text)
  - provider_data (jsonb)
  - created_at (timestamptz)
  - updated_at (timestamptz)

-- Refresh tokens
auth.refresh_tokens
  - id (uuid)
  - token (text)
  - user_id (uuid)
  - parent (text)
  - revoked (boolean)
  - created_at (timestamptz)
  - updated_at (timestamptz)

-- Email verification codes
auth.verification_codes
  - id (uuid)
  - user_id (uuid)
  - code (text)
  - type (text) -- 'email_verification', 'password_reset'
  - expires_at (timestamptz)
  - used_at (timestamptz)
  - created_at (timestamptz)
```

## Migration Strategy

### Phase 1: Parallel Operation (Current)

- Both Supabase and local auth systems run in parallel
- Existing users continue using Supabase auth
- New users can optionally use local auth
- Frontend can test local auth with `X-UseLocalAuth` header

### Phase 2: Gradual Migration

1. **Test with development users**

   - Create test accounts in local auth
   - Verify all features work with local auth tokens
   - Monitor `X-Auth-System` headers in logs

2. **Migrate OAuth providers**

   - Set up GitHub/Google OAuth apps pointing to local API
   - Test OAuth flows with local auth
   - Verify identity linking works correctly

3. **User data migration**
   - Export user data from Supabase
   - Import into local `auth.users` table
   - Maintain user ID consistency

### Phase 3: Complete Switch

1. **Update frontend to use local auth by default**

   - Change auth client to point to `/auth/v1/*` endpoints
   - Add `X-UseLocalAuth: true` header to all requests
   - Fallback to Supabase for migration period

2. **Deprecate Supabase auth**
   - Stop creating new Supabase accounts
   - Migrate remaining users
   - Remove Supabase auth configuration

## Frontend Integration

### Using with Supabase Client (Existing)

```typescript
// No changes needed - continues to work
import { supabase } from '@/integrations/supabase/client';

const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});

// Requests automatically use Supabase tokens
```

### Using with Local Auth (New)

```typescript
class LocalAuthService {
  private baseUrl = 'http://localhost:5228/auth/v1';

  async signUp(email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  }

  async signIn(email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    // Store tokens
    localStorage.setItem('accessToken', data.access_token);
    localStorage.setItem('refreshToken', data.refresh_token);

    return data;
  }

  async getCurrentUser() {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${this.baseUrl}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-UseLocalAuth': 'true', // Important!
      },
    });
    return response.json();
  }

  // Add to all API requests
  getAuthHeaders() {
    const token = localStorage.getItem('accessToken');
    return {
      Authorization: `Bearer ${token}`,
      'X-UseLocalAuth': 'true', // Route to local auth
    };
  }
}
```

### Dual-Path Testing Hook

```typescript
// For testing both auth systems in parallel
function useDualPathAuth() {
  const [useLocalAuth, setUseLocalAuth] = useState(false);

  const getAuthHeaders = () => {
    const token = useLocalAuth
      ? localStorage.getItem('localAccessToken')
      : localStorage.getItem('supabaseAccessToken');

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    if (useLocalAuth) {
      headers['X-UseLocalAuth'] = 'true';
    }

    return headers;
  };

  return { useLocalAuth, setUseLocalAuth, getAuthHeaders };
}
```

## Security Considerations

### JWT Secrets

- **Supabase**: Uses asymmetric RSA keys (public/private key pair)
- **Local**: Uses symmetric HMAC-SHA256 (shared secret)

Both are secure when:

- Secrets are long enough (32+ characters for HMAC)
- Secrets are stored securely (environment variables, never committed)
- Keys are rotated regularly

### Token Validation

Both systems validate:

- Signature (cryptographic verification)
- Expiration (tokens expire after 1 hour)
- Issuer (must match expected URL)
- Audience (must be "authenticated")

### RLS (Row Level Security)

Both auth systems work with Postgres RLS:

- JWT includes user ID in claims
- RLS policies filter data based on user ID
- Policies are enforced at database level

## Troubleshooting

### "Invalid token" errors

1. **Check auth system routing**

   - Verify `X-UseLocalAuth` header matches token type
   - Check `X-Auth-System` response header

2. **Verify JWT configuration**

   - Supabase: Check `SUPABASE_JWKS_URL` is accessible
   - Local: Verify `JWT:Secret` matches between token generation and validation

3. **Check token expiration**
   - Tokens expire after 1 hour
   - Use refresh token to get new access token

### "Unauthorized" on data requests

1. **Verify token in Authorization header**

   ```bash
   -H "Authorization: Bearer <token>"
   ```

2. **Check routing header for local auth**

   ```bash
   -H "X-UseLocalAuth: true"  # If using local token
   ```

3. **Verify user has access to resource**
   - Check RLS policies
   - Verify user ID in token matches resource ownership

### OAuth issues

1. **Check redirect URIs match**

   - GitHub/Google OAuth app settings
   - `OAuth:*:RedirectUri` configuration

2. **Verify client credentials**
   - Client ID and secret are correct
   - Not expired or revoked

## Key Files

### Authentication Configuration

- `api/src/Retroscope.Auth/Extensions/ServiceCollectionExtensions.cs` - Dual-path auth setup
- `api/src/Retroscope.Api/Program.cs` - Auth middleware configuration

### Local Auth Implementation

- `api/src/Retroscope.Auth/Services/AuthService.cs` - Local auth service
- `api/src/Retroscope.Auth/Controllers/AuthController.cs` - Local auth endpoints
- `api/src/Retroscope.Auth/Controllers/JwksController.cs` - JWKS endpoint

### Database

- `api/postgres/init/03-auth-tables.sql` - Local auth schema

### Documentation

- `OAUTH_SETUP_GUIDE.md` - OAuth provider setup
- `LOCAL_AUTH_IMPLEMENTATION.md` - Detailed local auth guide
- `DUAL_PATH_AUTH_IMPLEMENTATION.md` - This file

## Next Steps

1. **Test dual-path authentication**

   ```bash
   # Test Supabase auth
   ./scripts/test-supabase-auth.sh

   # Test local auth
   ./scripts/test-local-auth.sh
   ```

2. **Monitor auth routing**

   ```bash
   # Watch auth system usage
   docker-compose logs -f api-dev | grep "X-Auth-System"
   ```

3. **Begin user migration planning**

   - Identify OAuth users
   - Plan data export/import
   - Test user experience with both systems

4. **Update frontend**
   - Add local auth service
   - Implement auth system toggle for testing
   - Test all auth flows with local auth
