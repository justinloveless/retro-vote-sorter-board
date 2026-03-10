import React from 'react';
import { X, Crosshair, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { processMentionsForDisplay } from '../shared/TiptapEditorWithMentions';
import { RetroItemComments } from '../RetroItemComments';

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

interface FocusedCardBannerProps {
  itemId: string;
  itemText: string;
  itemAuthor: string;
  columnTitle: string;
  columnColor: string;
  voteCount: number;
  voteEmoji?: string | null;
  comments: RetroComment[];
  userName: string;
  currentUserId?: string;
  showAuthor?: boolean;
  sessionId?: string | null;
  isAnonymousUser?: boolean;
  isArchived?: boolean;
  teamMembers?: TeamMember[];
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onDismiss: () => void;
  onAddComment?: (itemId: string, text: string, author: string) => void;
  onDeleteComment?: (commentId: string) => void;
}

export const FocusedCardBanner: React.FC<FocusedCardBannerProps> = ({
  itemId,
  itemText,
  itemAuthor,
  columnTitle,
  columnColor,
  voteCount,
  voteEmoji,
  comments,
  userName,
  currentUserId,
  showAuthor,
  sessionId,
  isAnonymousUser,
  isArchived,
  teamMembers,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onDismiss,
  onAddComment,
  onDeleteComment,
}) => {
  return (
    <div className="mb-4 flex justify-center animate-in fade-in slide-in-from-top-2 duration-300">
      <div
        className="w-full max-w-2xl p-4 rounded-lg border-2 backdrop-blur-sm shadow-lg"
        style={{
          borderColor: columnColor,
          backgroundColor: `${columnColor}18`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrev}
            disabled={!hasPrev}
            className="h-8 w-8 flex-shrink-0 mt-0.5"
            style={{ color: columnColor }}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Crosshair className="h-4 w-4 flex-shrink-0" style={{ color: columnColor }} />
              <span
                className="text-xs font-medium px-2 py-0.5 rounded"
                style={{ color: columnColor, backgroundColor: `${columnColor}30` }}
              >
                {columnTitle}
              </span>
              <span className="text-xs text-muted-foreground">
                by {itemAuthor}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {voteEmoji || '👍'} {voteCount}
              </span>
            </div>
            <div
              className="text-sm text-foreground prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: processMentionsForDisplay(itemText) }}
            />
            {/* Comments section */}
            {onAddComment && onDeleteComment && (
              <div
                className="mt-3 border-t pt-3"
                style={{ borderColor: `${columnColor}40` }}
              >
                <RetroItemComments
                  itemId={itemId}
                  comments={comments}
                  onAddComment={onAddComment}
                  onDeleteComment={onDeleteComment}
                  userName={userName}
                  currentUserId={currentUserId}
                  showAuthor={showAuthor}
                  sessionId={sessionId}
                  isAnonymousUser={isAnonymousUser}
                  isArchived={isArchived}
                  teamMembers={teamMembers}
                />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onNext}
              disabled={!hasNext}
              className="h-8 w-8"
              style={{ color: columnColor }}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDismiss}
              className="h-7 w-7"
              style={{ color: columnColor }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
