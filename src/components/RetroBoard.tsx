import React, { useState, useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useRetroBoard } from '@/hooks/useRetroBoard';
import { useAuth } from '@/hooks/useAuth';
import { EnvironmentIndicator } from './EnvironmentIndicator';
import { BoardHeader } from './retro/BoardHeader';
import { RetroColumn } from './retro/RetroColumn';

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
    updatePresence,
    addComment,
    deleteComment,
    getCommentsForItem
  } = useRetroBoard(boardId);

  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [userName, setUserName] = useState(() => {
    if (isAnonymousUser) return anonymousName;
    return profile?.full_name || user?.email || 'Anonymous';
  });
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

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
    return (name: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (name.trim() && board) {
          updatePresence(name);
        }
      }, 1000); // 1 second delay after user stops typing
    };
  }, [updatePresence, board]);

  // Update presence when user name changes (debounced)
  useEffect(() => {
    if (userName && board) {
      debouncedUpdatePresence(userName);
    }
  }, [userName, board, debouncedUpdatePresence]);

  const handleAddItem = (columnId: string) => (text: string, isAnonymous: boolean) => {
    if (isArchived) return; // Prevent adding items to archived boards
    const authorName = isAnonymous ? 'Anonymous' : userName;
    addItem(text, columnId, authorName);
  };

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
    <div className="min-h-screen p-6">
      <EnvironmentIndicator />

      {/* Archived board notice */}
      {isArchived && (
        <div className="mb-4 p-4 bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-300 dark:border-yellow-700 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
            <span className="font-medium">📁 This board is archived</span>
            <span className="text-sm">- It's now read-only and cannot be edited</span>
          </div>
        </div>
      )}

      <BoardHeader
        board={board}
        profile={profile}
        user={user}
        activeUsers={activeUsers}
        boardConfig={boardConfig}
        anonymousName={anonymousName}
        isAnonymousUser={isAnonymousUser}
        items={items}
        onUpdateBoardTitle={isArchived ? undefined : updateBoardTitle}
        onUpdateBoardConfig={isArchived ? undefined : updateBoardConfig}
        onSignOut={signOut}
      />

      {/* User Name Input */}
      <div className="flex items-center gap-4 mb-4">
        <Input
          placeholder="Your display name"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          className="w-48"
          disabled={isAnonymousUser || isArchived}
        />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {isAnonymousUser
            ? 'Guest user (sign in for full features)'
            : `Signed in as ${profile?.full_name || user?.email}`
          }
        </span>
      </div>

      {/* Columns */}
      <div className="overflow-x-auto pb-6">
        <div className="flex gap-6 min-w-max">
          {columns.map(column => (
            <RetroColumn
              key={column.id}
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
              onAddComment={isArchived ? undefined : addComment}
              onDeleteComment={isArchived ? undefined : deleteComment}
              onGetCommentsForItem={getCommentsForItem}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
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
  );
};
