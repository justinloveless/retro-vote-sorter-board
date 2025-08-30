# Multi-Tenancy Implementation Guide

This guide explains the multi-tenancy implementation for your Supabase-based application, which allows users to choose between shared, isolated, or custom database connections while maintaining data isolation.

## Overview

The multi-tenancy system provides:

1. **Subdomain-based tenant identification** (e.g., `acme.yourdomain.com`)
2. **X-Tenant header support** for API calls
3. **Database connection flexibility** (shared, isolated, custom)
4. **Automatic data isolation** through RLS policies
5. **Tenant-specific configuration** and feature flags

## Architecture

### Core Components

1. **Tenant Context** (`src/contexts/TenantContext.tsx`)
   - Manages tenant state throughout the application
   - Provides tenant configuration to all components

2. **Tenant Utils** (`src/utils/tenantUtils.ts`)
   - Handles tenant identification from URLs and headers
   - Manages database connections for different tenants

3. **Tenant Service** (`src/services/tenantService.ts`)
   - CRUD operations for tenant management
   - Subdomain availability checking

4. **Database Schema** (`supabase/migrations/20250116000000_create_tenants_table.sql`)
   - Tenant table with configuration
   - Automatic tenant_id assignment via triggers
   - RLS policies for data isolation

## Database Connection Strategies

### 1. Shared Database (Default)
- All tenants share the same Supabase project
- Data isolation through `tenant_id` column and RLS policies
- Most cost-effective option

### 2. Isolated Database
- Each tenant gets their own Supabase project
- Complete data isolation
- Higher cost but maximum security

### 3. Custom Database
- Tenants provide their own database connection string
- Maximum flexibility
- Requires tenant to manage their own database

## Implementation Details

### Tenant Identification

The system identifies tenants through:

1. **Subdomain**: `acme.yourdomain.com` → tenant ID: `acme`
2. **X-Tenant Header**: API calls include `X-Tenant: acme`
3. **Query Parameter**: Development mode uses `?tenant=acme`

### Data Isolation

All data is automatically isolated by:

1. **Database Triggers**: Automatically set `tenant_id` on insert
2. **RLS Policies**: Filter all queries by current tenant
3. **Header Injection**: All Supabase calls include tenant headers

### Tenant Configuration

Each tenant has configurable:

- **Features**: Which app features are enabled
- **Settings**: Limits and behavior configuration
- **Database**: Connection details for isolated/custom databases

## Usage

### For Developers

#### 1. Access Tenant Information

```typescript
import { useTenant } from '@/contexts/TenantContext';

const MyComponent = () => {
  const { tenant, loading, error } = useTenant();
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return <div>Current tenant: {tenant?.name}</div>;
};
```

#### 2. Get Tenant-Aware Supabase Client

```typescript
import { getTenantSupabaseClient } from '@/integrations/supabase/tenantClient';

const MyService = async () => {
  const supabase = await getTenantSupabaseClient();
  const { data } = await supabase.from('teams').select('*');
  // Data is automatically filtered by tenant
};
```

#### 3. Build Tenant URLs

```typescript
import { buildTenantUrl } from '@/utils/tenantUtils';

const url = buildTenantUrl('acme', '/teams');
// Returns: https://acme.yourdomain.com/teams
```

### For Administrators

#### 1. Create a New Tenant

```typescript
import { TenantService } from '@/services/tenantService';

const newTenant = await TenantService.createTenant({
  name: 'Acme Corporation',
  subdomain: 'acme',
  databaseType: 'shared', // or 'isolated' or 'custom'
  features: {
    retroBoards: true,
    pokerSessions: true,
    teamManagement: true,
    adminPanel: false
  },
  settings: {
    allowAnonymousUsers: true,
    requireEmailVerification: false,
    maxTeamMembers: 50,
    maxBoardsPerTeam: 100
  }
});
```

#### 2. Update Tenant Configuration

```typescript
await TenantService.updateTenant({
  id: tenantId,
  databaseType: 'isolated',
  databaseConfig: {
    supabaseUrl: 'https://acme-project.supabase.co',
    supabaseAnonKey: 'acme-anon-key'
  }
});
```

## Development Setup

### 1. Run Database Migration

```bash
supabase db push
```

**Note**: The migration includes a backfill step that assigns all existing data to the shared tenant. This ensures your existing data continues to work with the multi-tenancy system.

### 2. Test Tenant Switching

1. Go to `/admin` page
2. Use the Tenant Selector component
3. Create new tenants or switch between existing ones

### 3. Local Development

For local development, tenants are identified via query parameters:

- `http://localhost:3000?tenant=acme`
- `http://localhost:3000?tenant=shared`

### 4. Rollback Migration (Experimental Development)

If you need to undo the multi-tenancy changes during development:

```bash
# Option 1: Use the rollback script
./scripts/rollback-tenants.sh

# Option 2: Apply the rollback migration manually
supabase db push --include-all
```

The rollback migration (`20250116000001_rollback_tenants_table.sql`) will:
- Remove all tenant-related tables and columns
- Restore original RLS policies
- Drop tenant-specific functions and triggers
- Clean up all multi-tenancy infrastructure

**⚠️ Warning**: This will permanently delete all tenant data and configuration.

### 5. Data Migration

