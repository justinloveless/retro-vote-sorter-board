import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FeatureFlagManager } from '@/components/admin/FeatureFlagManager';
import { TtsUrlManager } from '@/components/admin/TtsUrlManager';
import { GithubIssueSettings } from '@/components/admin/GithubIssueSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { BackfillActionItems } from '@/components/admin/BackfillActionItems';

const AdminPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="container mx-auto px-4 pb-8 pt-16 md:pt-0">
            <div className="flex items-center gap-4 mb-8">
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
                    <p className="text-gray-600 dark:text-gray-300 mt-2">Manage global application settings.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <TtsUrlManager />
                    <GithubIssueSettings />
                    <Card>
                        <CardHeader>
                            <CardTitle>Data Backfill</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <BackfillActionItems />
                        </CardContent>
                    </Card>
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
                <div className="lg:col-span-1">
                    {/* Additional admin panels can be placed here in the future. */}
                </div>
            </div>
        </div>
    );
};

export default AdminPage; 