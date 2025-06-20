import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface RetroComment {
  id: string;
  item_id: string;
  author: string;
  author_id?: string;
  text: string;
  created_at: string;
  session_id?: string;
  profiles?: {
    avatar_url: string;
    full_name: string;
  } | null;
}

interface RetroItemCommentsProps {
  itemId: string;
  comments: RetroComment[];
  onAddComment: (itemId: string, text: string, author: string) => void;
  onDeleteComment: (commentId: string) => void;
  userName: string;
  currentUserId?: string;
  showAuthor?: boolean;
  sessionId?: string | null;
  isAnonymousUser?: boolean;
  isArchived?: boolean;
}

export const RetroItemComments: React.FC<RetroItemCommentsProps> = ({
  itemId,
  comments,
  onAddComment,
  onDeleteComment,
  userName,
  currentUserId,
  showAuthor,
  sessionId,
  isAnonymousUser,
  isArchived,
}) => {
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    onAddComment(itemId, newComment, userName);
    setNewComment('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  const canDeleteComment = (comment: RetroComment) => {
    if (isArchived) return false;
    // User is logged in and is the author
    if (currentUserId && comment.author_id === currentUserId) {
      return true;
    }
    // User is anonymous and is the author
    if (isAnonymousUser && comment.session_id && comment.session_id === sessionId) {
      return true;
    }
    return false;
  };

  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowComments(!showComments)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <MessageSquare className="h-4 w-4" />
        {comments.length > 0 ? `${comments.length} comments` : 'Add comment'}
      </Button>

      {showComments && (
        <div className="mt-2 space-y-2">
          {comments.map((comment) => (
            <Card key={comment.id} className="bg-gray-50 dark:bg-gray-800">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  {showAuthor && (
                    <UserAvatar
                      userId={comment.author_id}
                      name={comment.profiles?.full_name ?? comment.author}
                      avatarUrl={comment.profiles?.avatar_url}
                      className="h-6 w-6"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-end">
                      {canDeleteComment(comment) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteComment(comment.id)}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{comment.text}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex gap-2">
            <Input
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={handleKeyPress}
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={handleAddComment}
              disabled={!newComment.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
