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
AUTH_TABLES=("users" "identities" "refresh_tokens" "verification_codes")
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
    
    if ! command -v pg_dump &> /dev/null; then
        missing_tools+=("pg_dump (PostgreSQL client tools)")
    fi
    
    if ! command -v psql &> /dev/null; then
        missing_tools+=("psql (PostgreSQL client tools)")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_error "Please install the missing tools and try again."
        exit 1
    fi
    
    print_success "All dependencies found"
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
    
    if ! docker-compose ps postgres | grep -q "Up"; then
        print_error "PostgreSQL container is not running!"
        print_error "Please start the database with: docker-compose up -d postgres"
        exit 1
    fi
    
    print_success "PostgreSQL container is running"
}

# Function to test Supabase connection
test_supabase_connection() {
    print_status "Testing Supabase connection..."
    
    # Extract password from SUPABASE_DB_URL
    local supabase_password=$(echo "$SUPABASE_DB_URL" | sed -n 's/.*:\([^@]*\)@.*/\1/p')
    local supabase_host=$(echo "$SUPABASE_DB_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local supabase_port=$(echo "$SUPABASE_DB_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    if ! PGPASSWORD="$supabase_password" psql -h "$supabase_host" -p "$supabase_port" -U postgres -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
        print_error "Cannot connect to Supabase database!"
        print_error "Please check your SUPABASE_DB_URL in .env.sync"
        exit 1
    fi
    
    print_success "Supabase connection successful"
}

# Function to test local connection
test_local_connection() {
    print_status "Testing local PostgreSQL connection..."
    
    if ! PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        print_error "Cannot connect to local PostgreSQL database!"
        print_error "Please ensure the database is running and credentials are correct."
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
    
    local supabase_password=$(echo "$SUPABASE_DB_URL" | sed -n 's/.*:\([^@]*\)@.*/\1/p')
    local supabase_host=$(echo "$SUPABASE_DB_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local supabase_port=$(echo "$SUPABASE_DB_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    for schema in "${SCHEMAS[@]}"; do
        print_status "Dumping $schema schema..."
        
        local dump_file="$TEMP_DIR/${schema}_data.sql"
        local tables_arg=""
        
        # Build table list if specified
        if [ "$schema" = "auth" ] && [ ${#AUTH_TABLES[@]} -gt 0 ]; then
            tables_arg="--table=${AUTH_TABLES[*]}"
        elif [ "$schema" = "public" ] && [ ${#PUBLIC_TABLES[@]} -gt 0 ]; then
            tables_arg="--table=${PUBLIC_TABLES[*]}"
        fi
        
        # Dump data only (no schema)
        PGPASSWORD="$supabase_password" pg_dump \
            --host="$supabase_host" \
            --port="$supabase_port" \
            --username=postgres \
            --dbname=postgres \
            --schema="$schema" \
            --data-only \
            --disable-triggers \
            --no-owner \
            --no-privileges \
            $tables_arg \
            --file="$dump_file"
        
        if [ $? -eq 0 ]; then
            print_success "Dumped $schema schema to $dump_file"
        else
            print_error "Failed to dump $schema schema"
            exit 1
        fi
    done
}

# Function to clear local data
clear_local_data() {
    print_status "Clearing local data..."
    
    # Disable triggers temporarily
    PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c "SET session_replication_role = replica;"
    
    for schema in "${SCHEMAS[@]}"; do
        print_status "Clearing $schema schema..."
        
        # Get list of tables in the schema
        local tables=$(PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -t -c "
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = '$schema'
            ORDER BY tablename;
        " | tr -d ' ')
        
        if [ -n "$tables" ]; then
            # Truncate all tables in the schema
            for table in $tables; do
                PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c "TRUNCATE TABLE $schema.$table CASCADE;"
            done
            print_success "Cleared $schema schema ($(echo $tables | wc -w) tables)"
        else
            print_warning "No tables found in $schema schema"
        fi
    done
    
    # Re-enable triggers
    PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c "SET session_replication_role = DEFAULT;"
    
    print_success "Local data cleared"
}

# Function to load data into local database
load_local_data() {
    print_status "Loading data into local database..."
    
    for schema in "${SCHEMAS[@]}"; do
        local dump_file="$TEMP_DIR/${schema}_data.sql"
        
        if [ -f "$dump_file" ]; then
            print_status "Loading $schema schema..."
            
            # Disable triggers during load
            PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c "SET session_replication_role = replica;"
            
            # Load the data
            PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -f "$dump_file"
            
            # Re-enable triggers
            PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c "SET session_replication_role = DEFAULT;"
            
            if [ $? -eq 0 ]; then
                print_success "Loaded $schema schema"
            else
                print_error "Failed to load $schema schema"
                exit 1
            fi
        else
            print_warning "No dump file found for $schema schema"
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
    print_status "• Target: Local PostgreSQL (localhost:5432/retroscope)"
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
