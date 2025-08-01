import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit, LogOut, Moon, Sun, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { ActiveUsers } from '../ActiveUsers';
import { BoardConfig } from '../BoardConfig';
import { SentimentDisplay } from './SentimentDisplay';
import { RetroTimer } from './RetroTimer';
import { StageControls } from './StageControls';

interface BoardHeaderProps {
  board: any;
  profile: any;
  user: any;
  activeUsers: any[];
  boardConfig: any;
  anonymousName: string;
  isAnonymousUser: boolean;
  items: any[];
  onUpdateBoardTitle: (title: string) => void;
  onUpdateBoardConfig: (config: any) => void;
  onSignOut: () => void;
  updateRetroStage?: (stage: 'thinking' | 'voting' | 'discussing' | 'closed') => void;
}

export const BoardHeader: React.FC<BoardHeaderProps> = ({
  board,
  profile,
  user,
  activeUsers,
  boardConfig,
  anonymousName,
  isAnonymousUser,
  items,
  onUpdateBoardTitle,
  onUpdateBoardConfig,
  onSignOut,
  updateRetroStage
}) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState(board?.title || 'RetroScope Session');

  const handleTitleEdit = () => {
    if (!titleText.trim() || isAnonymousUser) return;
    onUpdateBoardTitle(titleText);
    setEditingTitle(false);
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          {editingTitle && !isAnonymousUser ? (
            <div className="flex items-center gap-2">
              <Input
                value={titleText}
                onChange={(e) => setTitleText(e.target.value)}
                className="text-3xl font-bold border-none bg-transparent text-gray-900 dark:text-gray-100 p-0"
                onBlur={handleTitleEdit}
                onKeyPress={(e) => e.key === 'Enter' && handleTitleEdit()}
                autoFocus
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{board?.title || 'RetroScope Session'}</h1>
              {!isAnonymousUser && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingTitle(true)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          <p className="text-gray-600 dark:text-gray-400">Board ID: {board?.room_id}</p>
          {isAnonymousUser && (
            <p className="text-sm text-orange-600 dark:text-orange-400">
              You're viewing as: {anonymousName} (Guest)
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <RetroTimer />

          <SentimentDisplay items={items} />

          <ActiveUsers users={activeUsers} />

          {!isAnonymousUser && (
            <BoardConfig config={boardConfig} onUpdateConfig={onUpdateBoardConfig} />
          )}
        </div>
      </div>

      {/* Stage Controls - dedicated row */}
      {boardConfig?.retro_stages_enabled && board && updateRetroStage && (
        <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700 flex justify-center">
          <div className="max-w-4xl">
            <StageControls
            currentStage={board.retro_stage || 'thinking'}
            onStageChange={updateRetroStage}
              isAdmin={!isAnonymousUser}
            />
          </div>
        </div>
      )}
    </div>
  );
};
