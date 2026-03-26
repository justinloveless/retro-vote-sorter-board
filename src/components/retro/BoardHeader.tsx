import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit, LogOut, Moon, Sun, Home, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { ActiveUsers } from '../ActiveUsers';
import { BoardConfig } from '../BoardConfig';
import { SentimentDisplay } from './SentimentDisplay';
import { RetroTimer } from './RetroTimer';
import { CompactStageControls } from './CompactStageControls';
import { MentionScanner } from './MentionScanner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useFeatureFlags } from '@/contexts/FeatureFlagContext';

interface BoardHeaderProps {
  board: any;
  profile: any;
  user: any;
  activeUsers: any[];
  boardConfig: any;
  anonymousName: string;
  isAnonymousUser: boolean;
  items: any[];
  columns: any[];
  teamMembers: any[];
  onUpdateBoardTitle: (title: string) => void;
  onUpdateBoardConfig: (config: any) => void;
  onUpdateItem: (itemId: string, text: string) => void;
  onSignOut: () => void;
  updateRetroStage?: (stage: 'thinking' | 'voting' | 'discussing' | 'closed') => void;
  broadcastReadinessChange?: (readinessData: {
    boardId: string;
    stage: string;
    userId: string;
    sessionId?: string;
    isReady: boolean;
    userName?: string;
  }) => Promise<void>;
  adminEditMode?: boolean;
  onToggleAdminEditMode?: () => void;
  presenceChannel?: any;
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
  columns,
  teamMembers,
  onUpdateBoardTitle,
  onUpdateBoardConfig,
  onUpdateItem,
  onSignOut,
  updateRetroStage,
  broadcastReadinessChange,
  adminEditMode,
  onToggleAdminEditMode,
  presenceChannel,
}) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { isFeatureEnabled } = useFeatureFlags();
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
          <RetroTimer
            presenceChannel={presenceChannel}
            boardConfig={boardConfig}
            onPersistTimerState={onUpdateBoardConfig}
          />

          <SentimentDisplay items={items} />

          <ActiveUsers users={activeUsers} />

          {!isAnonymousUser && (
            <div className="flex items-center gap-2">
              <BoardConfig config={boardConfig} onUpdateConfig={onUpdateBoardConfig} />
              {isFeatureEnabled('admin_mention_scanner') && profile?.role === 'admin' && teamMembers.length > 0 && (
                <MentionScanner
                  items={items}
                  columns={columns}
                  teamMembers={teamMembers}
                  onUpdateItem={onUpdateItem}
                />
              )}
              {isFeatureEnabled('admin_edit_all') && onToggleAdminEditMode && (
                <div className="flex items-center gap-1.5 ml-1">
                  <Switch
                    id="admin-edit-mode"
                    checked={adminEditMode}
                    onCheckedChange={onToggleAdminEditMode}
                  />
                  <Label htmlFor="admin-edit-mode" className="text-xs cursor-pointer flex items-center gap-1">
                    <Edit className="h-3 w-3" />
                    Edit All
                  </Label>
                </div>
              )}
              {/* Notify Team bell opens the existing dialog in RetroRoom via custom event */}
              <Button variant="outline" size="sm" onClick={() => window.dispatchEvent(new CustomEvent('open-notify-team'))} title="Notify Team">
                <Bell className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stage Controls - compact row */}
      {boardConfig?.retro_stages_enabled && board && updateRetroStage && (
        <div className="mb-4">
          <CompactStageControls
            currentStage={board.retro_stage || 'thinking'}
            onStageChange={updateRetroStage}
            boardId={board.id}
            activeUsers={activeUsers}
            boardConfig={boardConfig}
            isAdmin={!isAnonymousUser}
            broadcastReadinessChange={broadcastReadinessChange}
          />
        </div>
      )}
    </div>
  );
};
