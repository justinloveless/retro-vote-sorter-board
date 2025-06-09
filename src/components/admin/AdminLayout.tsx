import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppHeader } from '../AppHeader';

export const AdminLayout: React.FC = () => {
    const { user, profile, loading } = useAuth();

    if (loading) {
        return <div>Loading...</div>; // Or a spinner
    }

    if (!user || profile?.role !== 'admin') {
        return <Navigate to="/" />;
    }

    return (
        <div>
            <AppHeader variant='back' />
            <main className="p-4">
                <Outlet />
            </main>
        </div>
    );
}; 