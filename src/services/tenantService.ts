import { supabase } from '@/integrations/supabase/client';
import { TenantConfig } from '@/types/tenant';
import { getCurrentTenant } from '@/utils/tenantUtils';

export interface CreateTenantRequest {
    name: string;
    subdomain: string;
    databaseType: 'shared' | 'isolated' | 'custom';
    databaseConfig?: {
        supabaseUrl?: string;
        supabaseAnonKey?: string;
        connectionString?: string;
    };
    features: {
        retroBoards: boolean;
        pokerSessions: boolean;
        teamManagement: boolean;
        adminPanel: boolean;
    };
    settings: {
        allowAnonymousUsers: boolean;
        requireEmailVerification: boolean;
        maxTeamMembers: number;
        maxBoardsPerTeam: number;
    };
}

export interface UpdateTenantRequest extends Partial<CreateTenantRequest> {
    id: string;
}

export class TenantService {
    /**
     * Get tenant by subdomain
     */
    static async getTenantBySubdomain(subdomain: string): Promise<TenantConfig | null> {
        try {
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .eq('subdomain', subdomain)
                .single();

            if (error) {
                console.error('Error fetching tenant:', error);
                return null;
            }

            return this.mapDatabaseToTenantConfig(data);
        } catch (error) {
            console.error('Error in getTenantBySubdomain:', error);
            return null;
        }
    }

    /**
     * Get tenant by ID
     */
    static async getTenantById(id: string): Promise<TenantConfig | null> {
        try {
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                console.error('Error fetching tenant:', error);
                return null;
            }

            return this.mapDatabaseToTenantConfig(data);
        } catch (error) {
            console.error('Error in getTenantById:', error);
            return null;
        }
    }

    /**
     * Get current tenant
     */
    static async getCurrentTenant(): Promise<TenantConfig | null> {
        const currentTenant = getCurrentTenant();
        return this.getTenantBySubdomain(currentTenant.subdomain);
    }

    /**
     * Create a new tenant
     */
    static async createTenant(request: CreateTenantRequest): Promise<TenantConfig | null> {
        try {
            const { data, error } = await supabase
                .from('tenants')
                .insert([{
                    name: request.name,
                    subdomain: request.subdomain,
                    database_type: request.databaseType,
                    database_config: request.databaseConfig || null,
                    features: request.features,
                    settings: request.settings
                }])
                .select()
                .single();

            if (error) {
                console.error('Error creating tenant:', error);
                return null;
            }

            return this.mapDatabaseToTenantConfig(data);
        } catch (error) {
            console.error('Error in createTenant:', error);
            return null;
        }
    }

    /**
     * Update an existing tenant
     */
    static async updateTenant(request: UpdateTenantRequest): Promise<TenantConfig | null> {
        try {
            const updateData: any = {};

            if (request.name) updateData.name = request.name;
            if (request.subdomain) updateData.subdomain = request.subdomain;
            if (request.databaseType) updateData.database_type = request.databaseType;
            if (request.databaseConfig) updateData.database_config = request.databaseConfig;
            if (request.features) updateData.features = request.features;
            if (request.settings) updateData.settings = request.settings;

            updateData.updated_at = new Date().toISOString();

            const { data, error } = await supabase
                .from('tenants')
                .update(updateData)
                .eq('id', request.id)
                .select()
                .single();

            if (error) {
                console.error('Error updating tenant:', error);
                return null;
            }

            return this.mapDatabaseToTenantConfig(data);
        } catch (error) {
            console.error('Error in updateTenant:', error);
            return null;
        }
    }

    /**
     * Delete a tenant
     */
    static async deleteTenant(id: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('tenants')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error deleting tenant:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error in deleteTenant:', error);
            return false;
        }
    }

    /**
     * List all tenants (admin only)
     */
    static async listTenants(): Promise<TenantConfig[]> {
        try {
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error listing tenants:', error);
                return [];
            }

            return data.map(this.mapDatabaseToTenantConfig);
        } catch (error) {
            console.error('Error in listTenants:', error);
            return [];
        }
    }

    /**
     * Check if subdomain is available
     */
    static async isSubdomainAvailable(subdomain: string): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .from('tenants')
                .select('id')
                .eq('subdomain', subdomain)
                .single();

            if (error && error.code === 'PGRST116') {
                // No rows returned, subdomain is available
                return true;
            }

            if (error) {
                console.error('Error checking subdomain availability:', error);
                return false;
            }

            // Subdomain exists, not available
            return false;
        } catch (error) {
            console.error('Error in isSubdomainAvailable:', error);
            return false;
        }
    }

    /**
     * Map database row to TenantConfig
     */
    private static mapDatabaseToTenantConfig(dbRow: any): TenantConfig {
        return {
            id: dbRow.id,
            name: dbRow.name,
            subdomain: dbRow.subdomain,
            databaseType: dbRow.database_type,
            databaseConfig: dbRow.database_config,
            features: dbRow.features,
            settings: dbRow.settings,
            createdAt: dbRow.created_at,
            updatedAt: dbRow.updated_at
        };
    }
}

