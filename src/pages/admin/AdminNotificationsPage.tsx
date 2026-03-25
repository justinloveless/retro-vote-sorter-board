import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminSendNotification } from '@/components/admin/AdminSendNotification';
import { BackfillActionItems } from '@/components/admin/BackfillActionItems';

const AdminNotificationsPage: React.FC = () => {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <AdminSendNotification />
      <Card>
        <CardHeader>
          <CardTitle>Data Backfill</CardTitle>
        </CardHeader>
        <CardContent>
          <BackfillActionItems />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminNotificationsPage;
