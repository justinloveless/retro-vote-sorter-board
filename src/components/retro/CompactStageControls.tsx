import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Brain, 
  Vote, 
  MessageSquare, 
  Lock, 
  ChevronRight, 
  RotateCcw,
  CheckCircle,
  Clock,
  Users,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RetroStage } from '@/hooks/useRetroBoard';
import { useUserReadiness } from '@/hooks/useUserReadiness';
import { ReadinessTooltip } from './ReadinessTooltip';

interface CompactStageControlsProps {
  currentStage: RetroStage;
  onStageChange: (stage: RetroStage) => void;
  boardId: string;
  activeUsers: Array<{
    id?: string;
    user_id?: string;
    user_name: string;
    avatar_url?: string;
    last_seen: string;
  }>;
  boardConfig?: any;
  isAdmin?: boolean;
  broadcastReadinessChange?: (readinessData: {
    boardId: string;
    stage: string;
    userId: string;  // Now always present (auth user ID or session ID)
    sessionId?: string;  // Kept for backward compatibility but not used
    isReady: boolean;
    userName?: string;
  }) => Promise<void>;
}

const STAGE_INFO = {
  thinking: { icon: Brain, label: 'Thinking', nextStage: 'voting' as RetroStage, nextLabel: 'Start Voting', description: 'This is the first stage of the retrospective. It is used to gather ideas and thoughts from the team.' },
  voting: { icon: Vote, label: 'Voting', nextStage: 'discussing' as RetroStage, nextLabel: 'Start Discussion', description: 'This is the second stage of the retrospective. It is used to vote on the best ideas and thoughts from the team.' },
  discussing: { icon: MessageSquare, label: 'Discussing', nextStage: 'closed' as RetroStage, nextLabel: 'Close Retro', description: 'This is the third stage of the retrospective. It is used to discuss the best ideas and thoughts from the team. You can also add action items here.' },
  closed: { icon: Lock, label: 'Closed', nextStage: null, nextLabel: null, description: null }
};

