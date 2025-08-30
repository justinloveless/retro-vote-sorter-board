import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { TenantConfig, TenantContext as TenantContextType } from '@/types/tenant';
import { getCurrentTenant, getDatabaseConnection } from '@/utils/tenantUtils';
import { TenantService } from '@/services/tenantService';

interface TenantProviderProps {
    children: ReactNode;
}

const TenantContext = createContext<TenantContextType>({
    tenant: null,
    loading: true,
    error: null
});

export const useTenant = () => {
    const context = useContext(TenantContext);
    if (!context) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
};

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
    const [tenant, setTenant] = useState<TenantConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadTenant = async () => {
            try {
                setLoading(true);
                setError(null);

                const tenantId = getCurrentTenant().tenantId;

                // Try to fetch tenant from database first
                let tenantConfig = await TenantService.getTenantBySubdomain(tenantId);

                // If tenant doesn't exist in database, create a default config
                if (!tenantConfig) {
                    console.warn(`Tenant '${tenantId}' not found in database, using default config`);
                    tenantConfig = {
                        id: tenantId,
                        name: tenantId === 'shared' ? 'Shared Workspace' : `${tenantId.charAt(0).toUpperCase() + tenantId.slice(1)} Workspace`,
                        subdomain: getCurrentTenant().subdomain,
                        databaseType: 'shared',
                        features: {
                            retroBoards: true,
                            pokerSessions: true,
                            teamManagement: true,
                            adminPanel: tenantId === 'shared' // Only shared tenant gets admin panel for now
                        },
                        settings: {
                            allowAnonymousUsers: true,
                            requireEmailVerification: false,
                            maxTeamMembers: 50,
                            maxBoardsPerTeam: 100
                        },
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                }

                setTenant(tenantConfig);
            } catch (err) {
                console.error('Error loading tenant:', err);
                setError(err instanceof Error ? err.message : 'Failed to load tenant');
            } finally {
                setLoading(false);
            }
        };

        loadTenant();
    }, []);

    const value: TenantContextType = {
        tenant,
        loading,
        error
    };

    return (
        <TenantContext.Provider value={value}>
            {children}
        </TenantContext.Provider>
    );
};
