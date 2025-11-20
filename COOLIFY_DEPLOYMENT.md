# Coolify Deployment Guide

This guide explains how to deploy Retroscope to Coolify.

## Overview

The project uses a multi-service Docker Compose setup:

- **app** - React frontend (Nginx)
- **api** - C# ASP.NET Core API

Development services (postgres, postgrest, app-dev, api-dev, etc.) are disabled in production via Docker Compose profiles.

## Compose File Options

Choose the right compose file for your environment:

| File                      | Use Case               | Services Included                                        |
| ------------------------- | ---------------------- | -------------------------------------------------------- |
| `docker-compose.yml`      | Production (default)   | `app`, `api` (dev services hidden by profiles)           |
| `docker-compose.prod.yml` | Production (explicit)  | `app`, `api` only                                        |
| `docker-compose.dev.yml`  | Development in Coolify | `app-dev`, `api-dev`, `postgres`, `postgrest`, `pgadmin` |

**For Production**: Use `docker-compose.yml` (default) or `docker-compose.prod.yml`  
**For Development**: Use `docker-compose.dev.yml` with separate Coolify resource

## Prerequisites

1. Coolify instance running
2. Supabase project (or configure local postgres)
3. GitHub OAuth app (optional)
4. Google OAuth app (optional)

## Setup Steps

### 1. Create New Resource in Coolify

1. Go to your Coolify dashboard
2. Create a new **Docker Compose** resource
3. Point to your Git repository
4. Select branch: `main` or your deployment branch

### 2. Configure Environment Variables

In Coolify, go to **Environment Variables** and add the following:

#### Frontend Variables (used at build time)

**Important**: These variables are baked into the frontend build. Changes require rebuilding the container.

```bash
# C# API Configuration
VITE_USE_CSHARP_API=true
VITE_API_BASE_URL=https://api.your-domain.com

# Supabase Configuration (REQUIRED)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGc...

# Optional
VITE_SUPABASE_PROJECT_ID=your-project-id
VITE_PUBLIC_BASE_PATH=/
```

#### API Variables

```bash
ASPNETCORE_ENVIRONMENT=Production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_POSTGREST_URL=https://your-project.supabase.co/rest/v1
SUPABASE_FUNCTIONS_URL=https://your-project.supabase.co/functions/v1
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
JWT_SECRET=your-super-secret-key-min-32-chars-long-for-jwt-signing
JWT_ISSUER=https://api.your-domain.com
ALLOW_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

#### Database Variables (if using local auth)

```bash
DATABASE_URL=Host=your-postgres;Port=5432;Database=retroscope;Username=user;Password=pass
```

#### OAuth Variables (optional)

```bash
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
OAUTH_GITHUB_REDIRECT_URI=https://api.your-domain.com/auth/v1/callback

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
OAUTH_GOOGLE_REDIRECT_URI=https://api.your-domain.com/auth/v1/callback
```

### 3. Configure Domains

In Coolify, set up domains for your services. Coolify's proxy will handle the routing.

1. **app service**:

   - Domain: `your-domain.com`
   - Container exposes port: `80` (Coolify will detect automatically)

2. **api service**:
   - Domain: `api.your-domain.com`
   - Container exposes port: `8080` (Coolify will detect automatically)

> **Note**: The docker-compose.yml uses `expose` instead of `ports` to avoid host port conflicts. Coolify's proxy handles external access.

### 4. Deploy

Click **Deploy** in Coolify. The build process will:

1. Build the frontend with Vite (including all env vars)
2. Build the API with .NET 9
3. Start both services with Nginx

### 5. Verify Deployment

Check the following:

- [ ] Frontend loads: `https://your-domain.com`
- [ ] API health check: `https://api.your-domain.com/healthz`
- [ ] CORS is working (check browser console)
- [ ] Can authenticate via Supabase

## Troubleshooting

### "Bind for 0.0.0.0:8080 failed: port is already allocated"

This means a port conflict on the host. The fix:

1. Use `expose` instead of `ports` in docker-compose.yml (already done)
2. Let Coolify's proxy handle port mapping
3. If you need direct port access locally, use different ports or stop conflicting services

### "password authentication failed for user retroscope_app"

This means the `postgrest` or `postgres` services are trying to start. These are development-only services. Ensure your docker-compose.yml has profiles configured:

```yaml
postgres:
  # ...
  profiles:
    - dev
```

### "Could not read package.json" or "Project file does not exist"

This means `app-dev` or `api-dev` services are trying to start. These should also have `profiles: [dev]` in docker-compose.yml.

### Frontend can't connect to API

1. Check `VITE_API_BASE_URL` matches your API domain
2. Check `ALLOW_ORIGINS` in API includes your frontend domain
3. Verify both services are running in Coolify

### API returns 401 Unauthorized

1. Check `SUPABASE_ANON_KEY` is correct
2. Check `JWT_SECRET` is set and matches across services
3. Verify `SUPABASE_JWKS_URL` is accessible

### "H.auth.onAuthStateChange is not a function" or Supabase client errors

