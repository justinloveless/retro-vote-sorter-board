#!/bin/bash

# Complete Database Reset Script
# This script completely removes the database and recreates it from scratch
# All data will be lost and init scripts will run again

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗑️  Complete Database Reset Script${NC}"
echo -e "${BLUE}====================================${NC}"
echo -e "${RED}⚠️  WARNING: This will completely destroy all database data!${NC}"
echo ""

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose not found. Please install docker-compose first.${NC}"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ docker-compose.yml not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Function to ask for confirmation
confirm() {
    echo -e "${YELLOW}This will:${NC}"
    echo "• Stop all services"
    echo "• Remove the postgres data volume"
    echo "• Delete all database data"
    echo "• Recreate the database from scratch"
    echo "• Run all init scripts again"
    echo ""
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}❌ Operation cancelled.${NC}"
        exit 1
    fi
}

# Ask for confirmation
confirm

echo ""
echo -e "${BLUE}🛑 Stopping all services...${NC}"
docker-compose down

echo ""
echo -e "${BLUE}🗑️  Removing database volume...${NC}"
# Remove the postgres data volume
if docker volume ls | grep -q "retro-vote-sorter-board_postgres-data"; then
    docker volume rm retro-vote-sorter-board_postgres-data
    echo -e "${GREEN}✅ Database volume removed${NC}"
else
    echo -e "${YELLOW}⚠️  Database volume not found (already clean)${NC}"
fi

echo ""
echo -e "${BLUE}🧹 Cleaning up any orphaned containers and networks...${NC}"
# Remove any orphaned containers and networks
docker-compose down --remove-orphans
docker system prune -f

echo ""
echo -e "${BLUE}🔄 Starting services with fresh database...${NC}"
# Start postgres first
docker-compose up -d postgres

echo ""
echo -e "${BLUE}⏳ Waiting for database to be ready...${NC}"
# Wait for postgres to be healthy
timeout=60
counter=0
while [ $counter -lt $timeout ]; do
    if docker-compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Database is ready!${NC}"
        break
    fi
    echo -e "${YELLOW}⏳ Waiting for database... ($counter/$timeout)${NC}"
    sleep 2
    counter=$((counter + 2))
done

if [ $counter -ge $timeout ]; then
    echo -e "${RED}❌ Database failed to start within $timeout seconds${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🔍 Verifying database initialization...${NC}"

# Wait a bit more for init scripts to complete
sleep 5

# Check if the auth schema exists
if docker-compose exec -T postgres psql -U postgres -d retroscope -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'auth';" | grep -q "auth"; then
    echo -e "${GREEN}✅ Auth schema created successfully${NC}"
else
    echo -e "${RED}❌ Auth schema not found - init scripts may have failed${NC}"
    echo -e "${YELLOW}💡 Check the postgres logs: docker-compose logs postgres${NC}"
    exit 1
fi

# Check if auth tables exist
if docker-compose exec -T postgres psql -U postgres -d retroscope -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth';" | grep -q "users"; then
    echo -e "${GREEN}✅ Auth tables created successfully${NC}"
else
    echo -e "${RED}❌ Auth tables not found - init scripts may have failed${NC}"
    echo -e "${YELLOW}💡 Check the postgres logs: docker-compose logs postgres${NC}"
    exit 1
fi

# Check if the new auth tables exist
if docker-compose exec -T postgres psql -U postgres -d retroscope -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth' AND table_name IN ('identities', 'refresh_tokens', 'verification_codes');" | grep -q "identities"; then
    echo -e "${GREEN}✅ New auth tables (identities, refresh_tokens, verification_codes) created successfully${NC}"
else
    echo -e "${YELLOW}⚠️  New auth tables not found - you may need to run the migration manually${NC}"
    echo -e "${YELLOW}💡 Run: docker-compose exec postgres psql -U postgres -d retroscope -f /docker-entrypoint-initdb.d/03-auth-tables.sql${NC}"
fi

echo ""
echo -e "${BLUE}🚀 Starting remaining services...${NC}"
# Start all other services
docker-compose up -d

echo ""
echo -e "${GREEN}✅ Database reset complete!${NC}"
echo ""
echo -e "${BLUE}📊 Database Status:${NC}"
echo -e "${BLUE}===================${NC}"
echo -e "${GREEN}• Database: Fresh and clean${NC}"
echo -e "${GREEN}• Init scripts: Re-executed${NC}"
echo -e "${GREEN}• Auth tables: Created${NC}"
echo -e "${GREEN}• Services: Running${NC}"
echo ""
echo -e "${BLUE}🔗 You can now:${NC}"
echo "• Test the new auth system"
echo "• Create new users"
echo "• Set up OAuth providers"
echo ""
echo -e "${BLUE}📝 Next steps:${NC}"
echo "1. Set up OAuth providers (see OAUTH_SETUP_GUIDE.md)"
echo "2. Test auth endpoints:"
echo "   curl -X POST http://localhost:5228/auth/v1/signup \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\": \"test@example.com\", \"password\": \"password123\"}'"
echo "3. Update your frontend to use local auth"
echo ""
echo -e "${BLUE}🔧 Useful commands:${NC}"
echo "• View logs: docker-compose logs -f"
echo "• Check database: docker-compose exec postgres psql -U postgres -d retroscope"
echo "• Restart services: docker-compose restart"
echo ""
echo -e "${GREEN}🎉 Happy coding!${NC}"
