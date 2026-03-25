import React from 'react';
import { ImpersonateUser } from '@/components/admin/ImpersonateUser';
import { AdminManageTeamMembers } from '@/components/admin/AdminManageTeamMembers';

const AdminUsersTeamsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <ImpersonateUser />
      <AdminManageTeamMembers />
    </div>
  );
};

export default AdminUsersTeamsPage;
