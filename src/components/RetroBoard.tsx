import React, { useState, useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useRetroBoard } from '@/hooks/useRetroBoard';
import { useAuth } from '@/hooks/useAuth';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useEndorsements } from '@/hooks/useEndorsements';
import { useEndorsementTypes } from '@/hooks/useEndorsementTypes';
import { EnvironmentIndicator } from './EnvironmentIndicator';
import { BoardHeader } from './retro/BoardHeader';
import { RetroColumn } from './retro/RetroColumn';
import { PreviousActionItemsColumn } from './retro/PreviousActionItemsColumn';
import { FocusedCardBanner } from './retro/FocusedCardBanner';
import { EndorsementPanel } from './retro/EndorsementPanel';
import { EndorsementCelebration } from './retro/EndorsementCelebration';
import { AppHeader } from './AppHeader';

interface RetroBoardProps {
  boardId: string;
  isPrivate: boolean;
  onTogglePrivacy: () => void;
  anonymousName?: string;
  isAnonymousUser?: boolean;
}

export const RetroBoard: React.FC<RetroBoardProps> = ({
  boardId,
  isPrivate,
  onTogglePrivacy,
  anonymousName = 'Anonymous',
  isAnonymousUser = false
}) => {
  const { user, profile, signOut } = useAuth();
  const { playAudioUrl } = useAudioPlayer();
  const {
    board,
    columns,
    items,
    comments,
    boardConfig,
    activeUsers,
    loading,
    addItem,
    addColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
    upvoteItem,
    updateItem,
    deleteItem,
    updateBoardTitle,
    updateBoardConfig,
    updateRetroStage,
    updatePresence,
    broadcastReadinessChange,
    addComment,
    deleteComment,
    getCommentsForItem,
    sessionId,
    presenceChannel,
    userVotes,
    teamActionItems,
    boardActionStatus,
    audioSummaryState,
    updateAudioSummaryState,
    audioUrlToPlay,
    clearAudioUrlToPlay,
    focusedItemId,
    focusItem,
    markTeamActionItemDone,
    toggleBoardActionItemDone,
    assignTeamActionItem,
    assignBoardActionItem,
  } = useRetroBoard(boardId);

  // Get team members for @ mentions
  const { members: teamMembers } = useTeamMembers(board?.team_id || null);

  // Endorsements
  const { types: endorsementTypes, settings: endorsementSettings } = useEndorsementTypes(board?.team_id || null);
  const {
    endorsements,
    giveEndorsement,
    revokeEndorsement,
    pendingCelebration,
    clearCelebration,
    getMyEndorsementCount,
  } = useEndorsements(board?.id || null, board?.team_id || null);

  const memberNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    teamMembers.forEach((m: any) => {
      map[m.user_id] = m.profiles?.full_name || m.profiles?.nickname || 'Unknown';
    });
    return map;
  }, [teamMembers]);

  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [userName, setUserName] = useState(() => {
    if (isAnonymousUser) return anonymousName;
    return profile?.full_name || user?.email || 'Anonymous';
  });
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [adminEditMode, setAdminEditMode] = useState(false);
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (audioUrlToPlay) {
      playAudioUrl(audioUrlToPlay).then(() => {
        clearAudioUrlToPlay();
      });
    }
  }, [audioUrlToPlay, playAudioUrl, clearAudioUrlToPlay]);

  // Check if board is archived (read-only)
  const isArchived = board?.archived || false;

  // Update user name when profile changes (but not for anonymous users)
  useEffect(() => {
    if (!isAnonymousUser) {
      if (profile?.full_name) {
        setUserName(profile.full_name);
      } else if (user?.email) {
        setUserName(user.email);
      }
    }
  }, [profile, user, isAnonymousUser]);

  // Debounced presence update - only update when user stops typing
  const debouncedUpdatePresence = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (name: string, avatarUrl?: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (name.trim() && board) {
          updatePresence(name, avatarUrl);
        }
      }, 1000); // 1 second delay after user stops typing
    };
  }, [updatePresence, board]);

  // Update presence when user name changes (debounced)
  useEffect(() => {
    if (userName && board) {
      debouncedUpdatePresence(userName, profile?.avatar_url);
    }
  }, [userName, board, debouncedUpdatePresence, profile?.avatar_url]);

  const handleAddItem = (columnId: string) => (text: string, isAnonymousCheckbox: boolean) => {
    if (isArchived) return;

    const isEffectivelyAnonymous = isAnonymousUser || isAnonymousCheckbox;

    // Use guest name if anonymous, otherwise use logged-in name.
    // If a logged-in user posts anonymously, the author name is 'Anonymous'.
    const authorName = isAnonymousUser ? userName : (isAnonymousCheckbox ? 'Anonymous' : userName);

    addItem(text, columnId, authorName, isEffectivelyAnonymous);
  };

  const handleAddComment = (itemId: string, text: string, author: string) => {
    if (isArchived) return;
    addComment(itemId, text, author, isAnonymousUser);
  }

  const handleAddColumn = () => {
    if (!newColumnTitle.trim() || isAnonymousUser || isArchived) return;

    addColumn(newColumnTitle);
    setNewColumnTitle('');
  };

  const startEdit = (itemId: string, currentText: string) => {
    if (isArchived) return; // Prevent editing in archived boards
    setEditingItem(itemId);
    setEditText(currentText);
  };

  const saveEdit = () => {
    if (!editText.trim() || !editingItem || isArchived) return;

    updateItem(editingItem, editText);
    setEditingItem(null);
    setEditText('');
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditText('');
  };

  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    if (isAnonymousUser || isArchived) return;
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    if (isAnonymousUser || isArchived) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    if (isAnonymousUser || isArchived) return;
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    if (isAnonymousUser || isArchived) return;
    e.preventDefault();

    if (!draggedColumn || draggedColumn === targetColumnId) {
      setDraggedColumn(null);
      setDragOverColumn(null);
      return;
    }

    const draggedIndex = columns.findIndex(col => col.id === draggedColumn);
    const targetIndex = columns.findIndex(col => col.id === targetColumnId);

    const newColumns = [...columns];
    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, removed);

    reorderColumns(newColumns);
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const getItemsForColumn = (columnId: string) => {
    return items.filter(item => item.column_id === columnId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading retro board...</div>
      </div>
    );
  }

  return (
    <div className="">
      {/* Archived board notice */}
      {isArchived && (
        <div className="mb-4 p-4 bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-300 dark:border-yellow-700 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
            <span className="font-medium">📁 This board is archived</span>
            <span className="text-sm">- It's now read-only and cannot be edited</span>
          </div>
        </div>
      )}
      <div className='p-6 pt-0'>
        <BoardHeader
          board={board}
          profile={profile}
          user={user}
          activeUsers={activeUsers}
          boardConfig={boardConfig}
          anonymousName={anonymousName}
          isAnonymousUser={isAnonymousUser}
          items={items}
          columns={columns}
          teamMembers={teamMembers}
          onUpdateBoardTitle={isArchived ? undefined : updateBoardTitle}
          onUpdateBoardConfig={isArchived ? undefined : updateBoardConfig}
          onUpdateItem={(isArchived && profile?.role !== 'admin') ? () => {} : updateItem}
          onSignOut={signOut}
          updateRetroStage={isArchived ? undefined : updateRetroStage}
          broadcastReadinessChange={isArchived ? undefined : broadcastReadinessChange}
        />

        {/* User Name Display */}
        <div className="mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {isAnonymousUser
              ? `You are participating as a guest. Your contributions will be anonymous.`
              : `You are signed in as ${userName}.`}
          </span>
        </div>

        {/* Focused Card Banner */}
        {focusedItemId && (() => {
          const focusedItem = items.find(i => i.id === focusedItemId);
          const focusedColumn = focusedItem ? columns.find(c => c.id === focusedItem.column_id) : null;
          if (!focusedItem || !focusedColumn) return null;
          const columnItems = items.filter(i => i.column_id === focusedColumn.id);
          const currentIndex = columnItems.findIndex(i => i.id === focusedItem.id);
          return (
            <FocusedCardBanner
              itemId={focusedItem.id}
              itemText={focusedItem.text}
              itemAuthor={focusedItem.author}
              columnTitle={focusedColumn.title}
              columnColor={focusedColumn.color}
              voteCount={focusedItem.votes}
              voteEmoji={boardConfig?.vote_emoji}
              comments={getCommentsForItem(focusedItem.id)}
              userName={userName}
              currentUserId={user?.id}
              showAuthor={boardConfig?.show_author_names}
              sessionId={sessionId}
              isAnonymousUser={isAnonymousUser}
              isArchived={isArchived}
              teamMembers={teamMembers}
              hasPrev={currentIndex > 0}
              hasNext={currentIndex < columnItems.length - 1}
              onPrev={() => currentIndex > 0 && focusItem(columnItems[currentIndex - 1].id)}
              onNext={() => currentIndex < columnItems.length - 1 && focusItem(columnItems[currentIndex + 1].id)}
              onDismiss={() => focusItem(null)}
              onAddComment={isArchived ? undefined : handleAddComment}
              onDeleteComment={isArchived ? undefined : deleteComment}
            />
          );
        })()}

        {/* Endorsement Celebration */}
        <EndorsementCelebration
          pendingCelebration={pendingCelebration}
          endorsementTypes={endorsementTypes}
          memberNames={memberNameMap}
          onClear={clearCelebration}
        />


        {/* Columns */}
        <div className="overflow-x-auto pb-6">
          <div className="flex gap-6 min-w-max">
            {teamActionItems.length > 0 && (
              <PreviousActionItemsColumn
                items={teamActionItems.map(a => ({ id: a.id, text: a.text, assigned_to: a.assigned_to, source_item_id: a.source_item_id || null }))}
                onMarkDone={isArchived ? undefined : markTeamActionItemDone}
                onAssign={isArchived ? undefined : assignTeamActionItem}
                teamMembers={teamMembers}
                teamId={board?.team_id || null}
                isArchived={isArchived}
              />
            )}
            {columns.map(column => (
              <RetroColumn
                key={column.id}
                board={board}
                column={column}
                items={getItemsForColumn(column.id)}
                boardConfig={boardConfig}
                user={user}
                userName={userName}
                isAnonymousUser={isAnonymousUser}
                comments={comments}
                draggedColumn={draggedColumn}
                dragOverColumn={dragOverColumn}
                editingItem={editingItem}
                editText={editText}
                isArchived={isArchived}
                sessionId={sessionId}
                userVotes={userVotes}
                audioSummaryState={audioSummaryState}
                updateAudioSummaryState={updateAudioSummaryState}
                teamMembers={teamMembers}
                onAssignActionItem={isArchived ? undefined : assignBoardActionItem}
                onAddItem={handleAddItem(column.id)}
                onUpdateColumn={isArchived ? undefined : updateColumn}
                onDeleteColumn={isArchived ? undefined : deleteColumn}
                onUpvoteItem={isArchived ? undefined : upvoteItem}
                onUpdateItem={isArchived ? undefined : updateItem}
                onDeleteItem={isArchived ? undefined : deleteItem}
                onStartEdit={startEdit}
                onSaveEdit={saveEdit}
                onCancelEdit={cancelEdit}
                onSetEditText={setEditText}
                onAddComment={isArchived ? undefined : handleAddComment}
                onDeleteComment={isArchived ? undefined : deleteComment}
                onGetCommentsForItem={getCommentsForItem}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                presenceChannel={presenceChannel}
                actionStatusMap={boardActionStatus}
                onToggleActionItemDone={isArchived ? undefined : toggleBoardActionItemDone}
                focusedItemId={focusedItemId}
                onFocusItem={isArchived ? undefined : focusItem}
              />
            ))}

            {/* Add Column Card - Only show for authenticated users and non-archived boards */}
            {!isAnonymousUser && !isArchived && (
              <div className="w-80 flex-shrink-0">
                <Dialog>
                  <DialogTrigger asChild>
                    <Card className="bg-white/50 dark:bg-gray-800/50 border-dashed border-2 hover:bg-white/70 dark:hover:bg-gray-800/70 cursor-pointer transition-colors h-20">
                      <CardContent className="p-4 flex items-center justify-center h-full">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                          <Plus className="h-4 w-4" />
                          <span className="text-sm">Add another list</span>
                        </div>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Column</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input
                        placeholder="Column title"
                        value={newColumnTitle}
                        onChange={(e) => setNewColumnTitle(e.target.value)}
                      />
                      <Button onClick={handleAddColumn} className="w-full">
                        Add Column
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Endorsement Panel - floating drawer, only for team boards with authenticated users */}
      {board?.team_id && !isAnonymousUser && (
        <EndorsementPanel
          endorsements={endorsements}
          endorsementTypes={endorsementTypes}
          settings={endorsementSettings}
          members={teamMembers}
          currentUserId={user?.id}
          myEndorsementCount={getMyEndorsementCount()}
          onGiveEndorsement={giveEndorsement}
          onRevokeEndorsement={revokeEndorsement}
          isArchived={isArchived}
        />
      )}
    </div>
  );
};
