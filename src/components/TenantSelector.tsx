import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenant } from '@/contexts/TenantContext';
import { TenantService } from '@/services/tenantService';
import { buildTenantUrl } from '@/utils/tenantUtils';
import { TenantConfig } from '@/types/tenant';

interface TenantSelectorProps {
    className?: string;
}

export const TenantSelector: React.FC<TenantSelectorProps> = ({ className }) => {
    const { tenant, loading } = useTenant();
    const [tenants, setTenants] = useState<TenantConfig[]>([]);
    const [customSubdomain, setCustomSubdomain] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);

    useEffect(() => {
        loadTenants();
    }, []);

    const loadTenants = async () => {
        try {
            const tenantList = await TenantService.listTenants();
            setTenants(tenantList);
        } catch (error) {
            console.error('Error loading tenants:', error);
        }
    };

    const handleTenantChange = (tenantId: string) => {
        const selectedTenant = tenants.find(t => t.id === tenantId);
        if (selectedTenant) {
            const newUrl = buildTenantUrl(selectedTenant.subdomain);
            window.location.href = newUrl;
        }
    };

    const handleCustomSubdomain = () => {
        if (customSubdomain.trim()) {
            const newUrl = buildTenantUrl(customSubdomain.trim());
            window.location.href = newUrl;
        }
    };

    const handleCreateTenant = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!customSubdomain.trim()) return;

        setIsCreating(true);
        try {
            const newTenant = await TenantService.createTenant({
                name: `${customSubdomain.charAt(0).toUpperCase() + customSubdomain.slice(1)} Workspace`,
                subdomain: customSubdomain.trim(),
                databaseType: 'shared',
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

            if (newTenant) {
                await loadTenants();
                setShowCreateForm(false);
                setCustomSubdomain('');

                // Navigate to the new tenant
                const newUrl = buildTenantUrl(newTenant.subdomain);
                window.location.href = newUrl;
            }
        } catch (error) {
            console.error('Error creating tenant:', error);
        } finally {
            setIsCreating(false);
        }
    };

    if (loading) {
        return (
            <Card className={className}>
                <CardContent className="p-4">
                    <div className="text-sm text-gray-500">Loading tenant...</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="text-sm">Tenant: {tenant?.name || 'Unknown'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Current Tenant Info */}
                <div className="text-xs text-gray-600">
                    <div>Subdomain: {tenant?.subdomain}</div>
                    <div>Database: {tenant?.databaseType}</div>
                </div>

                {/* Tenant Selector */}
                <div className="space-y-2">
                    <Label htmlFor="tenant-select" className="text-xs">Switch Tenant</Label>
                    <Select onValueChange={handleTenantChange} value={tenant?.id}>
                        <SelectTrigger id="tenant-select">
                            <SelectValue placeholder="Select tenant" />
                        </SelectTrigger>
                        <SelectContent>
                            {tenants.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                    {t.name} ({t.subdomain})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Custom Subdomain */}
                <div className="space-y-2">
                    <Label htmlFor="custom-subdomain" className="text-xs">Custom Subdomain</Label>
                    <div className="flex gap-2">
                        <Input
                            id="custom-subdomain"
                            value={customSubdomain}
                            onChange={(e) => setCustomSubdomain(e.target.value)}
                            placeholder="Enter subdomain"
                            className="text-xs"
                        />
                        <Button
                            onClick={handleCustomSubdomain}
                            size="sm"
                            disabled={!customSubdomain.trim()}
                        >
                            Go
                        </Button>
                    </div>
                </div>

                {/* Create New Tenant */}
                <div className="space-y-2">
                    {!showCreateForm ? (
                        <Button
                            onClick={() => setShowCreateForm(true)}
                            size="sm"
                            variant="outline"
                            className="w-full"
                        >
                            Create New Tenant
                        </Button>
                    ) : (
                        <form onSubmit={handleCreateTenant} className="space-y-2">
                            <Input
                                value={customSubdomain}
                                onChange={(e) => setCustomSubdomain(e.target.value)}
                                placeholder="New subdomain"
                                className="text-xs"
                                required
                            />
                            <div className="flex gap-2">
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={isCreating || !customSubdomain.trim()}
                                    className="flex-1"
                                >
                                    {isCreating ? 'Creating...' : 'Create'}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setShowCreateForm(false);
                                        setCustomSubdomain('');
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

