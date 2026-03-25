import React from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppHeader } from '../AppHeader';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ADMIN_NAV_ITEMS = [
    { to: '/admin', label: 'Overview', end: true },
    { to: '/admin/subscriptions', label: 'Subscriptions' },
    { to: '/admin/feature-flags', label: 'Feature Flags' },
    { to: '/admin/tier-limits', label: 'Plan Tier Limits' },
    { to: '/admin/notifications', label: 'Notifications' },
    { to: '/admin/users-teams', label: 'Users & Teams' },
    { to: '/admin/integrations', label: 'Integrations' },
];

function activeAdminPath(pathname: string): string {
    let best: string | null = null;
    for (const item of ADMIN_NAV_ITEMS) {
        if (item.end) {
            if (pathname === item.to) return item.to;
            continue;
        }
        if (pathname === item.to || pathname.startsWith(`${item.to}/`)) {
            if (!best || item.to.length > best.length) best = item.to;
        }
    }
    return best ?? '/admin';
}

export const AdminLayout: React.FC = () => {
    const { user, profile, loading } = useAuth();
    const isMobile = useIsMobile();
    const location = useLocation();
    const navigate = useNavigate();

    if (loading) {
        return <div>Loading...</div>; // Or a spinner
    }

    if (!user || profile?.role !== 'admin') {
        return <Navigate to="/" />;
    }

    const activePath = activeAdminPath(location.pathname);

    return (
        <div className="min-h-screen">
            <AppHeader variant='back' />
            <main className="container mx-auto max-w-full min-w-0 px-3 pb-8 pt-16 sm:px-4 md:pt-0">
                <div className="mb-6 space-y-3">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Admin</h1>
                    {isMobile ? (
                        <Select
                            value={activePath}
                            onValueChange={(to) => navigate(to)}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Section" />
                            </SelectTrigger>
                            <SelectContent>
                                {ADMIN_NAV_ITEMS.map((item) => (
                                    <SelectItem key={item.to} value={item.to}>
                                        {item.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {ADMIN_NAV_ITEMS.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.end}
                                    className={({ isActive }) =>
                                        cn(
                                            'rounded-md border px-3 py-1.5 text-sm transition-colors',
                                            isActive
                                                ? 'border-primary bg-primary text-primary-foreground'
                                                : 'border-border hover:bg-muted'
                                        )
                                    }
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>
                    )}
                </div>
                <Outlet />
            </main>
        </div>
    );
}; 