This means the Supabase client wasn't properly initialized during the build. The frontend needs Supabase environment variables at **build time** (not runtime).

**Fix**:

1. Ensure `VITE_SUPABASE_URL` is set in Coolify environment variables
2. Ensure `VITE_SUPABASE_PUBLISHABLE_KEY` is set in Coolify environment variables
3. Rebuild the container (these are build-time variables, not runtime)

**Note**: Without these variables, the hardcoded values in `environment.ts` will be used, which may not work for your deployment.

### API shows "localhost:5099" or wrong URL in console

The `VITE_API_BASE_URL` must be set to your actual API domain at **build time**. Changes require a rebuild.

**Fix**:

1. Set `VITE_API_BASE_URL=https://api.your-domain.com` in Coolify
2. Rebuild the container

## Setting Up Development Environment in Coolify

You can create a separate development environment in Coolify with full dev services (postgres, postgrest, hot reload, etc.).

### Use docker-compose.dev.yml

**Important**: The dev compose file builds custom Docker images (not volume mounts) so it works in Coolify.

1. **Create a new Docker Compose resource in Coolify**
2. **Set the compose file path**: `docker-compose.dev.yml`
3. **Configure domains** for each service:

   - `app-dev`: `dev.your-domain.com` (exposes port 8081)
   - `api-dev`: `api-dev.your-domain.com` (exposes port 8080)
   - `postgres`: `postgres-dev.your-domain.com` (exposes port 5432) - Optional
   - `postgrest`: `postgrest-dev.your-domain.com` (exposes port 3000) - Optional
   - `pgadmin`: `pgadmin-dev.your-domain.com` (exposes port 80) - Optional

4. **Set environment variables**:

```bash
# Frontend Variables (build-time)
VITE_USE_CSHARP_API=true
VITE_API_BASE_URL=https://api-dev.your-domain.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGc...
VITE_SUPABASE_PROJECT_ID=your-project-id

# API Variables
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_POSTGREST_URL=https://your-project.supabase.co/rest/v1
SUPABASE_FUNCTIONS_URL=https://your-project.supabase.co/functions/v1
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
JWT_SECRET=your-super-secret-key-min-32-chars-long
JWT_ISSUER=https://api-dev.your-domain.com
ALLOW_ORIGINS=https://dev.your-domain.com

# OAuth (optional)
GITHUB_CLIENT_ID=your-dev-github-client-id
GITHUB_CLIENT_SECRET=your-dev-github-client-secret
OAUTH_GITHUB_REDIRECT_URI=https://api-dev.your-domain.com/auth/v1/callback
GOOGLE_CLIENT_ID=your-dev-google-client-id
GOOGLE_CLIENT_SECRET=your-dev-google-client-secret
OAUTH_GOOGLE_REDIRECT_URI=https://api-dev.your-domain.com/auth/v1/callback

# Postgres (optional - for custom password)
POSTGRES_PASSWORD=secure-dev-password

# PgAdmin (optional)
PGADMIN_EMAIL=admin@your-domain.com
PGADMIN_PASSWORD=secure-admin-password

# PostgREST (optional - for custom proxy URI)
POSTGREST_PROXY_URI=https://postgrest-dev.your-domain.com
```

### Key Differences from Production

- **Custom Images**: Uses `Dockerfile.app-dev`, `api/Dockerfile.dev`, and `api/postgres/Dockerfile`
- **Hot Reload**: Vite dev server and `dotnet watch` for code changes
- **Local Database**: Containerized Postgres with init scripts (includes RLS setup)
- **Local PostgREST**: REST API directly to local Postgres
- **Resource Limits**: Higher memory/CPU for build tools

## Local Development

To run the full dev stack locally (with postgres, postgrest, etc.):

**Using profiles:**

```bash
docker-compose --profile dev up
```

**Using dev compose file:**

```bash
docker-compose -f docker-compose.dev.yml up
```

This will start all services including:

- app-dev (hot reload)
- api-dev (hot reload)
- postgres
- postgrest
- pgadmin

## Production vs Development

| Service   | Development            | Production           |
| --------- | ---------------------- | -------------------- |
| Frontend  | `app-dev` (hot reload) | `app` (static Nginx) |
| API       | `api-dev` (hot reload) | `api` (compiled)     |
| Database  | Local postgres         | Supabase postgres    |
| PostgREST | Local postgrest        | Supabase REST API    |

## Environment Differences

- **Development**: Uses local postgres, postgrest, and hot reload
- **Production**: Uses Supabase hosted services, compiled/optimized builds

## Build Process

### Frontend (`app`)

1. `npm install` - Install dependencies
2. `npm run build` - Build with Vite (uses VITE\_\* env vars)
3. Nginx serves static files from `/dist`

### API (`api`)

1. `dotnet restore` - Restore NuGet packages
2. `dotnet build` - Build in Release mode
3. `dotnet publish` - Create deployment package
4. Run with Kestrel on port 8080

## Updating Deployment

Push to your deployment branch and Coolify will automatically rebuild if auto-deploy is enabled.

Or manually trigger deployment from the Coolify UI.
