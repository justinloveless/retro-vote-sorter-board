
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Spade, Settings, X } from 'lucide-react';

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
  const [isOpen, setIsOpen] = useState(false);

  const canManageSettings = currentUserRole === 'owner' || currentUserRole === 'admin';

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Action buttons */}
      {isOpen && (
        <div className="flex flex-col gap-3 mb-4">
          <Button
            onClick={() => {
              onCreateBoard();
              setIsOpen(false);
            }}
            className="rounded-full h-12 w-12 shadow-lg"
            size="icon"
          >
            <Plus className="h-5 w-5" />
          </Button>
          
          <Button
            variant="outline"
            onClick={() => {
              onJoinPointingSession();
              setIsOpen(false);
            }}
            className="rounded-full h-12 w-12 shadow-lg border-2 border-green-600 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:border-green-500 dark:hover:bg-green-950 dark:hover:text-green-300"
            size="icon"
          >
            <Spade className="h-5 w-5" />
          </Button>
          
          {canManageSettings && (
            <Button
              variant="outline"
              onClick={() => {
                onSettings();
                setIsOpen(false);
              }}
              className="rounded-full h-12 w-12 shadow-lg"
              size="icon"
            >
              <Settings className="h-5 w-5" />
            </Button>
          )}
        </div>
      )}

      {/* Main FAB button */}
      <Button
        onClick={toggleMenu}
        className="rounded-full h-14 w-14 shadow-lg"
        size="icon"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Plus className="h-6 w-6" />
        )}
      </Button>
    </div>
  );
};
