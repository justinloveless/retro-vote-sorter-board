import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const ADMIN_SECTIONS = [
    {
        title: 'Subscriptions',
        description: 'Search users, manage plans, and create promos.',
        to: '/admin/subscriptions',
    },
    {
        title: 'Feature Flags',
        description: 'Manage global flags plus user/team overrides.',
        to: '/admin/feature-flags',
    },
    {
        title: 'Plan Tier Limits',
        description: 'Configure limits and feature access per tier.',
        to: '/admin/tier-limits',
    },
    {
        title: 'Notifications',
        description: 'Send messages and run backfill actions.',
        to: '/admin/notifications',
    },
    {
        title: 'Users & Teams',
        description: 'Admin user impersonation and team membership tools.',
        to: '/admin/users-teams',
    },
    {
        title: 'Integrations',
        description: 'Configure TTS and GitHub issue settings.',
        to: '/admin/integrations',
    },
];

const AdminPage: React.FC = () => {
    return (
        <div className="space-y-6">
            <p className="text-muted-foreground">
                Manage admin tools by section. Use the links below or the sub-navigation above.
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {ADMIN_SECTIONS.map((section) => (
                    <Card key={section.to}>
                        <CardHeader>
                            <CardTitle>{section.title}</CardTitle>
                            <CardDescription>{section.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild>
                                <Link to={section.to}>Open {section.title}</Link>
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Quick Access</CardTitle>
                    <CardDescription>Use direct links for repeated admin workflows.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    {ADMIN_SECTIONS.map((section) => (
                        <Button key={`quick-${section.to}`} variant="outline" asChild>
                            <Link to={section.to}>{section.title}</Link>
                        </Button>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminPage; 