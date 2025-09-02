import React from 'react';
import { Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.tsx';
import { UserAvatar } from './ui/UserAvatar';

interface ActiveUser {
  id: string;
  user_name: string;
  last_seen: string;
  avatar_url?: string;
}

interface ActiveUsersProps {
  users: ActiveUser[];
}

export const ActiveUsers: React.FC<ActiveUsersProps> = ({ users }) => {
  const isRecentlyActive = (lastSeen: string) => {
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffInMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
    return diffInMinutes < 5; // Consider active if seen within 5 minutes
  };

  // Filter and deduplicate users by name (in case of duplicate presence records)
  const activeUsers = users
    .filter(user => isRecentlyActive(user.last_seen))
    .filter((user, index, self) =>
      self.findIndex(u => u.user_name === user.user_name) === index
    );

  return (
    <TooltipProvider>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
          <Users className="h-4 w-4" />
          <span>{activeUsers.length} online</span>
        </div>

        <div className="flex -space-x-2">
          {activeUsers.slice(0, 8).map((user) => (
            <UserAvatar
              key={user.id}
              name={user.user_name}
              avatarUrl={user.avatar_url}
              className="h-8 w-8 border-2 border-white dark:border-gray-800 cursor-pointer hover:z-10 transition-transform hover:scale-110"
            />
          ))}
          {activeUsers.length > 8 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-700 border-2 border-white dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300 cursor-pointer hover:z-10 transition-transform hover:scale-110">
                  +{activeUsers.length - 8}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  {activeUsers.slice(8).map((user) => (
                    <p key={user.id}>{user.user_name}</p>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};
