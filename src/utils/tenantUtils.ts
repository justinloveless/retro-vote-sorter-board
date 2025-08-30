import { TenantIdentification, DatabaseConnection } from '@/types/tenant';

// Default tenant configuration for shared database
const DEFAULT_TENANT_ID = 'shared';
const DEFAULT_SUBDOMAIN = 'app';

/**
 * Extract tenant information from the current URL
 */
export const getTenantFromUrl = (): TenantIdentification => {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');

    // Handle localhost development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return {
            tenantId: DEFAULT_TENANT_ID,
            subdomain: DEFAULT_SUBDOMAIN,
            source: 'default'
        };
    }

    // Extract subdomain (first part before the domain)
    if (parts.length >= 2) {
        const subdomain = parts[0];

        // Skip common subdomains that aren't tenant-specific
        if (['www', 'api', 'admin', 'static', 'cdn'].includes(subdomain)) {
            return {
                tenantId: DEFAULT_TENANT_ID,
                subdomain: DEFAULT_SUBDOMAIN,
                source: 'default'
            };
        }

        return {
            tenantId: subdomain,
            subdomain: subdomain,
            source: 'subdomain'
        };
    }

    return {
        tenantId: DEFAULT_TENANT_ID,
        subdomain: DEFAULT_SUBDOMAIN,
        source: 'default'
    };
};

/**
 * Get tenant ID from X-Tenant header (for API calls)
 */
export const getTenantFromHeader = (): string | null => {
    // This would be used in API calls where headers are available
    // For client-side, we'll use the URL-based approach
    return null;
};

/**
 * Get the current tenant identification
 */
export const getCurrentTenant = (): TenantIdentification => {
    return getTenantFromUrl();
};

/**
 * Build tenant-specific URL
 */
export const buildTenantUrl = (tenantId: string, path: string = ''): string => {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;

    if (tenantId === DEFAULT_TENANT_ID) {
        return `${protocol}//${hostname}${path}`;
    }

    // For localhost development, use query parameter
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        const url = new URL(window.location.href);
        url.searchParams.set('tenant', tenantId);
        return `${url.origin}${path}${url.search}`;
    }

    // For production, use subdomain
    const domainParts = hostname.split('.');
    if (domainParts.length >= 2) {
        const domain = domainParts.slice(-2).join('.');
        return `${protocol}//${tenantId}.${domain}${path}`;
    }

    return `${protocol}//${hostname}${path}`;
};

/**
 * Get database connection configuration for a tenant
 */
export const getDatabaseConnection = async (tenantId: string): Promise<DatabaseConnection> => {
    // For now, return the default connection
    // In a real implementation, this would fetch tenant-specific config from the database

    // Check for environment variables for isolated databases
    const isolatedUrl = import.meta.env[`VITE_TENANT_${tenantId.toUpperCase()}_SUPABASE_URL`];
    const isolatedKey = import.meta.env[`VITE_TENANT_${tenantId.toUpperCase()}_SUPABASE_ANON_KEY`];

    if (isolatedUrl && isolatedKey) {
        return {
            type: 'isolated',
            supabaseUrl: isolatedUrl,
            supabaseAnonKey: isolatedKey
        };
    }

    // Return shared database connection
    return {
        type: 'shared',
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "https://nwfwbjmzbwuyxehindpv.supabase.co",
        supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53Zndiam16Ynd1eXhlaGluZHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MjkyMzksImV4cCI6MjA2NDEwNTIzOX0.s_vI6z46NAYlpB8K0wznCWEr_cFcnsHh7Qn4LmsUZU0"
    };
};

/**
 * Add tenant context to API requests
 */
export const addTenantHeaders = (headers: Record<string, string> = {}): Record<string, string> => {
    const tenant = getCurrentTenant();
    return {
        ...headers,
        'X-Tenant': tenant.tenantId,
        'X-Tenant-Subdomain': tenant.subdomain
    };
};

/**
 * Check if current tenant is the default/shared tenant
 */
export const isDefaultTenant = (): boolean => {
    const tenant = getCurrentTenant();
    return tenant.tenantId === DEFAULT_TENANT_ID;
};

/**
 * Get tenant-specific storage key
 */
export const getTenantStorageKey = (key: string): string => {
    const tenant = getCurrentTenant();
    return `${tenant.tenantId}:${key}`;
};
