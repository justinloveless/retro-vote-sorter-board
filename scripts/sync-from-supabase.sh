#!/bin/bash

# Database Sync Script - Sync from Supabase to Local PostgreSQL
# This script dumps data from Supabase and loads it into the local Docker PostgreSQL database

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - easily modify these arrays to add more schemas/tables
SCHEMAS=("auth" "public")
AUTH_TABLES=("users" "identities" "refresh_tokens")
PUBLIC_TABLES=()  # Empty = sync all tables in public schema

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.sync"
ENV_FILE_ALT="$SCRIPT_DIR/.env.sync"
LOG_FILE="$SCRIPT_DIR/sync-from-supabase.log"
TEMP_DIR="/tmp/supabase-sync-$$"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Function to check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    local missing_tools=()
    
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        missing_tools+=("docker-compose")
    fi
    
    # Check for PostgreSQL 15 first (matches Supabase version)
    if [ -f "/opt/homebrew/opt/postgresql@15/bin/pg_dump" ]; then
        export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
        print_success "Using PostgreSQL 15 client tools (matches Supabase version)"
    elif [ -f "/usr/local/opt/postgresql@15/bin/pg_dump" ]; then
        export PATH="/usr/local/opt/postgresql@15/bin:$PATH"
        print_success "Using PostgreSQL 15 client tools (matches Supabase version)"
    else
        # Check if pg_dump exists but is wrong version
        if command -v pg_dump &> /dev/null; then
            local pg_version=$(pg_dump --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
            print_error "Found pg_dump version $pg_version, but Supabase requires version 15.x"
            print_error "Please install PostgreSQL 15 client tools:"
            print_error "  brew install postgresql@15"
            print_error "  brew link postgresql@15"
            exit 1
        else
            missing_tools+=("pg_dump (PostgreSQL 15 client tools)")
        fi
    fi
    
    if ! command -v psql &> /dev/null; then
        missing_tools+=("psql (PostgreSQL client tools)")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_error "Please install PostgreSQL 15: brew install postgresql@15"
        exit 1
    fi
    
    # Verify pg_dump version is compatible
    local pg_dump_version=$(pg_dump --version | grep -oE '[0-9]+' | head -1)
    if [ "$pg_dump_version" -lt 15 ]; then
        print_error "pg_dump version $pg_dump_version is too old for Supabase (requires 15+)"
        print_error "Please install PostgreSQL 15 client tools:"
        print_error "  brew install postgresql@15"
        exit 1
    fi
    
    print_success "All dependencies found and versions verified"
}

# Function to load environment variables
load_env() {
    print_status "Loading environment configuration..."
    
    # Check for .env.sync file in project root or scripts directory
    if [ -f "$ENV_FILE" ]; then
        ENV_FILE="$ENV_FILE"
    elif [ -f "$ENV_FILE_ALT" ]; then
        ENV_FILE="$ENV_FILE_ALT"
    else
        print_error "Environment file not found!"
        print_error "Please create .env.sync file with your Supabase credentials."
        print_error ""
        print_error "You can copy the template:"
        print_error "  cp scripts/.env.sync.example .env.sync"
        print_error "  # or"
        print_error "  cp scripts/.env.sync.example scripts/.env.sync"
        print_error ""
        print_error "Then edit the file and add your actual Supabase credentials."
        exit 1
    fi
    
    # Load environment variables
    set -a  # automatically export all variables
    source "$ENV_FILE"
    set +a
    
    # Validate required variables
    local missing_vars=()
    
    if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] || [ "$SUPABASE_SERVICE_ROLE_KEY" = "your-service-role-key-here" ]; then
        missing_vars+=("SUPABASE_SERVICE_ROLE_KEY")
    fi
    
    if [ -z "$SUPABASE_DB_URL" ] || [ "$SUPABASE_DB_URL" = "postgresql://postgres:your-password@db.your-project-ref.supabase.co:5432/postgres" ]; then
        missing_vars+=("SUPABASE_DB_URL")
    fi
    
    if [ -z "$SUPABASE_PROJECT_REF" ] || [ "$SUPABASE_PROJECT_REF" = "your-project-ref" ]; then
        missing_vars+=("SUPABASE_PROJECT_REF")
    fi
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing or invalid environment variables: ${missing_vars[*]}"
        print_error "Please update your .env.sync file with actual values."
        exit 1
    fi
    
    print_success "Environment configuration loaded from $ENV_FILE"
}

