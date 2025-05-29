
import React from 'react';
import { Users, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface ActiveUser {
  id: string;
  user_name: string;
  last_seen: string;
}

interface ActiveUsersProps {
  users: ActiveUser[];
}

export const ActiveUsers: React.FC<ActiveUsersProps> = ({ users }) => {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isRecentlyActive = (lastSeen: string) => {
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffInMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
    return diffInMinutes < 5; // Consider active if seen within 5 minutes
  };

  const activeUsers = users.filter(user => isRecentlyActive(user.last_seen));

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1 text-sm text-gray-600">
        <Users className="h-4 w-4" />
        <span>{activeUsers.length} online</span>
      </div>
      
      <div className="flex -space-x-2">
        {activeUsers.slice(0, 5).map((user) => (
          <Avatar key={user.id} className="h-8 w-8 border-2 border-white">
            <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
              {getInitials(user.user_name)}
            </AvatarFallback>
          </Avatar>
        ))}
        {activeUsers.length > 5 && (
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 border-2 border-white text-xs text-gray-600">
            +{activeUsers.length - 5}
          </div>
        )}
      </div>
      
      {activeUsers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {activeUsers.slice(0, 3).map((user) => (
            <Badge key={user.id} variant="secondary" className="text-xs">
              {user.user_name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
