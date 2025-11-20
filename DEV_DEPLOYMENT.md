# Development Environment Deployment

This guide explains the development environment setup for Coolify deployments.

## What Changed

The development environment now uses **built Docker images** instead of volume mounts, making it compatible with Coolify's deployment model.

### New Files Created

1. **`Dockerfile.app-dev`** - Frontend dev server image
2. **`api/Dockerfile.dev`** - Backend dev server image with hot reload (excludes tests)
3. **`api/postgres/Dockerfile`** - Custom Postgres with init scripts
4. **`docker-compose.dev.yml`** - Dev-specific compose file

**Note**: The API dev image excludes test projects since they're outside the build context (`./api`). Tests should be run locally or in CI/CD pipelines.

## Quick Start

### Local Development

```bash
# Using the dev compose file (recommended for Coolify testing)
docker-compose -f docker-compose.dev.yml up

# Using profiles (original method, requires volume mounts)
docker-compose --profile dev up
```

### Coolify Deployment

1. **Create new Docker Compose resource**
2. **Set compose file**: `docker-compose.dev.yml`
3. **Add environment variables** (see COOLIFY_DEPLOYMENT.md)
4. **Deploy**

## Services Included

| Service | Port | Purpose | Domain Example |
|---------|------|---------|----------------|
| app-dev | 8081 | Frontend with Vite dev server | dev.your-domain.com |
| api-dev | 8080 | Backend with dotnet watch | api-dev.your-domain.com |
| postgres | 5432 | Local database with RLS | postgres-dev.your-domain.com |
| postgrest | 3000 | REST API to local Postgres | postgrest-dev.your-domain.com |
| pgadmin | 80 | Database admin UI | pgadmin-dev.your-domain.com |

## Key Features

### Hot Reload

Both frontend and backend support hot reload:
- **Frontend**: Vite dev server rebuilds on file changes
- **Backend**: `dotnet watch` restarts on code changes

In Coolify, trigger rebuilds by pushing to your git branch.

### Local Database

The postgres service includes:
- **Init scripts**: Automatically runs scripts from `api/postgres/init/`
- **RLS policies**: Creates `anon`, `authenticated`, `service_role` roles
- **Test user**: `retroscope_app` user with proper permissions
- **Persistent data**: Uses Docker volume `postgres-data`

### Resource Allocation

Development services have higher limits for build tools:
- **app-dev**: 1 CPU, 1GB RAM
- **api-dev**: 2 CPU, 2GB RAM (for .NET SDK)
- **postgres**: 1 CPU, 1GB RAM
- **postgrest**: 1 CPU, 512MB RAM
- **pgadmin**: 0.5 CPU, 512MB RAM

## Differences from Production

| Aspect | Production | Development |
|--------|-----------|-------------|
| Frontend | Static Nginx | Vite dev server |
| Backend | Compiled binary | dotnet watch |
| Database | Supabase hosted | Local Postgres container |
| PostgREST | Supabase REST API | Local PostgREST container |
| Volumes | None | postgres-data, pgadmin-data |
| Build time | ~5 min | ~10 min (includes SDK) |

## Troubleshooting

### Services won't start

**Check logs**: In Coolify, check individual service logs to identify which service is failing.

Common issues:
- **postgres**: Init scripts failing - check `api/postgres/init/*.sql` syntax
- **api-dev**: Missing environment variables - ensure all required vars are set
- **app-dev**: Build errors - check `package.json` and dependencies
- **postgrest**: Can't connect to postgres - wait for postgres healthcheck

### Database connection errors

If you see "password authentication failed for user retroscope_app":
1. Check postgres logs to see if init scripts ran
2. Verify `02-create-app-user.sql` executed successfully
3. Try rebuilding the postgres image: `docker-compose -f docker-compose.dev.yml build postgres`

### Hot reload not working

In Coolify:
- Hot reload happens via git push (not file watching)
- Push to your branch to trigger rebuild
- Coolify will rebuild affected services

Locally:
- Volume mounts enable true hot reload
- Use `docker-compose --profile dev up` for volume-based development

### Out of memory

If services crash due to memory:
- Check Coolify resource limits
- Increase limits in `docker-compose.dev.yml` deploy section
- Consider running fewer services (e.g., skip pgadmin)

## Environment Variables

See `COOLIFY_DEPLOYMENT.md` for the complete list of required environment variables.

### Required for app-dev
- `VITE_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### Required for api-dev
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `JWT_SECRET`
- `ConnectionStrings__DefaultConnection` (auto-set for local postgres)

### Optional
- OAuth credentials (GitHub, Google)
- Custom postgres password
- PgAdmin credentials

## Next Steps

1. Review `COOLIFY_DEPLOYMENT.md` for complete setup instructions
2. Configure environment variables in Coolify
3. Deploy and test each service
4. Set up git-based continuous deployment

