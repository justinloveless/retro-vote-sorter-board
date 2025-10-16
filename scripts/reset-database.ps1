# Complete Database Reset Script (PowerShell)
# This script completely removes the database and recreates it from scratch
# All data will be lost and init scripts will run again

param(
    [switch]$Force
)

Write-Host "🗑️  Complete Database Reset Script" -ForegroundColor Blue
Write-Host "====================================" -ForegroundColor Blue
Write-Host "⚠️  WARNING: This will completely destroy all database data!" -ForegroundColor Red
Write-Host ""

# Check if docker-compose is available
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Host "❌ docker-compose not found. Please install docker-compose first." -ForegroundColor Red
    exit 1
}

# Check if we're in the right directory
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "❌ docker-compose.yml not found. Please run this script from the project root." -ForegroundColor Red
    exit 1
}

# Function to ask for confirmation
if (-not $Force) {
    Write-Host "This will:" -ForegroundColor Yellow
    Write-Host "• Stop all services"
    Write-Host "• Remove the postgres data volume"
    Write-Host "• Delete all database data"
    Write-Host "• Recreate the database from scratch"
    Write-Host "• Run all init scripts again"
    Write-Host ""
    $confirmation = Read-Host "Are you sure you want to continue? (y/N)"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Host "❌ Operation cancelled." -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "🛑 Stopping all services..." -ForegroundColor Blue
docker-compose down

Write-Host ""
Write-Host "🗑️  Removing database volume..." -ForegroundColor Blue
# Remove the postgres data volume
$volumeName = "retro-vote-sorter-board_postgres-data"
$volumes = docker volume ls --format "{{.Name}}" | Where-Object { $_ -eq $volumeName }
if ($volumes) {
    docker volume rm $volumeName
    Write-Host "✅ Database volume removed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Database volume not found (already clean)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🧹 Cleaning up any orphaned containers and networks..." -ForegroundColor Blue
# Remove any orphaned containers and networks
docker-compose down --remove-orphans
docker system prune -f

Write-Host ""
Write-Host "🔄 Starting services with fresh database..." -ForegroundColor Blue
# Start postgres first
docker-compose up -d postgres

Write-Host ""
Write-Host "⏳ Waiting for database to be ready..." -ForegroundColor Blue
# Wait for postgres to be healthy
$timeout = 60
$counter = 0
while ($counter -lt $timeout) {
    $result = docker-compose exec -T postgres pg_isready -U postgres 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database is ready!" -ForegroundColor Green
        break
    }
    Write-Host "⏳ Waiting for database... ($counter/$timeout)" -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    $counter += 2
}

if ($counter -ge $timeout) {
    Write-Host "❌ Database failed to start within $timeout seconds" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔍 Verifying database initialization..." -ForegroundColor Blue

# Wait a bit more for init scripts to complete
Start-Sleep -Seconds 5

# Check if the auth schema exists
$authSchemaCheck = docker-compose exec -T postgres psql -U postgres -d retroscope -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'auth';" 2>$null
if ($authSchemaCheck -match "auth") {
    Write-Host "✅ Auth schema created successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Auth schema not found - init scripts may have failed" -ForegroundColor Red
    Write-Host "💡 Check the postgres logs: docker-compose logs postgres" -ForegroundColor Yellow
    exit 1
}

# Check if auth tables exist
$authTablesCheck = docker-compose exec -T postgres psql -U postgres -d retroscope -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth';" 2>$null
if ($authTablesCheck -match "users") {
    Write-Host "✅ Auth tables created successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Auth tables not found - init scripts may have failed" -ForegroundColor Red
    Write-Host "💡 Check the postgres logs: docker-compose logs postgres" -ForegroundColor Yellow
    exit 1
}

# Check if the new auth tables exist
$newAuthTablesCheck = docker-compose exec -T postgres psql -U postgres -d retroscope -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth' AND table_name IN ('identities', 'refresh_tokens', 'verification_codes');" 2>$null
if ($newAuthTablesCheck -match "identities") {
    Write-Host "✅ New auth tables (identities, refresh_tokens, verification_codes) created successfully" -ForegroundColor Green
} else {
    Write-Host "⚠️  New auth tables not found - you may need to run the migration manually" -ForegroundColor Yellow
    Write-Host "💡 Run: docker-compose exec postgres psql -U postgres -d retroscope -f /docker-entrypoint-initdb.d/03-auth-tables.sql" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🚀 Starting remaining services..." -ForegroundColor Blue
# Start all other services
docker-compose up -d

Write-Host ""
Write-Host "✅ Database reset complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Database Status:" -ForegroundColor Blue
Write-Host "===================" -ForegroundColor Blue
Write-Host "• Database: Fresh and clean" -ForegroundColor Green
Write-Host "• Init scripts: Re-executed" -ForegroundColor Green
Write-Host "• Auth tables: Created" -ForegroundColor Green
Write-Host "• Services: Running" -ForegroundColor Green
Write-Host ""
Write-Host "🔗 You can now:" -ForegroundColor Blue
Write-Host "• Test the new auth system"
Write-Host "• Create new users"
Write-Host "• Set up OAuth providers"
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Blue
Write-Host "1. Set up OAuth providers (see OAUTH_SETUP_GUIDE.md)"
Write-Host "2. Test auth endpoints:"
Write-Host "   curl -X POST http://localhost:5228/auth/v1/signup \"
Write-Host "     -H 'Content-Type: application/json' \"
Write-Host "     -d '{\"email\": \"test@example.com\", \"password\": \"password123\"}'"
Write-Host "3. Update your frontend to use local auth"
Write-Host ""
Write-Host "🔧 Useful commands:" -ForegroundColor Blue
Write-Host "• View logs: docker-compose logs -f"
Write-Host "• Check database: docker-compose exec postgres psql -U postgres -d retroscope"
Write-Host "• Restart services: docker-compose restart"
Write-Host ""
Write-Host "🎉 Happy coding!" -ForegroundColor Green
