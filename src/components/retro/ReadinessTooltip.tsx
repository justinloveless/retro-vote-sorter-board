import React from 'react';
import { UserAvatar } from '../../components/ui/UserAvatar.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { CheckCircle, Clock } from 'lucide-react';

interface ReadinessTooltipProps {
  activeUsers: Array<{
    user_id?: string;
    session_id?: string;
    user_name?: string;
    user_email?: string;
    avatar_url?: string;
  }>;
  readyUsers: Array<{
    user_id?: string;
    session_id?: string;
    is_ready: boolean;
  }>;
}

export const ReadinessTooltip: React.FC<ReadinessTooltipProps> = ({
  activeUsers,
  readyUsers
}) => {
  // Create a map of ready status by user/session ID
  const readyStatusMap = new Map<string, boolean>();
  readyUsers.forEach(ready => {
    const key = ready.user_id || ready.session_id || '';
    readyStatusMap.set(key, ready.is_ready);
  });

  // Get user display info
  const getUserDisplayInfo = (user: typeof activeUsers[0]) => {
    const userId = user.user_id || user.session_id || '';
    const isReady = readyStatusMap.get(userId) || false;
    const displayName = user.user_name || user.user_email || `User ${userId.slice(-4)}`;
    
    return {
      userId,
      displayName,
      isReady,
      avatarUrl: user.avatar_url
    };
  };

  const userInfos = activeUsers.map(getUserDisplayInfo);
  const readyCount = userInfos.filter(u => u.isReady).length;
  const totalCount = userInfos.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Team Readiness</h4>
        <Badge variant="secondary" className="text-xs">
          {readyCount}/{totalCount}
        </Badge>
      </div>
      
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {userInfos.map((userInfo) => (
          <div
            key={userInfo.userId}
            className="flex items-center gap-2 text-xs"
          >
            <UserAvatar
              avatarUrl={userInfo.avatarUrl}
              name={userInfo.displayName.charAt(0).toUpperCase()}
              className="h-5 w-5"
            />
            
            <span className="flex-1 truncate">
              {userInfo.displayName}
            </span>
            
            {userInfo.isReady ? (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-3 w-3" />
                <span className="text-xs font-medium">Ready</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-amber-600">
                <Clock className="h-3 w-3" />
                <span className="text-xs">Waiting</span>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {totalCount === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No active users
        </p>
      )}
    </div>
  );
};