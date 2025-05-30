
import React, { useState, useEffect } from 'react';
import { Plus, ThumbsUp, Edit2, Trash2, GripVertical, Edit, LogOut, ExternalLink, Moon, Sun, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useRetroBoard } from '@/hooks/useRetroBoard';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { AddItemCard } from './AddItemCard';
import { ActiveUsers } from './ActiveUsers';
import { EnvironmentIndicator } from './EnvironmentIndicator';
import { RetroItemComments } from './RetroItemComments';
import { BoardConfig } from './BoardConfig';
import { ColumnManager } from './ColumnManager';

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
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
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
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState('');
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

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

  // Update title text when board changes
  useEffect(() => {
    if (board?.title) {
      setTitleText(board.title);
    }
  }, [board]);

  // Update presence when user name changes
  useEffect(() => {
    if (userName && board) {
      updatePresence(userName);
    }
  }, [userName, board, updatePresence]);

  // Function to check if a column is an "Action Items" column
  const isActionItemsColumn = (columnTitle: string) => {
    return columnTitle.toLowerCase().includes('action') && columnTitle.toLowerCase().includes('item');
  };

  // Function to generate JIRA ticket creation URL
  const generateJiraUrl = (ticketTitle: string) => {
    const jiraDomain = 'outsystemsrd.atlassian.net';
    const encodedTitle = encodeURIComponent(ticketTitle);
    return `https://${jiraDomain}/secure/CreateIssueDetails!init.jspa?pid=19602&priority=10000&issuetype=10001&summary=${encodedTitle}&description=${encodedTitle}`;
  };

  const handleAddItem = (columnId: string) => (text: string, isAnonymous: boolean) => {
    const authorName = isAnonymous ? 'Anonymous' : userName;
    addItem(text, columnId, authorName);
  };

  const handleAddColumn = () => {
    if (!newColumnTitle.trim() || isAnonymousUser) return;
    
    addColumn(newColumnTitle);
    setNewColumnTitle('');
  };

  const startEdit = (itemId: string, currentText: string) => {
    setEditingItem(itemId);
    setEditText(currentText);
  };

  const saveEdit = () => {
    if (!editText.trim() || !editingItem) return;
    
    updateItem(editingItem, editText);
    setEditingItem(null);
    setEditText('');
  };

  const handleTitleEdit = () => {
    if (!titleText.trim() || isAnonymousUser) return;
    updateBoardTitle(titleText);
    setEditingTitle(false);
  };

  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    if (isAnonymousUser) return;
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    if (isAnonymousUser) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    if (isAnonymousUser) return;
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    if (isAnonymousUser) return;
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading retro board...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <EnvironmentIndicator />
      
      {/* Header */}
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
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{board?.title || 'Team Retrospective'}</h1>
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
            <p className="text-gray-600 dark:text-gray-400">Board ID: {boardId}</p>
            {isAnonymousUser && (
              <p className="text-sm text-orange-600 dark:text-orange-400">
                You're viewing as: {anonymousName} (Guest)
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <ActiveUsers users={activeUsers} />
            
            {!isAnonymousUser && (
              <BoardConfig config={boardConfig} onUpdateConfig={updateBoardConfig} />
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="flex items-center gap-2"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Home
            </Button>
            
            {!isAnonymousUser && (
              <Button 
                variant="outline"
                onClick={signOut}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            )}
          </div>
        </div>

        {/* User Name Input */}
        <div className="flex items-center gap-4 mb-4">
          <Input
            placeholder="Your display name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-48"
            disabled={isAnonymousUser}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {isAnonymousUser 
              ? 'Guest user (sign in for full features)' 
              : `Signed in as ${profile?.full_name || user?.email}`
            }
          </span>
        </div>
      </div>

      {/* Columns */}
      <div className="overflow-x-auto pb-6">
        <div className="flex gap-6 min-w-max">
          {columns.map(column => (
            <div 
              key={column.id} 
              className={`w-80 flex-shrink-0 transition-all duration-200 ${
                dragOverColumn === column.id ? 'scale-105' : ''
              } ${
                draggedColumn === column.id ? 'opacity-50' : ''
              }`}
              draggable={!isAnonymousUser}
              onDragStart={(e) => handleDragStart(e, column.id)}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
              onDragEnd={handleDragEnd}
            >
              <div className={`p-4 rounded-lg border-2 ${column.color} dark:bg-gray-800 dark:border-gray-600 space-y-4 ${
                dragOverColumn === column.id ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900' : ''
              }`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{column.title}</h2>
                  <div className="flex items-center gap-1">
                    {!isAnonymousUser && (
                      <>
                        <ColumnManager 
                          column={column}
                          onUpdateColumn={updateColumn}
                          onDeleteColumn={deleteColumn}
                        />
                        <GripVertical className="h-5 w-5 text-gray-400 cursor-grab active:cursor-grabbing" />
                      </>
                    )}
                  </div>
                </div>
                
                <div className="space-y-3 min-h-[200px]">
                  {getItemsForColumn(column.id).map(item => (
                    <Card key={item.id} className="bg-white/90 dark:bg-gray-700/90 backdrop-blur-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        {editingItem === item.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="resize-none"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveEdit}>Save</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-gray-800 dark:text-gray-200 mb-3">{item.text}</p>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {boardConfig?.show_author_names && (
                                  <Badge variant="secondary" className="text-xs">
                                    {item.author}
                                  </Badge>
                                )}
                                {boardConfig?.voting_enabled && (
                                  <Badge variant={item.votes > 0 ? "default" : "outline"} className="flex items-center gap-1">
                                    <ThumbsUp className="h-3 w-3" />
                                    {item.votes}
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex gap-1">
                                {boardConfig?.voting_enabled && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => upvoteItem(item.id)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <ThumbsUp className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => startEdit(item.id, item.text)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                {isActionItemsColumn(column.title) && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => window.open(generateJiraUrl(item.text), '_blank')}
                                    className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                                    title="Create JIRA ticket"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => deleteItem(item.id)}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            <RetroItemComments
                              itemId={item.id}
                              comments={getCommentsForItem(item.id)}
                              onAddComment={addComment}
                              onDeleteComment={deleteComment}
                              userName={userName}
                              currentUserId={user?.id}
                            />
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  
                  <AddItemCard onAddItem={handleAddItem(column.id)} />
                </div>
              </div>
            </div>
          ))}
          
          {/* Add Column Card - Only show for authenticated users */}
          {!isAnonymousUser && (
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
