import React from 'react';
import { Button } from '../../components/ui/button.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { 
  Brain, 
  Vote, 
  MessageSquare, 
  Lock, 
  ChevronRight, 
  RotateCcw,
  CheckCircle 
} from 'lucide-react';
import { type RetroStage } from '../../hooks/useRetroBoard.ts';
import { cn } from '../../lib/utils.ts';
import { RetroStageStepper } from './RetroStageStepper';
import { UserReadinessPanel } from './UserReadinessPanel';

interface StageControlsProps {
  currentStage: RetroStage;
  onStageChange: (stage: RetroStage) => void;
  boardId: string;
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
  boardId,
  isAdmin = false
}) => {
  const stageInfo = STAGE_INFO[currentStage];

  const handleStageAdvance = () => {
    if (stageInfo.nextStage) {
      onStageChange(stageInfo.nextStage);
    }
  };

  const handleResetToThinking = () => {
    onStageChange('thinking');
  };

  return (
    <div className="space-y-4">
      {/* Stage Progress Stepper */}
      <RetroStageStepper currentStage={currentStage} className="mb-6" />

      {/* Main Controls Layout */}
      <div className={cn(
        "grid gap-4",
        isAdmin ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
      )}>
        {/* User Readiness Panel - Show for all users */}
        <UserReadinessPanel 
          boardId={boardId}
          currentStage={currentStage}
          compact={!isAdmin}
          showUserList={isAdmin}
        />

        {/* Admin Controls */}
        {isAdmin && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className={stageInfo.color}>
                Current: {stageInfo.label}
              </Badge>
              {currentStage === 'closed' && (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
            </div>
            
            <div className="space-y-2">
              {currentStage !== 'thinking' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetToThinking}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset to Thinking
                </Button>
              )}
              
              {stageInfo.nextStage && (
                <Button
                  onClick={handleStageAdvance}
                  className="w-full flex items-center justify-center gap-2"
                  size="sm"
                >
                  {stageInfo.nextLabel}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {stageInfo.description}
            </p>
          </div>
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