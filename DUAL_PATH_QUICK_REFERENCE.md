# Dual-Path Quick Reference

Quick reference for working with dual-path authentication and data access.

## 🔐 Authentication

### Using Supabase Auth (Default)

```bash
# No special headers needed
curl http://localhost:5228/api/notifications \
  -H "Authorization: Bearer <supabase-token>"
```

### Using Local Auth

```bash
# Add X-UseLocalAuth header
curl http://localhost:5228/api/notifications \
  -H "Authorization: Bearer <local-token>" \
  -H "X-UseLocalAuth: true"
```

### Check Which Auth System Was Used

```bash
# Look for response header
X-Auth-System: Supabase
# or
X-Auth-System: Local
```

## 💾 Data Access

### Using Supabase PostgREST (Default)

```bash
# No special headers needed
curl http://localhost:5228/api/supabase/teams?select=* \
  -H "Authorization: Bearer <token>"
```

### Using Local Postgres

```bash
# Add X-UseLocalPostgres header
curl http://localhost:5228/api/supabase/teams?select=* \
  -H "Authorization: Bearer <token>" \
  -H "X-UseLocalPostgres: true"
```

### Using Dual-Path (Both)

```bash
# Add both headers - sends to both, logs differences
curl http://localhost:5228/api/supabase/teams?select=* \
  -H "Authorization: Bearer <token>" \
  -H "X-UseLocalPostgres: true" \
  -H "X-DualPath: true"

# Check logs for comparison
docker-compose logs -f api-dev | grep "DualPath"
```

## 🔄 Common Scenarios

### Test Local Auth Signup

```bash
curl -X POST http://localhost:5228/auth/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

### Test Local Auth Login

```bash
curl -X POST http://localhost:5228/auth/v1/token?grant_type=password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

### Use Local Auth Token with Local Postgres

```bash
# Login to get token
TOKEN=$(curl -X POST http://localhost:5228/auth/v1/token?grant_type=password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}' \
  | jq -r '.access_token')

# Use token to access data from local Postgres
curl http://localhost:5228/api/supabase/notifications?select=* \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-UseLocalAuth: true" \
  -H "X-UseLocalPostgres: true"
```

### Compare Supabase vs Local Results

```bash
# Get Supabase token
SUPABASE_TOKEN="your-supabase-token"

# Get local token
LOCAL_TOKEN=$(curl -X POST http://localhost:5228/auth/v1/token?grant_type=password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}' \
  | jq -r '.access_token')

# Test with Supabase auth + Supabase data
curl http://localhost:5228/api/supabase/notifications?select=* \
  -H "Authorization: Bearer $SUPABASE_TOKEN"

# Test with Local auth + Local data
curl http://localhost:5228/api/supabase/notifications?select=* \
  -H "Authorization: Bearer $LOCAL_TOKEN" \
  -H "X-UseLocalAuth: true" \
  -H "X-UseLocalPostgres: true"
```

## 🎯 Header Combinations

| Auth System | Data Source       | Headers Required                                     |
| ----------- | ----------------- | ---------------------------------------------------- |
| Supabase    | Supabase          | _(none)_                                             |
| Supabase    | Local Postgres    | `X-UseLocalPostgres: true`                           |
| Local       | Supabase          | `X-UseLocalAuth: true`                               |
| Local       | Local Postgres    | `X-UseLocalAuth: true`<br>`X-UseLocalPostgres: true` |
| Either      | Both (comparison) | `X-UseLocalPostgres: true`<br>`X-DualPath: true`     |

## 📊 Monitoring

### Watch Auth Routing

```bash
docker-compose logs -f api-dev | grep "X-Auth-System"
```

### Watch Data Routing

```bash
docker-compose logs -f api-dev | grep "DualPath"
```

### Watch All Routing

```bash
docker-compose logs -f api-dev | grep -E "(X-Auth-System|DualPath|X-UseLocalPostgres|X-UseLocalAuth)"
```

## 🔧 Environment Setup

### Required for Local Auth

```bash
JWT__Secret=your-super-secret-key-min-32-chars-long-for-jwt-signing
JWT__Issuer=http://localhost:5228
ConnectionStrings__DefaultConnection=Host=postgres;Port=5432;Database=retroscope;Username=retroscope_app;Password=retroscope_app_pass
```

### Required for Supabase Auth

```bash
SUPABASE_URL=https://nwfwbjmzbwuyxehindpv.supabase.co
SUPABASE_JWKS_URL=https://nwfwbjmzbwuyxehindpv.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_ANON_KEY=eyJhbGc...
```

### Required for Local Postgres

```bash
LOCAL_POSTGREST_URL=http://postgrest:3000
POSTGRES_CONNECTION_STRING=Host=postgres;Port=5432;Database=retroscope;Username=retroscope_app;Password=retroscope_app_pass
```

## 🚀 Quick Start

### 1. Reset Database

```bash
./scripts/reset-database-complete.sh
```

### 2. Start Services

```bash
docker-compose up -d
```

### 3. Create Local Test User

```bash
curl -X POST http://localhost:5228/auth/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

### 4. Test Everything

```bash
# Get token
TOKEN=$(curl -X POST http://localhost:5228/auth/v1/token?grant_type=password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}' \
  | jq -r '.access_token')

# Test with local auth + local postgres
curl http://localhost:5228/api/supabase/teams?select=* \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-UseLocalAuth: true" \
  -H "X-UseLocalPostgres: true"
```

## 📚 See Also

- `DUAL_PATH_AUTH_IMPLEMENTATION.md` - Detailed auth documentation
- `DUAL_PATH_PROXY_IMPLEMENTATION.md` - Detailed data proxy documentation
- `LOCAL_AUTH_IMPLEMENTATION.md` - Local auth setup guide
- `OAUTH_SETUP_GUIDE.md` - OAuth provider configuration
