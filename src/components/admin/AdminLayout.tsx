import React from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppHeader } from '../AppHeader';
import { cn } from '@/lib/utils';

const ADMIN_NAV_ITEMS = [
    { to: '/admin', label: 'Overview', end: true },
    { to: '/admin/subscriptions', label: 'Subscriptions' },
    { to: '/admin/feature-flags', label: 'Feature Flags' },
    { to: '/admin/tier-limits', label: 'Plan Tier Limits' },
    { to: '/admin/notifications', label: 'Notifications' },
    { to: '/admin/users-teams', label: 'Users & Teams' },
    { to: '/admin/integrations', label: 'Integrations' },
];

export const AdminLayout: React.FC = () => {
    const { user, profile, loading } = useAuth();

    if (loading) {
        return <div>Loading...</div>; // Or a spinner
    }

    if (!user || profile?.role !== 'admin') {
        return <Navigate to="/" />;
    }

    return (
        <div className="min-h-screen">
            <AppHeader variant='back' />
            <main className="container mx-auto px-4 pb-8 pt-16 md:pt-0">
                <div className="mb-6 space-y-3">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin</h1>
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
                </div>
                <Outlet />
            </main>
        </div>
    );
}; 