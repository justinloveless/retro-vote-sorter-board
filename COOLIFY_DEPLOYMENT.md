# Coolify Deployment Guide

This guide explains how to deploy Retroscope to Coolify.

## Overview

The project uses a multi-service Docker Compose setup:
- **app** - React frontend (Nginx)
- **api** - C# ASP.NET Core API

Development services (postgres, postgrest, app-dev, api-dev, etc.) are disabled in production via Docker Compose profiles.

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
```bash
VITE_USE_CSHARP_API=true
VITE_API_BASE_URL=https://api.your-domain.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGc...
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

In Coolify, set up domains for your services:

1. **app service**: 
   - Domain: `your-domain.com`
   - Port: `80`

2. **api service**: 
   - Domain: `api.your-domain.com`
   - Port: `8080`

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

## Local Development

To run the full dev stack locally (with postgres, postgrest, etc.):

```bash
docker-compose --profile dev up
```

This will start all services including:
- app-dev (hot reload)
- api-dev (hot reload)
- postgres
- postgrest
- pgadmin

## Production vs Development

| Service | Development | Production |
|---------|-------------|------------|
| Frontend | `app-dev` (hot reload) | `app` (static Nginx) |
| API | `api-dev` (hot reload) | `api` (compiled) |
| Database | Local postgres | Supabase postgres |
| PostgREST | Local postgrest | Supabase REST API |

## Environment Differences

- **Development**: Uses local postgres, postgrest, and hot reload
- **Production**: Uses Supabase hosted services, compiled/optimized builds

## Build Process

### Frontend (`app`)
1. `npm install` - Install dependencies
2. `npm run build` - Build with Vite (uses VITE_* env vars)
3. Nginx serves static files from `/dist`

### API (`api`)
1. `dotnet restore` - Restore NuGet packages
2. `dotnet build` - Build in Release mode
3. `dotnet publish` - Create deployment package
4. Run with Kestrel on port 8080

## Updating Deployment

Push to your deployment branch and Coolify will automatically rebuild if auto-deploy is enabled.

Or manually trigger deployment from the Coolify UI.

