import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ItemVoter } from '@/hooks/useRetroBoard';

interface VotersTooltipProps {
  voters: ItemVoter[];
  /** When false, renders children without a voters tooltip. */
  enabled?: boolean;
  children: React.ReactNode;
}

const getInitials = (name: string) => {
  if (!name) return 'A';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

/**
 * Wraps the vote counter and reveals who voted on hover.
 */
export const VotersTooltip: React.FC<VotersTooltipProps> = ({
  voters,
  enabled = true,
  children,
}) => {
  if (!enabled || voters.length === 0) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{children}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs p-2">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Voted by
          </p>
          <ul className="space-y-1">
            {voters.map((voter) => (
              <li key={voter.key} className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={voter.avatarUrl ?? undefined} alt={voter.name} />
                  <AvatarFallback className="text-[9px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                    {getInitials(voter.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs">{voter.name}</span>
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/** @deprecated Prefer VotersTooltip; kept for any lingering imports. */
export const VoterAvatarStack = VotersTooltip;
