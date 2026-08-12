import React from 'react';
import { BackendProviderToggle } from '@/components/admin/BackendProviderToggle';

const AdminBackendPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Control which backend the SPA targets during the self-host migration. Only admins can open
        this page.
      </p>
      <BackendProviderToggle />
    </div>
  );
};

export default AdminBackendPage;
