import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings, Plus, Users } from 'lucide-react';

interface TeamHeaderProps {
  team: {
    id: string;
    name: string;
    description?: string;
  };
  onCreateBoard: () => void;
  onJoinPointingSession: () => void;
}

export const TeamHeader: React.FC<TeamHeaderProps> = ({ team, onCreateBoard, onJoinPointingSession }) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-4 mb-8">
      <Button variant="ghost" onClick={() => navigate('/teams')}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="flex-1">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{team.name}</h1>
        {team.description && (
          <p className="text-gray-600 dark:text-gray-300 mt-2">{team.description}</p>
        )}
      </div>
      <Button onClick={onCreateBoard}>
        <Plus className="h-4 w-4 mr-2" />
        New Board
      </Button>
      <Button variant='default' onClick={onJoinPointingSession}>
        <Users className="h-4 w-4 mr-2" />
        Join Pointing Session
      </Button>
      <Button
        variant="outline"
        onClick={() => navigate(`/teams/${team.id}/settings`)}
      >
        <Settings className="h-4 w-4 mr-2" />
        Settings
      </Button>
    </div>
  );
};
