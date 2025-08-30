#!/bin/bash

# Tenant Migration Helper Script
# This script helps manage multi-tenancy migrations during development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to check if Supabase CLI is installed
check_supabase_cli() {
    if ! command -v supabase &> /dev/null; then
        print_error "Supabase CLI is not installed. Please install it first."
        print_status "Installation guide: https://supabase.com/docs/guides/cli"
        exit 1
    fi
}

# Function to check if we're in a Supabase project
check_supabase_project() {
    if [ ! -f "supabase/config.toml" ]; then
        print_error "Not in a Supabase project directory. Please run this script from your project root."
        exit 1
    fi
}

# Function to apply tenant migrations
apply_tenant_migrations() {
    print_status "Applying tenant migrations..."
    
    # Apply the main tenant migration
    supabase db push --include-all
    
    print_success "Tenant migrations applied successfully!"
    print_status "You can now test the multi-tenancy features:"
    print_status "1. Go to /admin page"
    print_status "2. Use the Tenant Selector to create and switch tenants"
    print_status "3. Test with different subdomains or query parameters"
}

# Function to rollback tenant migrations
rollback_tenant_migrations() {
    print_warning "This will remove all multi-tenancy features and data!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Rolling back tenant migrations..."
        
        # Reset to the migration before tenant changes
        # You'll need to specify the correct migration hash
        print_status "Please specify the migration hash to reset to (before tenant changes):"
        read -p "Migration hash: " migration_hash
        
        if [ -n "$migration_hash" ]; then
            supabase db reset --linked
            supabase db push --include-all
            print_success "Tenant migrations rolled back successfully!"
        else
            print_error "No migration hash provided. Rollback cancelled."
        fi
    else
        print_status "Rollback cancelled."
    fi
}

# Function to show current migration status
show_migration_status() {
    print_status "Current migration status:"
    supabase migration list
}

# Function to create a new tenant for testing
create_test_tenant() {
    print_status "Creating a test tenant..."
    
    # This would typically be done through the UI, but for testing we can use SQL
    cat << 'EOF' | supabase db reset --linked
-- Create a test tenant
INSERT INTO public.tenants (id, name, subdomain, database_type, features, settings)
VALUES (
  gen_random_uuid(),
  'Test Workspace',
  'test',
  'shared',
  '{"retroBoards": true, "pokerSessions": true, "teamManagement": true, "adminPanel": false}',
  '{"allowAnonymousUsers": true, "requireEmailVerification": false, "maxTeamMembers": 50, "maxBoardsPerTeam": 100}'
) ON CONFLICT (subdomain) DO NOTHING;
EOF
    
    print_success "Test tenant created! You can access it at: http://localhost:3000?tenant=test"
}

# Function to show help
show_help() {
    echo "Tenant Migration Helper Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  apply     - Apply tenant migrations"
    echo "  rollback  - Rollback tenant migrations"
    echo "  status    - Show current migration status"
    echo "  test      - Create a test tenant"
    echo "  help      - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 apply     # Apply multi-tenancy features"
    echo "  $0 rollback  # Remove multi-tenancy features"
    echo "  $0 status    # Check migration status"
}

# Main script logic
main() {
    check_supabase_cli
    check_supabase_project
    
    case "${1:-help}" in
        "apply")
            apply_tenant_migrations
            ;;
        "rollback")
            rollback_tenant_migrations
            ;;
        "status")
            show_migration_status
            ;;
        "test")
            create_test_tenant
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Run main function with all arguments
main "$@"

