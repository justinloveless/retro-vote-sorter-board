
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

interface TeamSidebarProps {
  team: {
    created_at: string;
  };
  boardCount: number;
}

export const TeamSidebar: React.FC<TeamSidebarProps> = ({ team, boardCount }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Info
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Created:</span>
            <br />
            {new Date(team.created_at).toLocaleDateString()}
          </div>
          <div>
            <span className="font-medium">Boards:</span>
            <br />
            {boardCount} retro board{boardCount !== 1 ? 's' : ''}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
