#!/bin/bash

# Database Reset Script
# This script completely removes the database and recreates it from scratch
# All data will be lost and init scripts will run again

set -e  # Exit on any error

echo "🗑️  Database Reset Script"
echo "=========================="
echo "⚠️  WARNING: This will completely destroy all database data!"
echo ""

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose not found. Please install docker-compose first."
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found. Please run this script from the project root."
    exit 1
fi

# Function to ask for confirmation
confirm() {
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Operation cancelled."
        exit 1
    fi
}

# Ask for confirmation
confirm

echo ""
echo "🛑 Stopping all services..."
docker-compose down

echo ""
echo "🗑️  Removing database volume..."
# Remove the postgres data volume
docker volume rm retro-vote-sorter-board_postgres-data 2>/dev/null || echo "Volume not found (already clean)"

echo ""
echo "🧹 Cleaning up any orphaned containers..."
# Remove any orphaned containers
docker-compose down --remove-orphans

echo ""
echo "🔄 Starting services with fresh database..."
# Start services - this will trigger the init scripts
docker-compose up -d postgres

echo ""
echo "⏳ Waiting for database to be ready..."
# Wait for postgres to be healthy
timeout=60
counter=0
while [ $counter -lt $timeout ]; do
    if docker-compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
        echo "✅ Database is ready!"
        break
    fi
    echo "⏳ Waiting for database... ($counter/$timeout)"
    sleep 2
    counter=$((counter + 2))
done

if [ $counter -ge $timeout ]; then
    echo "❌ Database failed to start within $timeout seconds"
    exit 1
fi

echo ""
echo "🔍 Verifying database initialization..."
# Check if the auth schema exists
if docker-compose exec -T postgres psql -U postgres -d retroscope -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'auth';" | grep -q "auth"; then
    echo "✅ Auth schema created successfully"
else
    echo "❌ Auth schema not found - init scripts may have failed"
    exit 1
fi

# Check if auth tables exist
if docker-compose exec -T postgres psql -U postgres -d retroscope -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth';" | grep -q "users"; then
    echo "✅ Auth tables created successfully"
else
    echo "❌ Auth tables not found - init scripts may have failed"
    exit 1
fi

echo ""
echo "🚀 Starting remaining services..."
# Start all other services
docker-compose up -d

echo ""
echo "✅ Database reset complete!"
echo ""
echo "📊 Database Status:"
echo "==================="
echo "• Database: Fresh and clean"
echo "• Init scripts: Re-executed"
echo "• Auth tables: Created"
echo "• Services: Running"
echo ""
echo "🔗 You can now:"
echo "• Test the new auth system"
echo "• Create new users"
echo "• Set up OAuth providers"
echo ""
echo "📝 Next steps:"
echo "1. Set up OAuth providers (see OAUTH_SETUP_GUIDE.md)"
echo "2. Test auth endpoints"
echo "3. Update your frontend to use local auth"
echo ""
echo "🎉 Happy coding!"
