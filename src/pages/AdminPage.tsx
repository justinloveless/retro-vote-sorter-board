import React from 'react';
import { FeatureFlagManager } from '@/components/admin/FeatureFlagManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AdminPage = () => {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Feature Flags</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                        Enable or disable features across the entire application.
                    </p>
                    <FeatureFlagManager />
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminPage; 