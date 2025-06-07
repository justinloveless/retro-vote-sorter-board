import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

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
            <header className="bg-gray-800 text-white p-4">
                <h1 className="text-xl">Admin Dashboard</h1>
            </header>
            <main className="p-4">
                <Outlet />
            </main>
        </div>
    );
}; 