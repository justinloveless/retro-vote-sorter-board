import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FeatureFlagManager } from '@/components/admin/FeatureFlagManager';

const AdminFeatureFlagsPage: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Flags</CardTitle>
        <CardDescription>
          Manage global feature flags and user/team overrides.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FeatureFlagManager />
      </CardContent>
    </Card>
  );
};

export default AdminFeatureFlagsPage;
