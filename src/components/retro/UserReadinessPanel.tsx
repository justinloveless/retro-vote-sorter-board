import React from 'react';
import { Button } from '../../components/ui/button.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { Progress } from '../../components/ui/progress.tsx';
import { CheckCircle, Clock, Users, UserCheck } from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import { type RetroStage } from '../../hooks/useRetroBoard.ts';
import { useUserReadiness } from '../../hooks/useUserReadiness.ts';

interface UserReadinessPanelProps {
  boardId: string;
  currentStage: RetroStage | null;
  activeUsers?: Array<{
    id?: string;
    user_id?: string;
    user_name: string;
    avatar_url?: string;
    last_seen: string;
  }>;
  className?: string;
  compact?: boolean;
  showUserList?: boolean;
}

const stageLabels: Record<RetroStage, string> = {
  thinking: 'ready to start voting',
  voting: 'ready to start discussing',
  discussing: 'ready to close retrospective', 
  closed: 'retrospective complete',
};

export const UserReadinessPanel: React.FC<UserReadinessPanelProps> = ({
  boardId,
  currentStage,
  activeUsers = [],
  className,
  compact = false,
  showUserList = false,
}) => {
  const {
    isCurrentUserReady,
    readinessSummary,
    readyUsers,
    loading,
    toggleReadiness,
  } = useUserReadiness(boardId, currentStage, activeUsers);

  if (!currentStage || currentStage === 'closed') {
    return null;
  }

  const nextStageLabel = stageLabels[currentStage];
  const { total_users, ready_users, ready_percentage, all_ready } = readinessSummary;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        {/* Ready Status Badge */}
        <Badge 
          variant={all_ready ? "default" : ready_users > 0 ? "secondary" : "outline"}
          className="flex items-center gap-1"
        >
          {all_ready ? (
            <CheckCircle className="h-3 w-3" />
          ) : (
            <Clock className="h-3 w-3" />
          )}
          {ready_users}/{total_users} ready
        </Badge>

        {/* Current User Ready Button */}
        <Button
          size="sm"
          variant={isCurrentUserReady ? "default" : "outline"}
          onClick={toggleReadiness}
          disabled={loading}
          className={cn(
            "transition-all duration-200",
            isCurrentUserReady && "bg-green-600 hover:bg-green-700"
          )}
        >
          {isCurrentUserReady ? (
            <>
              <CheckCircle className="h-4 w-4 mr-1" />
              Ready
            </>
          ) : (
            <>
              <Clock className="h-4 w-4 mr-1" />
              Mark Ready
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Readiness
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Mark yourself as {nextStageLabel}
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {ready_users} of {total_users} team members ready
            </span>
            <span className="font-medium">{ready_percentage}%</span>
          </div>
          <Progress 
            value={ready_percentage} 
            className="h-2"
            indicatorClassName={cn(
              "transition-all duration-300",
              all_ready ? "bg-green-500" : "bg-blue-500"
            )}
          />
        </div>

        {/* All Ready Message */}
        {all_ready && total_users > 0 && (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">
                Everyone is ready!
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                An admin can now advance to the next stage.
              </p>
            </div>
          </div>
        )}

        {/* Current User Ready Toggle */}
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">You are {nextStageLabel}</span>
          </div>
          <Button
            variant={isCurrentUserReady ? "default" : "outline"}
            size="sm"
            onClick={toggleReadiness}
            disabled={loading}
            className={cn(
              "transition-all duration-200",
              isCurrentUserReady && "bg-green-600 hover:bg-green-700"
            )}
          >
            {loading ? (
              "Updating..."
            ) : isCurrentUserReady ? (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Ready
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 mr-1" />
                Mark Ready
              </>
            )}
          </Button>
        </div>

        {/* Ready Users List */}
        {showUserList && readyUsers.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Ready team members:</h4>
            <div className="flex flex-wrap gap-2">
              {readyUsers.map((user) => (
                <Badge 
                  key={user.id} 
                  variant="secondary" 
                  className="flex items-center gap-1"
                >
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  {user.user_name || 'Anonymous User'}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UserReadinessPanel;