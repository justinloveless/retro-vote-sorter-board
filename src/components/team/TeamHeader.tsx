import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings, Plus, Users, Spade } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface TeamHeaderProps {
  team: {
    id: string;
    name: string;
    description?: string;
  };
  onCreateBoard: () => void;
  onJoinPointingSession: () => void;
  currentUserRole?: string;
}

export const TeamHeader: React.FC<TeamHeaderProps> = ({ team, onCreateBoard, onJoinPointingSession, currentUserRole }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-4 mb-8">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/teams')} className="mt-1 flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white break-words">{team.name}</h1>
            {team.description && (
              <p className="text-gray-600 dark:text-gray-300 mt-1 break-words">{team.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3">
            <Button onClick={onCreateBoard} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              New Board
            </Button>
            <Button
              variant='outline'
              onClick={onJoinPointingSession}
              className="w-full border-2 border-green-600 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:border-green-500 dark:hover:bg-green-950 dark:hover:text-green-300"
            >
              <Spade className="h-4 w-4 mr-2" />
              Join Pointing Session
            </Button>
          </div>
          
          {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
            <Button
              variant="outline"
              onClick={() => navigate(`/teams/${team.id}/settings`)}
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Desktop layout (unchanged)
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
      <Button
        variant='outline'
        onClick={onJoinPointingSession}
        className="border-2 border-green-600 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:border-green-500 dark:hover:bg-green-950 dark:hover:text-green-300"
      >
        <Spade className="h-4 w-4 mr-2" />
        Join Pointing Session
      </Button>
      {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
        <Button
          variant="outline"
          onClick={() => navigate(`/teams/${team.id}/settings`)}
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      )}
    </div>
  );
};
