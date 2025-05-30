
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, FolderOpen } from 'lucide-react';

interface TeamSidebarProps {
  team: {
    id: string;
    name: string;
    created_at: string;
  };
  boardCount: number;
  memberCount?: number;
}

export const TeamSidebar: React.FC<TeamSidebarProps> = ({ team, boardCount, memberCount }) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <div className="font-medium">{boardCount}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Active Boards</div>
            </div>
          </div>
          
          {memberCount !== undefined && (
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <div className="font-medium">{memberCount}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Team Members</div>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <div>
              <div className="font-medium">
                {new Date(team.created_at).toLocaleDateString()}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Created</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
