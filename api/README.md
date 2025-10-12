# Retroscope C# API

A C# .NET API gateway that sits between the React frontend and data backends (Supabase or local Postgres).

## Features

- **Multi-backend routing** - Route requests to Supabase, local Postgres, or both
- **Row Level Security** - Native Postgres RLS support
- **Dual-path testing** - Compare Supabase vs Postgres responses
- **Header-based routing** - Switch backends without code changes
- **Type-safe DTOs** - Consistent contracts across all backends
- **Comprehensive logging** - Structured logs with correlation IDs

## Architecture

```
Frontend → C# API Gateway → [Supabase | Local Postgres | Both]
```

The API provides three routing modes:

1. **Supabase-only** (default) - Production mode
2. **Local Postgres** - Development/testing mode
3. **Dual-path** - Comparison mode for migration validation

## Quick Start

### Prerequisites

- .NET 10 SDK (or .NET 8+ with global.json modified)
- Docker and Docker Compose
- Supabase account and project

### Running with Docker

```bash
# Start all services (API + Postgres + Frontend)
docker-compose up -d

# View API logs
docker-compose logs -f api-dev

# Stop services
docker-compose down
```

The API will be available at:

- **Development**: http://localhost:5228
- **Production build**: http://localhost:5227

### Running locally (without Docker)

```bash
cd api

# Restore packages
dotnet restore

# Run the API
dotnet run --project src/Retroscope.Api

# Or use watch mode
dotnet watch run --project src/Retroscope.Api
```

## Configuration

### Environment Variables

Set these in `appsettings.Development.json`, environment variables, or Docker Compose:

**Supabase Configuration:**

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_POSTGREST_URL=https://your-project.supabase.co/rest/v1
SUPABASE_FUNCTIONS_URL=https://your-project.supabase.co/functions/v1
SUPABASE_ANON_KEY=your-anon-key
```

**Local Postgres Configuration:**

```
POSTGRES_CONNECTION_STRING=Host=localhost;Port=5432;Database=retroscope;Username=postgres;Password=postgres
```

**CORS:**

```
ALLOW_ORIGINS=http://localhost:3000,http://localhost:8081
```

## Using Local Postgres

See the complete guide: [docs/LOCAL_POSTGRES_SETUP.md](docs/LOCAL_POSTGRES_SETUP.md)

### Quick Setup

1. **Export Supabase schema:**

```bash
supabase db dump --db-url "postgresql://..." > postgres/init/01-schema.sql
```

2. **Start Postgres container:**

```bash
docker-compose up postgres -d
```

3. **Route requests to local Postgres:**

Add the `X-UseLocalPostgres: true` header to your requests:

```bash
curl http://localhost:5228/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-UseLocalPostgres: true"
```

### Routing Modes

| Mode           | Headers                                          | Behavior                      |
| -------------- | ------------------------------------------------ | ----------------------------- |
| Supabase-only  | _(none)_                                         | Default, uses remote Supabase |
| Local Postgres | `X-UseLocalPostgres: true`                       | Uses local Postgres           |
| Dual-path      | `X-UseLocalPostgres: true`<br>`X-DualPath: true` | Calls both, logs differences  |

## Project Structure

```
api/
├── src/
│   ├── Retroscope.Api/              # Controllers, startup
│   │   └── Controllers/             # API endpoints
│   ├── Retroscope.Application/      # DTOs and interfaces
│   │   ├── DTOs/                    # Request/response models
│   │   └── Interfaces/              # Gateway interfaces
│   └── Retroscope.Infrastructure/   # Gateway implementations
│       ├── Supabase/                # Supabase gateway
│       ├── Postgres/                # Postgres gateway + EF Core
│       └── Routing/                 # Router + dual-path comparer
├── tests/
│   ├── Retroscope.Api.UnitTests/    # Unit tests
│   └── Retroscope.Api.IntegrationTests/  # Integration tests
├── postgres/
│   └── init/                        # Postgres initialization scripts
└── docs/                            # Documentation
```

## Development

### Building

```bash
cd api
dotnet build
```

### Testing

```bash
# Run all tests
dotnet test

