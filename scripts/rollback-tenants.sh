#!/bin/bash

# Manual Rollback Script for Tenant Migrations
# Run this script to undo all tenant-related changes

set -e

echo "🔄 Rolling back tenant migrations..."

# Check if we're in a Supabase project
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Error: Not in a Supabase project directory. Please run this script from your project root."
    exit 1
fi

# Confirm rollback
echo "⚠️  WARNING: This will remove all multi-tenancy features and data!"
echo "   - All tenant data will be lost"
echo "   - Database schema will be reverted"
echo "   - RLS policies will be restored to original state"
echo ""
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Rollback cancelled."
    exit 0
fi

echo "🔄 Starting rollback process..."

# Apply the rollback migration
echo "📦 Applying rollback migration..."
supabase db push --include-all

echo "✅ Tenant migrations rolled back successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Your database is now back to its original state"
echo "   2. Multi-tenancy features are disabled"
echo "   3. You can continue development without tenant isolation"
echo ""
echo "💡 To re-enable multi-tenancy later, run:"
echo "   supabase db push --include-all"

