import React from 'react';
import { X, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FocusedCardBannerProps {
  itemText: string;
  itemAuthor: string;
  columnTitle: string;
  voteCount: number;
  voteEmoji?: string | null;
  onDismiss: () => void;
}

export const FocusedCardBanner: React.FC<FocusedCardBannerProps> = ({
  itemText,
  itemAuthor,
  columnTitle,
  voteCount,
  voteEmoji,
  onDismiss,
}) => {
  return (
    <div className="mb-4 p-4 rounded-lg border-2 border-amber-400 dark:border-amber-500 bg-amber-50/90 dark:bg-amber-900/30 backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Crosshair className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-200/60 dark:bg-amber-800/50 px-2 py-0.5 rounded">
                {columnTitle}
              </span>
              <span className="text-xs text-amber-600 dark:text-amber-400">
                by {itemAuthor}
              </span>
              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                {voteEmoji || '👍'} {voteCount}
              </span>
            </div>
            <div
              className="text-sm text-gray-800 dark:text-gray-200 prose dark:prose-invert max-w-none line-clamp-3"
              dangerouslySetInnerHTML={{ __html: itemText }}
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="h-7 w-7 flex-shrink-0 text-amber-600 dark:text-amber-400 hover:bg-amber-200/50 dark:hover:bg-amber-800/50"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
