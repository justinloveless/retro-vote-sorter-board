import React from 'react';
import { TtsUrlManager } from '@/components/admin/TtsUrlManager';
import { GithubIssueSettings } from '@/components/admin/GithubIssueSettings';

const AdminIntegrationsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <TtsUrlManager />
      <GithubIssueSettings />
    </div>
  );
};

export default AdminIntegrationsPage;
