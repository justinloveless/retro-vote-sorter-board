import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, Edit2, Trash2, ExternalLink, GripVertical } from 'lucide-react';
import { AddItemCard } from '../AddItemCard';
import { ColumnManager } from '../ColumnManager';
import { RetroItemComments } from '../RetroItemComments';
import { UserAvatar } from '../ui/UserAvatar';
import useFeatureFlags from '@/hooks/useFeatureFlags';
import { PlayAudioButton } from './PlayAudioButton';
import { ColumnSummary } from './ColumnSummary';
import { AudioSummaryState } from '@/hooks/useRetroBoard';
import { SummaryButton } from './SummaryButton';

interface RetroItem {
  id: string;
  author: string;
  author_id?: string;
  text: string;
  votes: number;
  session_id?: string;
  profiles?: {
    avatar_url: string;
    full_name: string;
  } | null;
}

interface RetroColumnProps {
  column: any;
  items: RetroItem[];
  boardConfig: any;
  user: any;
  userName: string;
  isAnonymousUser: boolean;
  comments: any[];
  draggedColumn: string | null;
  dragOverColumn: string | null;
  editingItem: string | null;
  editText: string;
  isArchived: boolean;
  sessionId?: string | null;
  userVotes: string[];
  onAddItem: (text: string, isAnonymous: boolean) => void;
  onUpdateColumn: (columnId: string, updates: any) => void;
  onDeleteColumn: (columnId: string) => void;
  onUpvoteItem: (itemId: string) => void;
  onUpdateItem: (itemId: string, text: string) => void;
  onDeleteItem: (itemId: string) => void;
  onStartEdit: (itemId: string, currentText: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onSetEditText: (text: string) => void;
  onAddComment: (itemId: string, text: string, author: string) => void;
  onDeleteComment: (commentId: string) => void;
  onGetCommentsForItem: (itemId: string) => any[];
  onDragStart: (e: React.DragEvent, columnId: string) => void;
  onDragOver: (e: React.DragEvent, columnId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, columnId: string) => void;
  onDragEnd: () => void;
  presenceChannel?: any;
  audioSummaryState: AudioSummaryState | null;
  updateAudioSummaryState: (state: AudioSummaryState | null) => void;
}

export const RetroColumn: React.FC<RetroColumnProps> = ({
  column,
  items,
  boardConfig,
  user,
  userName,
  isAnonymousUser,
  comments,
  draggedColumn,
  dragOverColumn,
  editingItem,
  editText,
  isArchived,
  sessionId,
  userVotes,
  onAddItem,
  onUpdateColumn,
  onDeleteColumn,
  onUpvoteItem,
  onUpdateItem,
  onDeleteItem,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onSetEditText,
  onAddComment,
  onDeleteComment,
  onGetCommentsForItem,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  presenceChannel,
  audioSummaryState,
  updateAudioSummaryState,
}) => {
  const { isFeatureEnabled } = useFeatureFlags();

  const sortedItems = [...items].sort((a, b) => b.votes - a.votes);

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

  // Function to get dark mode compatible color classes
  const getColorClasses = (color: string) => {
    // Map light mode colors to both light and dark mode classes
    const colorMap: { [key: string]: string } = {
      'bg-green-100 border-green-300': 'bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-600',
      'bg-red-100 border-red-300': 'bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-600',
      'bg-blue-100 border-blue-300': 'bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-600',
      'bg-yellow-100 border-yellow-300': 'bg-yellow-100 border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-600',
      'bg-purple-100 border-purple-300': 'bg-purple-100 border-purple-300 dark:bg-purple-900/30 dark:border-purple-600',
      'bg-pink-100 border-pink-300': 'bg-pink-100 border-pink-300 dark:bg-pink-900/30 dark:border-pink-600',
      'bg-indigo-100 border-indigo-300': 'bg-indigo-100 border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-600',
      'bg-orange-100 border-orange-300': 'bg-orange-100 border-orange-300 dark:bg-orange-900/30 dark:border-orange-600'
    };

    return colorMap[color] || `${color} dark:bg-gray-800 dark:border-gray-600`;
  };

  return (
    <div
      className={`w-80 flex-shrink-0 transition-all duration-200 ${dragOverColumn === column.id ? 'scale-105' : ''
        } ${draggedColumn === column.id ? 'opacity-50' : ''
        }`}
      draggable={!isAnonymousUser}
      onDragStart={(e) => onDragStart(e, column.id)}
      onDragOver={(e) => onDragOver(e, column.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, column.id)}
      onDragEnd={onDragEnd}
    >
      <div className={`p-4 rounded-lg border-2 ${getColorClasses(column.color)} space-y-4 ${dragOverColumn === column.id ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900' : ''
        }`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{column.title}</h2>
          <div className="flex items-center gap-1">
            {isFeatureEnabled('text_to_speech_enabled') && !isAnonymousUser && (
              // <SummaryButton items={items} columnTitle={column.title} />
              <ColumnSummary
                key={`${column.id}-${audioSummaryState?.status}`}
                items={items}
                columnId={column.id}
                columnTitle={column.title}
                presenceChannel={presenceChannel}
                audioSummaryState={audioSummaryState}
                updateAudioSummaryState={updateAudioSummaryState}
              />
            )}
            {!isAnonymousUser && (
              <>
                <ColumnManager
                  column={column}
                  onUpdateColumn={onUpdateColumn}
                  onDeleteColumn={onDeleteColumn}
                />
                <GripVertical className="h-5 w-5 text-gray-400 cursor-grab active:cursor-grabbing" />
              </>
            )}
          </div>
        </div>

        <div className="space-y-3 min-h-[200px]">
          {sortedItems.map(item => (
            <Card key={item.id} className="bg-white/90 dark:bg-gray-700/90 backdrop-blur-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                {editingItem === item.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editText}
                      onChange={(e) => onSetEditText(e.target.value)}
                      className="resize-none"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={onSaveEdit}>Save</Button>
                      <Button size="sm" variant="outline" onClick={onCancelEdit}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-800 dark:text-gray-200 mb-3">{item.text}</p>

                    <div className="flex items-end justify-between">
                      <div className="flex items-center gap-2">
                        {boardConfig?.show_author_names && (
                          <UserAvatar
                            userId={item.author_id}
                            name={item.profiles?.full_name ?? item.author}
                            avatarUrl={item.profiles?.avatar_url}
                            className="h-6 w-6"
                          />
                        )}
                        {boardConfig?.voting_enabled && (
                          <Badge variant={item.votes > 0 ? "default" : "outline"} className="flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3" />
                            {item.votes}
                          </Badge>
                        )}
                      </div>

                      {/* Row 2: Buttons */}
                      <div className="flex justify-end gap-1">
                        {boardConfig?.voting_enabled && (
                          <Button
                            size="sm"
                            variant={userVotes.includes(item.id) ? "default" : "outline"}
                            onClick={() => onUpvoteItem(item.id)}
                            className="h-8 w-8 p-0"
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </Button>
                        )}
                        {isFeatureEnabled('text_to_speech_enabled') && !isAnonymousUser && <PlayAudioButton itemText={item.text} />}
                        {!isArchived &&
                          ((user?.id && item.author_id === user.id) ||
                            (isAnonymousUser && item.session_id && item.session_id === sessionId)) && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onStartEdit(item.id, item.text)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onDeleteItem(item.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
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
                      </div>
                    </div>

                    <RetroItemComments
                      itemId={item.id}
                      comments={onGetCommentsForItem(item.id)}
                      onAddComment={onAddComment}
                      onDeleteComment={onDeleteComment}
                      userName={userName}
                      currentUserId={user?.id}
                      showAuthor={boardConfig.show_author_names}
                      sessionId={sessionId}
                      isAnonymousUser={isAnonymousUser}
                      isArchived={isArchived}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          ))}

          <AddItemCard
            onAddItem={onAddItem}
            allowAnonymous={boardConfig.allow_anonymous && !isAnonymousUser}
          />
        </div>
      </div>
    </div>
  );
};
