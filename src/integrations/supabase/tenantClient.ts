import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { getCurrentTenant, getDatabaseConnection } from '@/utils/tenantUtils';
import { TenantConfig } from '@/types/tenant';

// Cache for tenant-specific clients
const clientCache = new Map<string, SupabaseClient<Database>>();

/**
 * Get a Supabase client for the current tenant
 */
export const getTenantSupabaseClient = async (): Promise<SupabaseClient<Database>> => {
    const tenant = getCurrentTenant();
    const tenantId = tenant.tenantId;

    // Check if we already have a client for this tenant
    if (clientCache.has(tenantId)) {
        return clientCache.get(tenantId)!;
    }

    // Get database connection configuration for this tenant
    const dbConfig = await getDatabaseConnection(tenantId);

    // Create new client
    const client = createClient<Database>(
        dbConfig.supabaseUrl,
        dbConfig.supabaseAnonKey,
        {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            },
            global: {
                headers: {
                    'X-Tenant': tenantId,
                    'X-Tenant-Subdomain': tenant.subdomain
                }
            }
        }
    );

    // Cache the client
    clientCache.set(tenantId, client);

    return client;
};

/**
 * Get a Supabase client for a specific tenant
 */
export const getSupabaseClientForTenant = async (tenantId: string): Promise<SupabaseClient<Database>> => {
    // Check if we already have a client for this tenant
    if (clientCache.has(tenantId)) {
        return clientCache.get(tenantId)!;
    }

    // Get database connection configuration for this tenant
    const dbConfig = await getDatabaseConnection(tenantId);

    // Create new client
    const client = createClient<Database>(
        dbConfig.supabaseUrl,
        dbConfig.supabaseAnonKey,
        {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            },
            global: {
                headers: {
                    'X-Tenant': tenantId,
                    'X-Tenant-Subdomain': tenantId
                }
            }
        }
    );

    // Cache the client
    clientCache.set(tenantId, client);

    return client;
};

/**
 * Clear the client cache (useful for testing or when switching tenants)
 */
export const clearTenantClientCache = () => {
    clientCache.clear();
};

/**
 * Get the current tenant's Supabase client (synchronous version for existing code)
 * This maintains backward compatibility with your existing code
 */
export const getCurrentTenantSupabaseClient = (): SupabaseClient<Database> => {
    const tenant = getCurrentTenant();
    const tenantId = tenant.tenantId;

    // Return cached client if available
    if (clientCache.has(tenantId)) {
        return clientCache.get(tenantId)!;
    }

    // For backward compatibility, return a default client
    // This will be replaced by the async version in most cases
    const defaultClient = createClient<Database>(
        import.meta.env.VITE_SUPABASE_URL || "https://nwfwbjmzbwuyxehindpv.supabase.co",
        import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53Zndiam16Ynd1eXhlaGluZHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MjkyMzksImV4cCI6MjA2NDEwNTIzOX0.s_vI6z46NAYlpB8K0wznCWEr_cFcnsHh7Qn4LmsUZU0",
        {
            global: {
                headers: {
                    'X-Tenant': tenantId,
                    'X-Tenant-Subdomain': tenant.subdomain
                }
            }
        }
    );

    clientCache.set(tenantId, defaultClient);
    return defaultClient;
};

