import React from 'react';
import { Check, Spotlight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NeotroPressableButton } from '@/components/Neotro/NeotroPressableButton';
import { usePokerTable } from '@/components/Neotro/PokerTableComponent/context';

type PokerSpotlightControlProps = {
  /** Menu side relative to the trigger. */
  side?: 'top' | 'bottom';
  /** Match RoundSelector (sm) vs bottom bar (md) button sizing. */
  size?: 'sm' | 'md';
};

export const PokerSpotlightControl: React.FC<PokerSpotlightControlProps> = ({
  side = 'top',
  size = 'md',
}) => {
  const {
    isSpotlightMine,
    spotlightHolderDisplayName,
    onSpotlightClick,
    spotlightGiveCandidates,
    giveSpotlightTo,
  } = usePokerTable();

  const primaryLabel = isSpotlightMine
    ? 'Stop spotlighting'
    : spotlightHolderDisplayName
      ? `Take spotlight from ${spotlightHolderDisplayName}`
      : 'Spotlight this round';

  const triggerLabel = isSpotlightMine
    ? 'Stop spotlighting — or give it to someone else'
    : spotlightHolderDisplayName
      ? `${spotlightHolderDisplayName} has the spotlight — take it or give it to someone else`
      : 'Spotlight this round, or give spotlight to someone else';

  const canGive = spotlightGiveCandidates.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <NeotroPressableButton
          variant="gold"
          size={size}
          isActive={isSpotlightMine}
          aria-label={triggerLabel}
          title={triggerLabel}
        >
          <Spotlight className="h-4 w-4" />
        </NeotroPressableButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={side} className="min-w-[12rem] z-[100]">
        <DropdownMenuItem onSelect={() => onSpotlightClick()}>
          <Spotlight className="mr-2 h-4 w-4" />
          {primaryLabel}
        </DropdownMenuItem>
        {canGive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                Give spotlight to…
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-64 min-w-[10rem] overflow-y-auto z-[110]">
                <DropdownMenuLabel className="font-normal text-muted-foreground">
                  Choose a participant
                </DropdownMenuLabel>
                {spotlightGiveCandidates.map(({ userId, name, hasSpotlight }) => (
                  <DropdownMenuItem
                    key={userId}
                    disabled={hasSpotlight}
                    onSelect={() => giveSpotlightTo(userId)}
                  >
                    <span className="flex-1 truncate">{name}</span>
                    {hasSpotlight && (
                      <Check className="ml-2 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
