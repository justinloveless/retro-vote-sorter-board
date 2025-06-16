
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Plus, Eye, EyeOff, Lock, Archive } from 'lucide-react';
import { BoardActions } from './BoardActions';
import { useIsMobile } from '@/hooks/use-mobile';

interface TeamBoard {
  id: string;
  room_id: string;
  title: string;
  is_private: boolean;
  password_hash: string | null;
  archived: boolean;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
}

interface TeamBoardsListProps {
  boards: TeamBoard[];
  loading: boolean;
  currentUserRole?: string;
  onCreateBoard: () => void;
  onBoardUpdated: () => void;
}

export const TeamBoardsList: React.FC<TeamBoardsListProps> = ({
  boards,
  loading,
  currentUserRole,
  onCreateBoard,
  onBoardUpdated
}) => {
  const navigate = useNavigate();
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [showArchived, setShowArchived] = useState(false);
  const isMobile = useIsMobile();

  const canManageBoards = currentUserRole === 'admin' || currentUserRole === 'owner';

  const togglePasswordVisibility = (boardId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [boardId]: !prev[boardId]
    }));
  };

  const activeBoards = boards.filter(board => !board.archived);
  const archivedBoards = boards.filter(board => board.archived);
  const displayBoards = showArchived ? archivedBoards : activeBoards;

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600 dark:text-gray-300">Loading boards...</div>
      </div>
    );
  }

  if (boards.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Calendar className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No retro boards yet</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">Create your first retro board for this team.</p>
          <Button onClick={onCreateBoard}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Board
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Archive toggle */}
      <div className={`flex items-center justify-between ${isMobile ? 'flex-col gap-3' : ''}`}>
        <h3 className="text-lg font-semibold">
          {showArchived ? 'Archived Boards' : 'Active Boards'}
        </h3>
        <div className={`flex gap-2 ${isMobile ? 'w-full' : ''}`}>
          <Button
            variant={showArchived ? "outline" : "default"}
            size="sm"
            onClick={() => setShowArchived(false)}
            className={isMobile ? 'flex-1' : ''}
          >
            Active ({activeBoards.length})
          </Button>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(true)}
            className={isMobile ? 'flex-1' : ''}
          >
            <Archive className="h-4 w-4 mr-1" />
            Archived ({archivedBoards.length})
          </Button>
        </div>
      </div>

      <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
        {displayBoards.map((board) => (
          <Card key={board.id} className={`hover:shadow-lg transition-shadow ${board.archived ? 'opacity-90' : ''}`}>
            <CardHeader className={isMobile ? 'pb-3' : ''}>
              <CardTitle className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold truncate">{board.title}</span>
                  {board.archived && (
                    <Archive className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {board.is_private && (
                    <div className="flex items-center gap-1">
                      <span className={`text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded ${isMobile ? 'text-[10px]' : ''}`}>
                        Private
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePasswordVisibility(board.id)}
                        className="h-6 w-6 p-0"
                      >
                        {showPasswords[board.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                    </div>
                  )}
                  <BoardActions
                    boardId={board.id}
                    boardTitle={board.title}
                    isArchived={board.archived}
                    canManageBoard={canManageBoards}
                    onBoardUpdated={onBoardUpdated}
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className={isMobile ? 'pt-0' : ''}>
              <div className={`flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4 ${isMobile ? 'text-xs' : ''}`}>
                <Calendar className="h-4 w-4 mr-1" />
                {new Date(board.created_at).toLocaleDateString()}
                {board.archived && board.archived_at && (
                  <span className="ml-2 text-xs">
                    (Archived {new Date(board.archived_at).toLocaleDateString()})
                  </span>
                )}
              </div>
              {board.is_private && board.password_hash && (
                <div className={`mb-4 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm ${isMobile ? 'text-xs' : ''}`}>
                  <div className="flex items-center gap-2">
                    <Lock className="h-3 w-3" />
                    <span className="font-medium">Password:</span>
                    <span className="font-mono">
                      {showPasswords[board.id] ? board.password_hash : '••••••'}
                    </span>
                  </div>
                </div>
              )}
              <Button
                onClick={() => navigate(`/retro/${board.room_id}`)}
                className={`w-full ${isMobile ? 'h-12 text-base' : ''}`}
              >
                {board.archived ? 'View (Read-only)' : 'Open Board'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
