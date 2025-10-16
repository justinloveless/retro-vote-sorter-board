# Database Reset Scripts

This directory contains scripts to completely reset and reinitialize the database from scratch.

## Scripts

### `reset-database.sh` (Linux/macOS)

Simple bash script for basic database reset.

### `reset-database-complete.sh` (Linux/macOS)

Comprehensive bash script with colored output, better error handling, and detailed status reporting.

### `reset-database.ps1` (Windows PowerShell)

PowerShell version for Windows users.

## Usage

### Linux/macOS

```bash
# Simple reset
./scripts/reset-database.sh

# Complete reset with detailed output
./scripts/reset-database-complete.sh
```

### Windows

```powershell
# Interactive reset
.\scripts\reset-database.ps1

# Force reset without confirmation
.\scripts\reset-database.ps1 -Force
```

## What These Scripts Do

1. **Stop all services** - Gracefully shuts down all Docker containers
2. **Remove database volume** - Completely deletes the postgres data volume
3. **Clean up containers** - Removes orphaned containers and networks
4. **Recreate database** - Starts fresh postgres container
5. **Run init scripts** - Executes all SQL initialization scripts
6. **Verify setup** - Checks that auth schema and tables are created
7. **Start services** - Brings up all remaining services

## ⚠️ Warning

**These scripts will completely destroy all database data!** This includes:

- All user accounts
- All application data
- All configuration
- Everything stored in the database

## When to Use

- **Testing new auth system** - Clean slate for testing
- **Development reset** - Start fresh during development
- **Schema changes** - When you need to reapply all migrations
- **Troubleshooting** - When database is in an inconsistent state

## What Happens After Reset

1. Database is completely fresh
2. All init scripts run again
3. Auth tables are created
4. Services start with clean database
5. You can test the new local auth system

## Next Steps After Reset

1. **Set up OAuth providers** (see `OAUTH_SETUP_GUIDE.md`)
2. **Test auth endpoints**:
   ```bash
   curl -X POST http://localhost:5228/auth/v1/signup \
     -H 'Content-Type: application/json' \
     -d '{"email": "test@example.com", "password": "password123"}'
   ```
3. **Update frontend** to use local auth endpoints
4. **Create test users** and verify functionality

## Troubleshooting

### Database won't start

```bash
# Check postgres logs
docker-compose logs postgres

# Check if port is in use
lsof -i :5432
```

### Init scripts failed

```bash
# Check postgres logs for errors
docker-compose logs postgres

# Manually run init scripts
docker-compose exec postgres psql -U postgres -d retroscope -f /docker-entrypoint-initdb.d/03-auth-tables.sql
```

### Services won't start

```bash
# Check all logs
docker-compose logs

# Restart specific service
docker-compose restart api-dev
```

## Safety Tips

- **Always backup important data** before running these scripts
- **Use in development only** - Never run in production
- **Test in isolated environment** first
- **Keep OAuth credentials safe** - They're not affected by database reset