When you first apply the multi-tenancy migrations, all existing data is automatically assigned to the shared tenant:

- **Existing users** → Shared tenant
- **Existing teams** → Shared tenant  
- **Existing boards** → Shared tenant
- **Existing templates** → Shared tenant

This ensures your existing data continues to work seamlessly with the new multi-tenancy system. The shared tenant acts as a "legacy workspace" containing all your pre-multi-tenant data.

## Production Deployment

### 1. DNS Configuration

Set up wildcard DNS for your domain:

```
*.yourdomain.com  CNAME  yourdomain.com
```

### 2. Reverse Proxy Configuration

Configure your reverse proxy (nginx, Cloudflare, etc.) to:

1. Extract subdomain from hostname
2. Add `X-Tenant` header to requests
3. Route to your application

Example nginx configuration:

```nginx
server {
    listen 80;
    server_name *.yourdomain.com;
    
    location / {
        set $tenant $subdomain;
        proxy_set_header X-Tenant $tenant;
        proxy_pass http://your-app:3000;
    }
}
```

### 3. Environment Variables

Set up environment variables for different database connections:

```bash
# Default shared database
VITE_SUPABASE_URL=https://shared-project.supabase.co
VITE_SUPABASE_ANON_KEY=shared-anon-key

# Tenant-specific databases (optional)
VITE_TENANT_ACME_SUPABASE_URL=https://acme-project.supabase.co
VITE_TENANT_ACME_SUPABASE_ANON_KEY=acme-anon-key
```

## Extending the System

### Adding New Database Types

1. Update the `DatabaseConnection` type in `src/types/tenant.ts`
2. Modify `getDatabaseConnection` in `src/utils/tenantUtils.ts`
3. Add new connection logic for your database type

### Adding Tenant-Specific Features

1. Add feature flags to the tenant configuration
2. Use `useTenant()` hook to check feature availability
3. Conditionally render components based on tenant features

### Custom Authentication

For isolated databases, you may need to handle authentication differently:

1. Create tenant-specific auth providers
2. Manage session tokens per tenant
3. Handle cross-tenant user migration

## Security Considerations

### Data Isolation

- All RLS policies include tenant filtering
- Database triggers prevent cross-tenant data leakage
- Headers are validated on the server side

### Access Control

- Admin panel access is controlled by tenant configuration
- Feature flags prevent unauthorized feature access
- User permissions are scoped to tenant

### API Security

- All API calls include tenant headers
- Server validates tenant headers before processing
- Cross-tenant requests are blocked

## Monitoring and Maintenance

### Tenant Analytics

Track tenant usage and performance:

```sql
-- Example query to monitor tenant activity
SELECT 
  t.name,
  t.subdomain,
  COUNT(rb.id) as board_count,
  COUNT(tm.id) as member_count
FROM tenants t
LEFT JOIN retro_boards rb ON t.id = rb.tenant_id
LEFT JOIN team_members tm ON t.id = tm.tenant_id
GROUP BY t.id, t.name, t.subdomain;
```

### Database Maintenance

For isolated databases:

1. Monitor storage usage per tenant
2. Set up automated backups
3. Implement data retention policies

### Cost Optimization

1. Monitor Supabase usage per tenant
2. Implement usage-based billing
3. Consider database consolidation for inactive tenants

## Troubleshooting

### Common Issues

1. **Tenant not found**: Check subdomain configuration and DNS
2. **Data isolation issues**: Verify RLS policies and triggers
3. **Authentication problems**: Check tenant-specific auth configuration

### Debug Tools

1. **Tenant Selector**: Use the admin panel to switch tenants
2. **Browser DevTools**: Check network requests for tenant headers
3. **Database Logs**: Monitor Supabase logs for tenant-related queries

### Migration Management

#### During Development

Use the provided scripts to manage tenant migrations:

```bash
# Apply tenant migrations
./scripts/tenant-migration-helper.sh apply

# Check migration status
./scripts/tenant-migration-helper.sh status

# Create test tenant
./scripts/tenant-migration-helper.sh test

# Rollback tenant migrations
./scripts/rollback-tenants.sh
```

#### Manual Migration Commands

```bash
# Apply all migrations (including tenant migrations)
supabase db push --include-all

# Reset database and reapply all migrations
supabase db reset --linked

# List all migrations
supabase migration list

# Create a new migration
supabase migration new your_migration_name
```

## Future Enhancements

### Planned Features

1. **Tenant Analytics Dashboard**: Usage metrics and insights
2. **Automated Provisioning**: Self-service tenant creation
3. **Cross-Tenant Migration**: Tools for moving data between tenants
4. **Advanced Billing**: Usage-based pricing per tenant

### Integration Opportunities

1. **SSO Integration**: Tenant-specific authentication providers
2. **API Rate Limiting**: Per-tenant request limits
3. **Custom Domains**: Allow tenants to use their own domains
4. **White-Labeling**: Custom branding per tenant

## Support

For questions or issues with the multi-tenancy implementation:

1. Check the database migration logs
2. Verify tenant configuration in the admin panel
3. Review RLS policies and triggers
4. Test with the Tenant Selector component

The multi-tenancy system is designed to be flexible and extensible, allowing you to grow from a simple shared database setup to a complex multi-tenant architecture as your needs evolve.
