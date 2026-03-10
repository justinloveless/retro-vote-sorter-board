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

// Map column color class strings to focused banner tailwind classes
const focusedColorMap: { [key: string]: { container: string; badge: string; border: string; icon: string } } = {
  'bg-green-100 border-green-300': {
    container: 'border-green-400 bg-green-100 dark:border-green-500 dark:bg-green-900/30',
    badge: 'text-green-700 bg-green-200/60 dark:text-green-300 dark:bg-green-800/50',
    border: 'border-green-300/50 dark:border-green-600/50',
    icon: 'text-green-600 dark:text-green-400',
  },
  'bg-red-100 border-red-300': {
    container: 'border-red-400 bg-red-100 dark:border-red-500 dark:bg-red-900/30',
    badge: 'text-red-700 bg-red-200/60 dark:text-red-300 dark:bg-red-800/50',
    border: 'border-red-300/50 dark:border-red-600/50',
    icon: 'text-red-600 dark:text-red-400',
  },
  'bg-blue-100 border-blue-300': {
    container: 'border-blue-400 bg-blue-100 dark:border-blue-500 dark:bg-blue-900/30',
    badge: 'text-blue-700 bg-blue-200/60 dark:text-blue-300 dark:bg-blue-800/50',
    border: 'border-blue-300/50 dark:border-blue-600/50',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  'bg-yellow-100 border-yellow-300': {
    container: 'border-yellow-400 bg-yellow-100 dark:border-yellow-500 dark:bg-yellow-900/30',
    badge: 'text-yellow-700 bg-yellow-200/60 dark:text-yellow-300 dark:bg-yellow-800/50',
    border: 'border-yellow-300/50 dark:border-yellow-600/50',
    icon: 'text-yellow-600 dark:text-yellow-400',
  },
  'bg-purple-100 border-purple-300': {
    container: 'border-purple-400 bg-purple-100 dark:border-purple-500 dark:bg-purple-900/30',
    badge: 'text-purple-700 bg-purple-200/60 dark:text-purple-300 dark:bg-purple-800/50',
    border: 'border-purple-300/50 dark:border-purple-600/50',
    icon: 'text-purple-600 dark:text-purple-400',
  },
  'bg-pink-100 border-pink-300': {
    container: 'border-pink-400 bg-pink-100 dark:border-pink-500 dark:bg-pink-900/30',
    badge: 'text-pink-700 bg-pink-200/60 dark:text-pink-300 dark:bg-pink-800/50',
    border: 'border-pink-300/50 dark:border-pink-600/50',
    icon: 'text-pink-600 dark:text-pink-400',
  },
  'bg-indigo-100 border-indigo-300': {
    container: 'border-indigo-400 bg-indigo-100 dark:border-indigo-500 dark:bg-indigo-900/30',
    badge: 'text-indigo-700 bg-indigo-200/60 dark:text-indigo-300 dark:bg-indigo-800/50',
    border: 'border-indigo-300/50 dark:border-indigo-600/50',
    icon: 'text-indigo-600 dark:text-indigo-400',
  },
  'bg-orange-100 border-orange-300': {
    container: 'border-orange-400 bg-orange-100 dark:border-orange-500 dark:bg-orange-900/30',
    badge: 'text-orange-700 bg-orange-200/60 dark:text-orange-300 dark:bg-orange-800/50',
    border: 'border-orange-300/50 dark:border-orange-600/50',
    icon: 'text-orange-600 dark:text-orange-400',
  },
};

const defaultColors = {
  container: 'border-gray-400 bg-gray-50 dark:border-gray-500 dark:bg-gray-900/30',
  badge: 'text-gray-700 bg-gray-200/60 dark:text-gray-300 dark:bg-gray-800/50',
  border: 'border-gray-300/50 dark:border-gray-600/50',
  icon: 'text-gray-600 dark:text-gray-400',
};

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
  const colors = focusedColorMap[columnColor] || defaultColors;

  return (
    <div className="mb-4 flex justify-center animate-in fade-in slide-in-from-top-2 duration-300">
      <div className={`w-full max-w-2xl p-4 rounded-lg border-2 backdrop-blur-sm shadow-lg ${colors.container}`}>
        <div className="flex items-start justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrev}
            disabled={!hasPrev}
            className={`h-8 w-8 flex-shrink-0 mt-0.5 ${colors.icon}`}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Crosshair className={`h-4 w-4 flex-shrink-0 ${colors.icon}`} />
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${colors.badge}`}>
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
              <div className={`mt-3 border-t pt-3 ${colors.border}`}>
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
              className={`h-8 w-8 ${colors.icon}`}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDismiss}
              className={`h-7 w-7 ${colors.icon}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
