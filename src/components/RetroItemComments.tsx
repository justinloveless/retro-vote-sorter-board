
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { TiptapEditorWithMentions, processMentionsForDisplay } from '@/components/shared/TiptapEditorWithMentions';
import { Dialog, DialogContent } from '@/components/ui/dialog';

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

interface TeamMember {
  id: string;
  user_id: string;
  profiles?: {
    full_name: string | null;
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
  teamMembers?: TeamMember[];
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
  teamMembers,
}) => {
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const uploadImage = async (file: File): Promise<string | null> => {
    // For now, convert to base64 for inline display
    // In a real implementation, you'd upload to Supabase storage
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    onAddComment(itemId, newComment, userName);
    setNewComment('');
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

  // Function to make images clickable in HTML content
  const makeImagesClickable = (htmlContent: string) => {
    return htmlContent.replace(
      /<img([^>]*?)src="([^"]*?)"([^>]*?)>/g,
      '<img$1src="$2"$3 style="cursor: pointer;" data-clickable-image="$2">'
    );
  };

  // Function to handle image clicks
  const handleImageClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'IMG' && target.hasAttribute('data-clickable-image')) {
      const imageSrc = target.getAttribute('data-clickable-image');
      if (imageSrc) {
        setSelectedImage(imageSrc);
      }
    }
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
                    <div
                      className="text-sm text-gray-700 dark:text-gray-300 prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: processMentionsForDisplay(makeImagesClickable(comment.text)) }}
                      onClick={handleImageClick}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="space-y-2">
            <TiptapEditorWithMentions
              content={newComment}
              onChange={setNewComment}
              onSubmit={handleAddComment}
              placeholder="Add a comment... (you can paste images)"
              uploadImage={uploadImage}
              teamMembers={teamMembers}
            />
            <Button
              size="sm"
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              Add Comment
            </Button>
          </div>
        </div>
      )}

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-2">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Full size view"
              className="w-full h-full object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
