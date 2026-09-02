import React, { useState } from 'react';
import { Check, Spotlight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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

  const [giveOpen, setGiveOpen] = useState(false);

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

  const handleGive = (userId: string) => {
    giveSpotlightTo(userId);
    setGiveOpen(false);
  };

  return (
    <>
      <DropdownMenu modal={false}>
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
        <DropdownMenuContent align="end" side={side} className="min-w-[14rem] z-[100]">
          <DropdownMenuItem
            onSelect={() => {
              onSpotlightClick();
            }}
          >
            <Spotlight className="mr-2 h-4 w-4 shrink-0" />
            {primaryLabel}
          </DropdownMenuItem>
          {canGive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  // Defer so the menu unmounts before the dialog opens.
                  window.setTimeout(() => setGiveOpen(true), 0);
                }}
              >
                Give spotlight to…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={giveOpen} onOpenChange={setGiveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Give spotlight to…</DialogTitle>
            <DialogDescription>
              Hand the spotlight to another participant so everyone follows their ticket.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-64 pr-2">
            <div className="flex flex-col gap-1">
              {spotlightGiveCandidates.map(({ userId, name, hasSpotlight }) => (
                <Button
                  key={userId}
                  type="button"
                  variant={hasSpotlight ? 'secondary' : 'ghost'}
                  className="justify-between"
                  disabled={hasSpotlight}
                  onClick={() => handleGive(userId)}
                >
                  <span className="truncate">{name}</span>
                  {hasSpotlight && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      Has spotlight
                    </span>
                  )}
                </Button>
              ))}
              {spotlightGiveCandidates.length === 0 && (
                <p className="text-sm text-muted-foreground px-1 py-2">
                  No other participants in this session yet.
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