# Run specific test project
dotnet test tests/Retroscope.Api.UnitTests

# Run with coverage
dotnet test --collect:"XPlat Code Coverage"
```

### Code Style

Follow the project's .editorconfig settings. Before committing:

```bash
# Check for linting errors
dotnet build

# Format code
dotnet format
```

## API Endpoints

### Health

- `GET /healthz` - Liveness probe
- `GET /readyz` - Readiness probe

### Notifications

- `GET /api/notifications` - List notifications
- `PATCH /api/notifications/{id}` - Mark notification as read
- `POST /api/notifications/mark-all-read` - Mark all as read

### Teams

- `GET /api/teams` - List user's teams
- `GET /api/teams/{id}` - Get team details
- `POST /api/teams` - Create team
- `PATCH /api/teams/{id}` - Update team
- `DELETE /api/teams/{id}` - Delete team

### Team Members

- `GET /api/teams/{teamId}/members` - List members
- `POST /api/teams/{teamId}/members` - Add member
- `DELETE /api/teams/{teamId}/members/{userId}` - Remove member
- `PATCH /api/teams/{teamId}/members/{userId}` - Update role

### Retro Boards

- `GET /api/retro-boards?teamId={teamId}` - List boards
- `GET /api/retro-boards/{id}` - Get board details
- `POST /api/retro-boards` - Create board
- `PATCH /api/retro-boards/{id}` - Update board
- `DELETE /api/retro-boards/{id}` - Delete board

### Profiles

- `GET /api/profiles` - Get current user's profile
- `PATCH /api/profiles` - Update profile

See [OpenAPI documentation](http://localhost:5228/openapi) when running in development.

## Authentication

All endpoints (except health checks) require authentication via JWT bearer token from Supabase:

```bash
curl http://localhost:5228/api/notifications \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN"
```

The API validates tokens using Supabase JWKS and forwards them to backends for RLS enforcement.

## Logging

The API uses Serilog for structured logging. Logs include:

- Request/response timing
- Correlation IDs
- Dual-path comparisons
- Error details

View logs in development:

```bash
docker-compose logs -f api-dev
```

## Deployment

### Docker

Build and run the production image:

```bash
# Build
docker build -t retroscope-api -f api/Dockerfile .

# Run
docker run -p 8080:8080 \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_ANON_KEY=your-key \
  retroscope-api
```

### Environment-specific settings

- **Development**: `appsettings.Development.json`
- **Production**: Environment variables or secrets manager

## Troubleshooting

### API won't start

Check that all required environment variables are set:

```bash
dotnet run --project src/Retroscope.Api
# Look for configuration errors in output
```

### Cannot connect to Postgres

Verify the connection string and that Postgres is running:

```bash
docker-compose ps postgres
docker-compose exec postgres pg_isready -U postgres
```

### Dual-path results differ

This is expected during migration. Check logs for specifics:

```bash
docker-compose logs api-dev | grep "DualPath"
```

See [docs/LOCAL_POSTGRES_SETUP.md](docs/LOCAL_POSTGRES_SETUP.md) for detailed troubleshooting.

## Contributing

1. Write tests first (TDD)
2. Follow the existing patterns
3. Use `IDataGateway` in controllers (not `ISupabaseGateway` directly)
4. Run linter before committing
5. Update documentation

## Documentation

- [Local Postgres Setup](docs/LOCAL_POSTGRES_SETUP.md) - Complete guide for local development
- [Proxy Routing Guide](docs/PROXY_ROUTING_GUIDE.md) - Understanding the proxy pattern
- [Supabase Proxy](docs/SUPABASE_PROXY.md) - Supabase-specific details

## License

See root LICENSE file.
