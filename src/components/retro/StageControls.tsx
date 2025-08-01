import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  Vote, 
  MessageSquare, 
  Lock, 
  ChevronRight, 
  RotateCcw,
  CheckCircle 
} from 'lucide-react';
import { RetroStage } from '@/hooks/useRetroBoard';
import { cn } from '@/lib/utils';

interface StageControlsProps {
  currentStage: RetroStage;
  onStageChange: (stage: RetroStage) => void;
  isAdmin?: boolean;
}

const STAGE_INFO = {
  thinking: {
    icon: Brain,
    label: 'Thinking',
    description: 'Add ideas and thoughts',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    nextStage: 'voting' as RetroStage,
    nextLabel: 'Start Voting'
  },
  voting: {
    icon: Vote,
    label: 'Voting',
    description: 'Vote on items',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    nextStage: 'discussing' as RetroStage,
    nextLabel: 'Start Discussion'
  },
  discussing: {
    icon: MessageSquare,
    label: 'Discussing',
    description: 'Discuss and create action items',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    nextStage: 'closed' as RetroStage,
    nextLabel: 'Close Retro'
  },
  closed: {
    icon: Lock,
    label: 'Closed',
    description: 'Retro is complete',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    nextStage: null,
    nextLabel: null
  }
};

export const StageControls: React.FC<StageControlsProps> = ({
  currentStage,
  onStageChange,
  isAdmin = false
}) => {
  const stageInfo = STAGE_INFO[currentStage];
  const Icon = stageInfo.icon;

  const handleStageAdvance = () => {
    if (stageInfo.nextStage) {
      onStageChange(stageInfo.nextStage);
    }
  };

  const handleResetToThinking = () => {
    onStageChange('thinking');
  };

  if (!isAdmin) {
    // Non-admin view: just show current stage
    return (
      <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border">
        <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        <div>
          <Badge variant="secondary" className={stageInfo.color}>
            {stageInfo.label}
          </Badge>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {stageInfo.description}
          </p>
        </div>
      </div>
    );
  }

  // Admin view: show stage controls
  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border gap-6">
      <div className="flex items-center gap-3">
        <Icon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={stageInfo.color}>
              {stageInfo.label}
            </Badge>
            {currentStage === 'closed' && (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {stageInfo.description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {currentStage !== 'thinking' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetToThinking}
            className="flex items-center gap-1"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Thinking
          </Button>
        )}
        
        {stageInfo.nextStage && (
          <Button
            onClick={handleStageAdvance}
            className="flex items-center gap-1"
          >
            {stageInfo.nextLabel}
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

// Helper component to show stage progress
export const StageProgress: React.FC<{ currentStage: RetroStage }> = ({ currentStage }) => {
  const stages: RetroStage[] = ['thinking', 'voting', 'discussing', 'closed'];
  const currentIndex = stages.indexOf(currentStage);

  return (
    <div className="flex items-center gap-2">
      {stages.map((stage, index) => {
        const stageInfo = STAGE_INFO[stage];
        const Icon = stageInfo.icon;
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;

        return (
          <div
            key={stage}
            className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors",
              isActive && stageInfo.color,
              isCompleted && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
              !isActive && !isCompleted && "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            )}
          >
            <Icon className="h-3 w-3" />
            {stageInfo.label}
            {isCompleted && <CheckCircle className="h-3 w-3" />}
          </div>
        );
      })}
    </div>
  );
};