export const CompactStageControls: React.FC<CompactStageControlsProps> = ({
  currentStage,
  onStageChange,
  boardId,
  activeUsers,
  boardConfig,
  isAdmin = false,
  broadcastReadinessChange
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isCurrentUserReady, readinessSummary, readyUsers, toggleReadiness, loading } = useUserReadiness(boardId, currentStage, activeUsers, broadcastReadinessChange);
  
  const stageInfo = STAGE_INFO[currentStage];
  const stages: RetroStage[] = ['thinking', 'voting', 'discussing', 'closed'];
  const currentIndex = stages.indexOf(currentStage);
  const { ready_users, total_users, all_ready, ready_percentage } = readinessSummary;

  // Check if stage readiness enforcement is enabled
  const enforceStageReadiness = boardConfig?.enforce_stage_readiness || false;

  const handleStageAdvance = () => {
    if (stageInfo.nextStage) {
      onStageChange(stageInfo.nextStage);
    }
  };

  const handleStageClick = (targetStage: RetroStage) => {
    if (!isAdmin) return; // Only admins can change stages
    
    // If enforcement is enabled, stepper is purely visual - no navigation allowed
    if (enforceStageReadiness) {
      console.log('⚠️ Stage navigation disabled - enforcement is enabled');
      return;
    }
    
    onStageChange(targetStage);
  };

  if (currentStage === 'closed' && !isAdmin) {
    // Non-admin view for closed retro
    return (
      <div className="flex items-center justify-center py-2">
        <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
          <Lock className="h-3 w-3 mr-1" />
          Retrospective Complete
        </Badge>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border rounded-lg p-3 space-y-3">
      {/* Compact Progress Stepper */}
      <div className="flex items-center justify-center gap-1">
        {stages.map((stage, index) => {
          const StageIcon = STAGE_INFO[stage].icon;
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const isUpcoming = index > currentIndex;
          
          // Determine if stage is clickable based on admin status and readiness enforcement
          let isClickable = isAdmin && !enforceStageReadiness; // Never clickable when enforcement is on
          let clickDisabledReason = '';
          
          if (isAdmin && enforceStageReadiness) {
            // When enforcement is enabled, stepper is purely visual
            clickDisabledReason = `Stage navigation disabled - use admin controls to advance when all users are ready`;
          }

          const getTooltipText = () => {
            if (!isAdmin) return '';
            if (clickDisabledReason) return clickDisabledReason;
            return `Click to go to ${STAGE_INFO[stage].label} stage`;
          };

          return (
            <div key={stage} className="contents">
              <div
                onClick={() => handleStageClick(stage)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all",
                  {
                    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200': isActive,
                    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200': isCompleted,
                    'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400': isUpcoming,
                  },
                  isClickable && "cursor-pointer hover:opacity-80 hover:scale-105 active:scale-95",
                  !isClickable && clickDisabledReason && "cursor-not-allowed opacity-50",
                  !isClickable && !clickDisabledReason && "cursor-default"
                )}
                title={getTooltipText()}
              >
                <StageIcon className="h-3 w-3" />
                <span className="hidden sm:inline">{STAGE_INFO[stage].label}</span>
                {isCompleted && <CheckCircle className="h-3 w-3" />}
              </div>
              {index < stages.length - 1 && (
                <div
                  className={cn(
                    "w-4 h-0.5 transition-colors",
                    {
                      'bg-green-500': index < currentIndex,
                      'bg-blue-500': index === currentIndex - 1,
                      'bg-gray-300 dark:bg-gray-600': index >= currentIndex,
                    }
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Compact Main Controls */}
      <div className="flex items-center justify-between gap-3">
        {/* Readiness Summary */}
        {currentStage !== 'closed' ? (
          <div className="flex items-center gap-3 flex-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-sm cursor-help">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{ready_users}/{total_users}</span>
                    {all_ready && total_users > 0 && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs p-3">
                  <ReadinessTooltip
                    activeUsers={activeUsers}
                    readyUsers={readyUsers}
                  />
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <div className="flex-1 max-w-24">
                                   <Progress 
                       value={ready_percentage} 
                       className="h-1.5"
                     />
            </div>

            <Button
              size="sm"
              variant={isCurrentUserReady ? "default" : "outline"}
              onClick={toggleReadiness}
              disabled={loading}
              className={cn(
                "text-xs px-2 py-1 h-7",
                isCurrentUserReady && "bg-green-600 hover:bg-green-700"
              )}
            >
              {isCurrentUserReady ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Ready
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3 mr-1" />
                  Mark Ready
                </>
              )}
            </Button>
          </div>
        ) : (
          // Closed stage - show completion message
          <div className="flex items-center gap-2 flex-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-600 font-medium">Retrospective completed successfully!</span>
          </div>
        )}

        {/* Admin Controls */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            {currentStage === 'closed' ? (
              // Closed stage - show reopen option
              <>
                <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Complete
                </Badge>
                <Button
                  onClick={() => onStageChange('discussing')}
                  size="sm"
                  variant="outline"
                  className="text-xs px-2 py-1 h-7"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reopen
                </Button>
              </>
            ) : (
              // Active stages - show normal controls
              <>
                {all_ready && total_users > 0 && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                    All Ready!
                  </Badge>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-7 w-7 p-0"
                >
                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
                
                {stageInfo.nextStage && (
                  <Button
                    onClick={handleStageAdvance}
                    size="sm"
                    className="text-xs px-2 py-1 h-7"
                    disabled={!all_ready && total_users > 0}
                  >
                    {stageInfo.nextLabel}
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Expandable Admin Details */}
      {isAdmin && isExpanded && (
        <div className="pt-2 border-t space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {STAGE_INFO[currentStage].label} Stage
            </span>
            {currentStage === 'closed' ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStageChange('discussing')}
                  className="text-xs h-6"
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Discussion
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStageChange('thinking')}
                  className="text-xs h-6"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Restart
                </Button>
              </div>
            ) : currentStage !== 'thinking' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStageChange('thinking')}
                className="text-xs h-6"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
              {STAGE_INFO[currentStage].description}
          </p>
          
          <div className="space-y-1">
            {currentStage === 'closed' ? (
              <div className="space-y-1">
                <p className="text-xs text-green-600">
                  ✓ Retrospective has been completed
                </p>
                <p className="text-xs text-muted-foreground">
                  You can reopen it to make changes or continue discussion
                </p>
              </div>
            ) : (
              <>
                {all_ready && total_users > 0 ? (
                  <p className="text-xs text-green-600">
                    ✓ All team members are ready to advance
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Waiting for {total_users - ready_users} more team member{total_users - ready_users !== 1 ? 's' : ''}
                  </p>
                )}
              </>
            )}
            
            <p className="text-xs text-blue-600 dark:text-blue-400">
              💡 Tip: Click any stage above to navigate directly to it
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompactStageControls;