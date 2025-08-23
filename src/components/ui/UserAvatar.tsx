import React, { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface UserAvatarProps {
    userId?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
    className?: string;
}

const getInitials = (name: string) => {
    if (!name) return 'A';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export const UserAvatar: React.FC<UserAvatarProps> = ({ name, avatarUrl, className }) => {
    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Avatar className={className}>
                        <AvatarImage src={avatarUrl ?? undefined} alt={name ?? 'User avatar'} />
                        <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                            {getInitials(name ?? 'Anonymous')}
                        </AvatarFallback>
                    </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{name ?? 'Anonymous'}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}; 