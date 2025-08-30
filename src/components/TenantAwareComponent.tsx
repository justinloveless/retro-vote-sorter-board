import React from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getTenantStorageKey } from '@/utils/tenantUtils';

/**
 * Example component demonstrating multi-tenancy usage
 */
export const TenantAwareComponent: React.FC = () => {
    const { tenant, loading, error } = useTenant();

    if (loading) {
        return (
            <Card>
                <CardContent className="p-4">
                    <div className="text-sm text-gray-500">Loading tenant information...</div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="p-4">
                    <div className="text-sm text-red-500">Error: {error}</div>
                </CardContent>
            </Card>
        );
    }

    if (!tenant) {
        return (
            <Card>
                <CardContent className="p-4">
                    <div className="text-sm text-gray-500">No tenant information available</div>
                </CardContent>
            </Card>
        );
    }

    // Example of tenant-specific storage
    const handleSavePreference = () => {
        const storageKey = getTenantStorageKey('user-preference');
        localStorage.setItem(storageKey, 'example-value');
    };

    const handleLoadPreference = () => {
        const storageKey = getTenantStorageKey('user-preference');
        const value = localStorage.getItem(storageKey);
        console.log(`Tenant-specific preference: ${value}`);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    Tenant Information
                    <Badge variant={tenant.databaseType === 'shared' ? 'default' : 'secondary'}>
                        {tenant.databaseType}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <strong>Name:</strong> {tenant.name}
                    </div>
                    <div>
                        <strong>Subdomain:</strong> {tenant.subdomain}
                    </div>
                    <div>
                        <strong>Database Type:</strong> {tenant.databaseType}
                    </div>
                    <div>
                        <strong>Created:</strong> {new Date(tenant.createdAt).toLocaleDateString()}
                    </div>
                </div>

                {/* Feature Flags */}
                <div>
                    <strong className="text-sm">Enabled Features:</strong>
                    <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(tenant.features).map(([feature, enabled]) => (
                            <Badge
                                key={feature}
                                variant={enabled ? 'default' : 'outline'}
                                className="text-xs"
                            >
                                {feature}: {enabled ? 'Yes' : 'No'}
                            </Badge>
                        ))}
                    </div>
                </div>

                {/* Settings */}
                <div>
                    <strong className="text-sm">Settings:</strong>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                        <div>Max Team Members: {tenant.settings.maxTeamMembers}</div>
                        <div>Max Boards: {tenant.settings.maxBoardsPerTeam}</div>
                        <div>Anonymous Users: {tenant.settings.allowAnonymousUsers ? 'Yes' : 'No'}</div>
                        <div>Email Verification: {tenant.settings.requireEmailVerification ? 'Yes' : 'No'}</div>
                    </div>
                </div>

                {/* Example Actions */}
                <div className="flex gap-2">
                    <Button onClick={handleSavePreference} size="sm">
                        Save Tenant Preference
                    </Button>
                    <Button onClick={handleLoadPreference} size="sm" variant="outline">
                        Load Tenant Preference
                    </Button>
                </div>

                {/* Conditional Rendering Based on Features */}
                {tenant.features.adminPanel && (
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
                        Admin panel is enabled for this tenant
                    </div>
                )}

                {!tenant.features.pokerSessions && (
                    <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs">
                        Poker sessions are disabled for this tenant
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

