
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Clock, Play } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface HistoryNavigationProps {
  currentRoundNumber: number;
  totalRounds: number;
  isViewingHistory: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onGoToCurrent: () => void;
}

const HistoryNavigation: React.FC<HistoryNavigationProps> = ({
  currentRoundNumber,
  totalRounds,
  isViewingHistory,
  canGoBack,
  canGoForward,
  onPrevious,
  onNext,
  onGoToCurrent,
}) => {
  const isMobile = useIsMobile();

  if (totalRounds <= 1) return null;

  if (isMobile) {
    return (
      <div className="bg-white/10 backdrop-blur rounded-xl p-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrevious}
          disabled={!canGoBack}
          className="text-white hover:bg-white/20 disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-2 text-white">
          {isViewingHistory && <Clock className="h-4 w-4" />}
          <span className="text-sm font-medium">
            Round {currentRoundNumber} of {totalRounds}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onNext}
            disabled={!canGoForward}
            className="text-white hover:bg-white/20 disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          {isViewingHistory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onGoToCurrent}
              className="text-white hover:bg-white/20"
              title="Go to current round"
            >
              <Play className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card/25 border border-primary/20 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={!canGoBack}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        
        <div className="flex items-center gap-2">
          {isViewingHistory && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Viewing History</span>
            </div>
          )}
          <span className="font-medium">
            Round {currentRoundNumber} of {totalRounds}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onNext}
            disabled={!canGoForward}
            className="flex items-center gap-2"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          {isViewingHistory && (
            <Button
              variant="default"
              size="sm"
              onClick={onGoToCurrent}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Current
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryNavigation;
