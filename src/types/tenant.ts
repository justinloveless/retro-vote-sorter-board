export interface TenantConfig {
    id: string;
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
    createdAt: string;
    updatedAt: string;
}

export interface TenantContext {
    tenant: TenantConfig | null;
    loading: boolean;
    error: string | null;
}

export interface DatabaseConnection {
    type: 'shared' | 'isolated' | 'custom';
    supabaseUrl: string;
    supabaseAnonKey: string;
    connectionString?: string;
}

export interface TenantIdentification {
    tenantId: string;
    subdomain: string;
    source: 'subdomain' | 'header' | 'default';
}

