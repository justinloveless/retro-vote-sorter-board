import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Spade, Settings } from 'lucide-react';

interface TeamFloatingActionsProps {
  onCreateBoard: () => void;
  onJoinPointingSession: () => void;
  onSettings: () => void;
  currentUserRole?: string;
}

export const TeamFloatingActions: React.FC<TeamFloatingActionsProps> = ({
  onCreateBoard,
  onJoinPointingSession,
  onSettings,
  currentUserRole
}) => {
  const canManageSettings = currentUserRole === 'owner' || currentUserRole === 'admin';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 safe-area-pb">
      <div className="flex justify-center items-center gap-8 max-w-sm mx-auto">
        {/* Join Pointing Session - Left */}
        <Button
          variant="outline"
          onClick={onJoinPointingSession}
          className="rounded-full h-14 w-14 shadow-lg border-2 border-green-600 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:border-green-500 dark:hover:bg-green-950 dark:hover:text-green-300"
          size="icon"
        >
          <Spade className="h-6 w-6" />
        </Button>
        
        {/* New Board - Center (Main action) */}
        <Button
          onClick={onCreateBoard}
          className="rounded-full h-16 w-16 shadow-lg"
          size="icon"
        >
          <Plus className="h-7 w-7" />
        </Button>
        
        {/* Settings - Right */}
        {canManageSettings && (
          <Button
            variant="outline"
            onClick={onSettings}
            className="rounded-full h-14 w-14 shadow-lg"
            size="icon"
          >
            <Settings className="h-6 w-6" />
          </Button>
        )}
        
        {/* Placeholder if no settings access to keep layout balanced */}
        {!canManageSettings && (
          <div className="h-14 w-14" />
        )}
      </div>
    </div>
  );
};