# Function to check Docker container status
check_docker() {
    print_status "Checking Docker container status..."
    
    # Try docker compose first (newer format), then docker-compose (legacy)
    local docker_cmd=""
    if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        docker_cmd="docker compose"
    elif command -v docker-compose &> /dev/null; then
        docker_cmd="docker-compose"
    else
        print_error "Neither 'docker compose' nor 'docker-compose' found!"
        exit 1
    fi
    
    # Check if postgres container exists and is running
    # Look for "Up" or "healthy" in the status column
    local postgres_status=$($docker_cmd ps postgres 2>/dev/null)
    
    if [ -z "$postgres_status" ]; then
        print_error "PostgreSQL container not found!"
        print_error "Please start the database with: $docker_cmd up -d postgres"
        exit 1
    fi
    
    if ! echo "$postgres_status" | grep -qE "(Up|healthy)"; then
        print_error "PostgreSQL container is not running!"
        print_error "Please start the database with: $docker_cmd up -d postgres"
        print_error "Container status:"
        echo "$postgres_status"
        exit 1
    fi
    
    print_success "PostgreSQL container is running"
}

# Function to test Supabase connection
test_supabase_connection() {
    print_status "Testing Supabase connection..."
    
    # Extract password and username from SUPABASE_DB_URL and URL decode it
    local supabase_password=$(echo "$SUPABASE_DB_URL" | sed -n 's/.*:\([^@]*\)@.*/\1/p' | sed 's/%25/%/g; s/%5E/^/g; s/%40/@/g')
    local supabase_username=$(echo "$SUPABASE_DB_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    local supabase_host=$(echo "$SUPABASE_DB_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local supabase_port=$(echo "$SUPABASE_DB_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    # Disable GSSAPI to avoid negotiation errors with Supabase pooler
    if ! PGPASSWORD="$supabase_password" PGGSSENCMODE=disable psql -h "$supabase_host" -p "$supabase_port" -U "$supabase_username" -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
        print_error "Cannot connect to Supabase database!"
        print_error "Please check your SUPABASE_DB_URL in .env.sync"
        print_error "Connection details: $supabase_username@$supabase_host:$supabase_port"
        exit 1
    fi
    
    print_success "Supabase connection successful"
}

# Function to test local connection
test_local_connection() {
    print_status "Testing local PostgreSQL connection..."
    
    # Use default values if not set
    local db_host="${LOCAL_DB_HOST:-localhost}"
    local db_port="${LOCAL_DB_PORT:-5433}"
    local db_user="${LOCAL_DB_USER:-postgres}"
    local db_name="${LOCAL_DB_NAME:-retroscope}"
    local db_password="${LOCAL_DB_PASSWORD:-postgres}"
    
    print_status "Connecting to: $db_user@$db_host:$db_port/$db_name"
    
    if ! PGPASSWORD="$db_password" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "SELECT 1;" >/dev/null 2>&1; then
        print_error "Cannot connect to local PostgreSQL database!"
        print_error "Connection details: $db_user@$db_host:$db_port/$db_name"
        print_error "Please ensure:"
        print_error "  1. The database is running: docker compose ps postgres"
        print_error "  2. The port is correct (check docker-compose.yml)"
        print_error "  3. Your .env.sync has: LOCAL_DB_PORT=$db_port"
        exit 1
    fi
    
    print_success "Local PostgreSQL connection successful"
}

# Function to create temporary directory
setup_temp_dir() {
    print_status "Setting up temporary directory..."
    
    mkdir -p "$TEMP_DIR"
    print_success "Temporary directory created: $TEMP_DIR"
}

# Function to dump data from Supabase
dump_supabase_data() {
    print_status "Dumping data from Supabase..."
    
    local supabase_password=$(echo "$SUPABASE_DB_URL" | sed -n 's/.*:\([^@]*\)@.*/\1/p' | sed 's/%25/%/g; s/%5E/^/g; s/%40/@/g')
    local supabase_username=$(echo "$SUPABASE_DB_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    local supabase_host=$(echo "$SUPABASE_DB_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local supabase_port=$(echo "$SUPABASE_DB_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    for schema in "${SCHEMAS[@]}"; do
        print_status "Dumping $schema schema..."
        
        local dump_file="$TEMP_DIR/${schema}_data.sql"
        
        if [ "$schema" = "auth" ]; then
            # Special handling for auth schema - only sync compatible columns
            dump_auth_data "$supabase_password" "$supabase_username" "$supabase_host" "$supabase_port" "$dump_file"
        else
            # Standard pg_dump for public schema
            local tables_arg=""
            if [ "$schema" = "public" ] && [ ${#PUBLIC_TABLES[@]} -gt 0 ]; then
                for table in "${PUBLIC_TABLES[@]}"; do
                    tables_arg="$tables_arg --table=$schema.$table"
                done
            fi
            
            # Dump data only (no schema)
            # Run pg_dump and capture both stdout and stderr
            PGPASSWORD="$supabase_password" PGGSSENCMODE=disable pg_dump \
                --host="$supabase_host" \
                --port="$supabase_port" \
                --username="$supabase_username" \
                --dbname=postgres \
                --schema="$schema" \
                --data-only \
                --disable-triggers \
                --no-owner \
                --no-privileges \
                $tables_arg \
                --file="$dump_file" 2>&1
            
            local dump_exit_code=$?
            
            # Verify the dump file was created and has content
            if [ $dump_exit_code -eq 0 ] && [ -f "$dump_file" ] && [ -s "$dump_file" ]; then
                print_success "Dumped $schema schema to $dump_file ($(wc -l < "$dump_file" | tr -d ' ') lines)"
            else
                print_warning "Failed to dump $schema schema (exit code: $dump_exit_code)"
                if [ -f "$dump_file" ]; then
                    local file_size=$(wc -l < "$dump_file" | tr -d ' ')
                    print_warning "File exists but may be empty: $file_size lines"
                else
                    print_warning "Dump file was not created"
                fi
                print_status "Checking if tables exist..."
                # Check if any of the specified tables exist
                local tables_exist=false
                if [ "$schema" = "public" ]; then
                    if PGPASSWORD="$supabase_password" PGGSSENCMODE=disable psql -h "$supabase_host" -p "$supabase_port" -U "$supabase_username" -d postgres -c "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' LIMIT 1;" >/dev/null 2>&1; then
                        tables_exist=true
                    fi
                fi
                
                if [ "$tables_exist" = true ]; then
                    print_error "Failed to dump $schema schema despite tables existing"
                    exit 1
                else
                    print_warning "No tables found in $schema schema - skipping"
                    continue
                fi
            fi
        fi
    done
}

# Function to dump auth data with column compatibility
dump_auth_data() {
    local supabase_password="$1"
    local supabase_username="$2"
    local supabase_host="$3"
    local supabase_port="$4"
    local dump_file="$5"
    
    print_status "Creating compatible auth data dump..."
    
    # Create a temporary SQL file with INSERT statements for compatible columns only
    cat > "$dump_file" << 'EOF'
-- Auth data dump with column compatibility
-- Disable triggers during load
SET session_replication_role = replica;

-- Clear existing data
TRUNCATE TABLE auth.users CASCADE;
TRUNCATE TABLE auth.identities CASCADE;
TRUNCATE TABLE auth.refresh_tokens CASCADE;

-- Reset sequences
SELECT setval('auth.users_id_seq', 1, false);
SELECT setval('auth.identities_id_seq', 1, false);
SELECT setval('auth.refresh_tokens_id_seq', 1, false);

EOF

    # Dump users data (only compatible columns)
    print_status "Dumping users data..."
    PGPASSWORD="$supabase_password" PGGSSENCMODE=disable psql -h "$supabase_host" -p "$supabase_port" -U "$supabase_username" -d postgres -c "
        COPY (
            SELECT id, email, created_at, encrypted_password, email_confirmed_at, 
                   last_sign_in_at, raw_app_meta_data, raw_user_meta_data, updated_at
            FROM auth.users
        ) TO STDOUT WITH CSV HEADER
    " >> "$dump_file.tmp"

    # Convert CSV to INSERT statements for users
    if [ -s "$dump_file.tmp" ]; then
        echo "-- Users data" >> "$dump_file"
        echo "COPY auth.users (id, email, created_at, encrypted_password, email_confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, updated_at) FROM STDIN WITH CSV HEADER;" >> "$dump_file"
        cat "$dump_file.tmp" >> "$dump_file"
        echo "\\." >> "$dump_file"
        echo "" >> "$dump_file"
        rm "$dump_file.tmp"
    fi

    # Dump identities data (only compatible columns)
    print_status "Dumping identities data..."
    PGPASSWORD="$supabase_password" PGGSSENCMODE=disable psql -h "$supabase_host" -p "$supabase_port" -U "$supabase_username" -d postgres -c "
        COPY (
            SELECT id, user_id, provider, provider_id as provider_user_id, identity_data as provider_data, created_at, updated_at
            FROM auth.identities
        ) TO STDOUT WITH CSV HEADER
    " >> "$dump_file.tmp"

    # Convert CSV to INSERT statements for identities
    if [ -s "$dump_file.tmp" ]; then
        echo "-- Identities data" >> "$dump_file"
        echo "COPY auth.identities (id, user_id, provider, provider_user_id, provider_data, created_at, updated_at) FROM STDIN WITH CSV HEADER;" >> "$dump_file"
        cat "$dump_file.tmp" >> "$dump_file"
        echo "\\." >> "$dump_file"
        echo "" >> "$dump_file"
        rm "$dump_file.tmp"
    fi

    # Dump refresh_tokens data (only compatible columns)
    print_status "Dumping refresh_tokens data..."
    PGPASSWORD="$supabase_password" PGGSSENCMODE=disable psql -h "$supabase_host" -p "$supabase_port" -U "$supabase_username" -d postgres -c "
        COPY (
            SELECT id, token, user_id, parent, revoked, created_at, updated_at
            FROM auth.refresh_tokens
        ) TO STDOUT WITH CSV HEADER
    " >> "$dump_file.tmp"

    # Convert CSV to INSERT statements for refresh_tokens
    if [ -s "$dump_file.tmp" ]; then
        echo "-- Refresh tokens data" >> "$dump_file"
        echo "COPY auth.refresh_tokens (id, token, user_id, parent, revoked, created_at, updated_at) FROM STDIN WITH CSV HEADER;" >> "$dump_file"
        cat "$dump_file.tmp" >> "$dump_file"
        echo "\\." >> "$dump_file"
        echo "" >> "$dump_file"
        rm "$dump_file.tmp"
    fi

    # Re-enable triggers
    echo "-- Re-enable triggers" >> "$dump_file"
    echo "SET session_replication_role = DEFAULT;" >> "$dump_file"
    
    print_success "Created compatible auth data dump at $dump_file"
}

# Function to clear local data
clear_local_data() {
    print_status "Clearing local data..."
    
    # Use default values if not set
    local db_host="${LOCAL_DB_HOST:-localhost}"
    local db_port="${LOCAL_DB_PORT:-5433}"
    local db_user="${LOCAL_DB_USER:-postgres}"
    local db_name="${LOCAL_DB_NAME:-retroscope}"
    local db_password="${LOCAL_DB_PASSWORD:-postgres}"
    
    # Disable triggers temporarily
    PGPASSWORD="$db_password" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "SET session_replication_role = replica;"
    
    for schema in "${SCHEMAS[@]}"; do
        if [ "$schema" = "auth" ]; then
            print_status "Auth schema will be cleared by the auth dump process"
            continue
        fi
        
        print_status "Clearing $schema schema..."
        
        # Get list of tables in the schema
        local tables=$(PGPASSWORD="$db_password" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -t -c "
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = '$schema'
            ORDER BY tablename;
        " | tr -d ' ')
        
        if [ -n "$tables" ]; then
            # Truncate all tables in the schema
            for table in $tables; do
                PGPASSWORD="$db_password" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "TRUNCATE TABLE $schema.$table CASCADE;"
            done
            print_success "Cleared $schema schema ($(echo $tables | wc -w) tables)"
        else
            print_warning "No tables found in $schema schema"
        fi
    done
    
    # Re-enable triggers
    PGPASSWORD="$db_password" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "SET session_replication_role = DEFAULT;"
    
    print_success "Local data cleared"
}

# Function to load data into local database
load_local_data() {
    print_status "Loading data into local database..."
    
    # Use default values if not set
    local db_host="${LOCAL_DB_HOST:-localhost}"
    local db_port="${LOCAL_DB_PORT:-5433}"
    local db_user="${LOCAL_DB_USER:-postgres}"
    local db_name="${LOCAL_DB_NAME:-retroscope}"
    local db_password="${LOCAL_DB_PASSWORD:-postgres}"
    
    for schema in "${SCHEMAS[@]}"; do
        local dump_file="$TEMP_DIR/${schema}_data.sql"
        
        print_status "Checking for dump file: $dump_file"
        
        if [ -f "$dump_file" ]; then
            # Check if file has content
            if [ ! -s "$dump_file" ]; then
                print_warning "Dump file for $schema schema is empty, skipping"
                continue
            fi
            
            print_status "Loading $schema schema..."
            
            # Disable triggers during load
            PGPASSWORD="$db_password" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "SET session_replication_role = replica;"
            
            # Load the data and capture exit status
            if PGPASSWORD="$db_password" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -f "$dump_file"; then
                # Re-enable triggers
                PGPASSWORD="$db_password" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "SET session_replication_role = DEFAULT;"
                print_success "Loaded $schema schema"
            else
                # Re-enable triggers even on failure
                PGPASSWORD="$db_password" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "SET session_replication_role = DEFAULT;"
                print_error "Failed to load $schema schema"
                exit 1
            fi
        else
            print_warning "No dump file found for $schema schema at: $dump_file"
            # List what files do exist in temp dir
            if [ -d "$TEMP_DIR" ]; then
                print_status "Files in temp directory:"
                ls -la "$TEMP_DIR" | tail -n +4
            fi
        fi
    done
}

# Function to cleanup temporary files
cleanup() {
    print_status "Cleaning up temporary files..."
    
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
        print_success "Temporary files cleaned up"
    fi
}

# Function to show summary
show_summary() {
    print_success "Database sync completed successfully!"
    print_status ""
    print_status "Summary:"
    print_status "========="
    print_status "• Source: Supabase ($SUPABASE_PROJECT_REF)"
    print_status "• Target: Local PostgreSQL (${LOCAL_DB_HOST:-localhost}:${LOCAL_DB_PORT:-5433}/$LOCAL_DB_NAME)"
    print_status "• Schemas synced: ${SCHEMAS[*]}"
    print_status "• Log file: $LOG_FILE"
    print_status ""
    print_status "Next steps:"
    print_status "• Test your local application"
    print_status "• Verify data integrity"
    print_status "• Check logs if you encounter any issues"
}

# Function to ask for confirmation
confirm_sync() {
    print_warning "This will completely replace your local database data with Supabase data!"
    print_warning "All existing local data will be lost."
    print_status ""
    print_status "Schemas to sync: ${SCHEMAS[*]}"
    print_status "Auth tables: ${AUTH_TABLES[*]}"
    if [ ${#PUBLIC_TABLES[@]} -eq 0 ]; then
        print_status "Public tables: ALL"
    else
        print_status "Public tables: ${PUBLIC_TABLES[*]}"
    fi
    print_status ""
    
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Operation cancelled."
        exit 0
    fi
}

# Main execution
main() {
    log_message "Starting database sync from Supabase to local PostgreSQL"
    
    print_status "Database Sync Script"
    print_status "===================="
    print_status "Syncing from Supabase to local PostgreSQL database"
    print_status ""
    
    # Run all checks and operations
    check_dependencies
    load_env
    check_docker
    test_supabase_connection
    test_local_connection
    confirm_sync
    setup_temp_dir
    
    # Perform the sync
    dump_supabase_data
    clear_local_data
    load_local_data
    
    # Cleanup and summary
    cleanup
    show_summary
    
    log_message "Database sync completed successfully"
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"
