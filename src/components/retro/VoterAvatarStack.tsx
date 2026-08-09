import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { UserAvatar } from '@/components/ui/UserAvatar';
import type { ItemVoter } from '@/hooks/useRetroBoard';

interface VoterAvatarStackProps {
  voters: ItemVoter[];
  maxVisible?: number;
  sizeClassName?: string;
}

export const VoterAvatarStack: React.FC<VoterAvatarStackProps> = ({
  voters,
  maxVisible = 5,
  sizeClassName = 'h-6 w-6',
}) => {
  if (!voters.length) return null;

  const visible = voters.slice(0, maxVisible);
  const overflow = voters.slice(maxVisible);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center -space-x-2" aria-label={`Voted by ${voters.map(v => v.name).join(', ')}`}>
        {visible.map((voter) => (
          <UserAvatar
            key={voter.key}
            name={voter.name}
            avatarUrl={voter.avatarUrl}
            className={`${sizeClassName} border-2 border-white dark:border-gray-800`}
          />
        ))}
        {overflow.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`flex items-center justify-center ${sizeClassName} rounded-full bg-gray-100 dark:bg-gray-700 border-2 border-white dark:border-gray-800 text-[10px] font-medium text-gray-600 dark:text-gray-300`}
              >
                +{overflow.length}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-0.5">
                {overflow.map((voter) => (
                  <p key={voter.key}>{voter.name}</p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};
