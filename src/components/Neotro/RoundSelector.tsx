import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Ticket, Trash2 } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { NeotroPressableButton } from '@/components/Neotro/NeotroPressableButton';
import { supabase } from '@/integrations/supabase/client';
import { getPointsWithMostVotes } from '@/hooks/usePokerSession';
import type { PokerSessionRound } from '@/hooks/usePokerSessionHistory';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface TicketQueueItem {
  id: string;
  ticket_key: string;
  ticket_summary: string | null;
  position: number;
}

interface RoundSelectorProps {
  rounds: PokerSessionRound[];
  session: { round_number?: number } | null;
  displayTicketNumber: string;
  displaySession: { game_state?: string } | null;
  displayWinningPoints: number;
  currentRound: PokerSessionRound | null;
  isViewingHistory: boolean;
  teamId: string | undefined;
  ticketQueue: TicketQueueItem[];
  goToRound: (roundNumber: number) => void;
  goToCurrentRound: () => void;
  deleteRound?: (roundId: string) => Promise<boolean>;
  isAdmin?: boolean;
  /** When true, removes card styling and uses full width (for mobile) */
  isMobile?: boolean;
}

export const RoundSelector: React.FC<RoundSelectorProps> = ({
  rounds,
  session,
  displayTicketNumber,
  displaySession,
  displayWinningPoints,
  currentRound,
  isViewingHistory,
  teamId,
  ticketQueue,
  goToRound,
  goToCurrentRound,
  deleteRound,
  isAdmin = false,
  isMobile = false,
}) => {
  const [ticketMetaByKey, setTicketMetaByKey] = useState<
    Record<string, { issueTypeIconUrl?: string; storyPoints?: number | null; summary?: string }>
  >({});
  const userInteractingRef = useRef(false);

  const currentPointsLabel = useMemo(() => {
    if (isViewingHistory && currentRound && currentRound.average_points > 0) {
      return Number.isInteger(currentRound.average_points)
        ? `${currentRound.average_points} pts`
        : `${currentRound.average_points.toFixed(1)} pts`;
    }
    if (displaySession?.game_state === 'Playing' && displayWinningPoints > 0) {
      return `${displayWinningPoints} pts`;
    }
    const livePoints = ticketMetaByKey[displayTicketNumber]?.storyPoints;
    return livePoints != null ? `${livePoints} pts` : null;
  }, [isViewingHistory, currentRound, displaySession?.game_state, displayWinningPoints, ticketMetaByKey, displayTicketNumber]);

  const currentRoundNumber = session?.round_number ?? 1;

  const ticketStripItems = useMemo(() => {
    const roundItems = rounds
      .filter(
        (round) =>
          !!round.ticket_number || (!isViewingHistory && round.round_number === currentRoundNumber)
      )
      .map((round) => {
        const isCurrentRound = !isViewingHistory && round.round_number === currentRoundNumber;
        const ticketKey = isCurrentRound
          ? (displayTicketNumber || round.ticket_number || 'No ticket')
          : (round.ticket_number as string);
        const jiraPoints = ticketMetaByKey[ticketKey]?.storyPoints;
        const modePoints = getPointsWithMostVotes(
          Object.values(round.selections || {}) as { points: number }[]
        );
        const displayPoints = jiraPoints ?? (modePoints > 0 ? modePoints : null);
        return {
          id: `round-${round.id}`,
          roundId: round.id,
          ticketKey,
          pointsLabel: displayPoints != null ? `${displayPoints} pts` : (isCurrentRound ? currentPointsLabel : null),
          type: isCurrentRound ? ('current' as const) : ('round' as const),
          roundNumber: round.round_number,
        };
      });

    const lastRound = roundItems[roundItems.length - 1];
    const currentRoundExists = lastRound?.type === 'current';

    const items = [...roundItems];

    if (!isViewingHistory && !currentRoundExists) {
      items.push({
        id: 'current-ticket',
        roundId: undefined,
        ticketKey: displayTicketNumber || 'No ticket',
        pointsLabel: currentPointsLabel,
        type: 'current' as const,
        roundNumber: currentRoundNumber,
      });
    }

    return items;
  }, [rounds, displayTicketNumber, currentPointsLabel, ticketMetaByKey, isViewingHistory, currentRoundNumber]);

  const selectedStripIndex = useMemo(() => {
    if (isViewingHistory && currentRound) {
      const idx = ticketStripItems.findIndex(
        (item) => item.type === 'round' && item.roundNumber === currentRound.round_number
      );
      if (idx >= 0) return idx;
    }
    const currentIdx = ticketStripItems.findIndex((item) => item.type === 'current');
    if (currentIdx >= 0) return currentIdx;
    for (let i = ticketStripItems.length - 1; i >= 0; i--) {
      if (ticketStripItems[i].type === 'round') return i;
    }
    return 0;
  }, [isViewingHistory, currentRound, ticketStripItems]);

  const ticketKeysForFetch = useMemo(() => {
    const fromRounds = rounds.map((r) => r.ticket_number).filter((k): k is string => !!k);
    const current = displayTicketNumber || '';
    return Array.from(new Set([...fromRounds, current].filter((k) => k && k !== 'No ticket')))
      .sort()
      .join(',');
  }, [rounds, displayTicketNumber]);

  useEffect(() => {
    const keys = ticketKeysForFetch ? ticketKeysForFetch.split(',') : [];

    if (!teamId || keys.length === 0) {
      setTicketMetaByKey({});
      return;
    }

    const fetchIssueMetadata = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-jira-board-issues', {
          body: { teamId, includeKeys: keys },
        });

        if (error || data?.error) return;

        const nextMap: Record<
          string,
          { issueTypeIconUrl?: string; storyPoints?: number | null; summary?: string }
        > = {};
        for (const issue of data?.issues || []) {
          if (issue?.key) {
            nextMap[issue.key] = {
              issueTypeIconUrl: issue.issueTypeIconUrl,
              storyPoints: issue.storyPoints,
              summary: issue.summary,
            };
          }
        }
        setTicketMetaByKey(nextMap);
      } catch {
        // keep UI resilient if issue metadata is unavailable
      }
    };

    fetchIssueMetadata();
  }, [teamId, ticketKeysForFetch]);

  const emblaOptions = useMemo(
    () => ({
      align: 'center' as const,
      containScroll: false as const,
      startIndex: selectedStripIndex,
      dragFree: false,
    }),
    [] // eslint-disable-line react-hooks/exhaustive-deps -- startIndex only needed on mount
  );

  const wheelPlugin = useMemo(
    () => WheelGesturesPlugin({ forceWheelAxis: 'x' }),
    []
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(emblaOptions, [wheelPlugin]);
  const [activeSnapIndex, setActiveSnapIndex] = useState(selectedStripIndex);

  const navigateToItem = useCallback(
    (item: { ticketKey: string; type: string; roundNumber?: number }) => {
      if (!item || item.ticketKey === 'No ticket') return;
      if (item.type === 'round' && item.roundNumber) {
        if (currentRound?.round_number !== item.roundNumber) {
          goToRound(item.roundNumber);
        }
        return;
      }
      if (item.type === 'current') {
        if (isViewingHistory) goToCurrentRound();
      }
    },
    [currentRound, goToRound, isViewingHistory, goToCurrentRound]
  );

  const handleChipClick = useCallback(
    (index: number) => {
      userInteractingRef.current = false;
      if (emblaApi) emblaApi.scrollTo(index);
      const item = ticketStripItems[index];
      if (item) navigateToItem(item);
    },
    [emblaApi, ticketStripItems, navigateToItem]
  );

  const scrollStripPrev = useCallback(() => {
    if (!emblaApi) return;
    emblaApi.scrollPrev();
    const afterSnap = emblaApi.selectedScrollSnap();
    const item = ticketStripItems[afterSnap];
    if (item) navigateToItem(item);
  }, [emblaApi, ticketStripItems, navigateToItem]);

  const scrollStripNext = useCallback(() => {
    if (!emblaApi) return;
    emblaApi.scrollNext();
    const afterSnap = emblaApi.selectedScrollSnap();
    const item = ticketStripItems[afterSnap];
    if (item) navigateToItem(item);
  }, [emblaApi, ticketStripItems, navigateToItem]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setActiveSnapIndex(emblaApi.selectedScrollSnap());
    };
    emblaApi.on('select', onSelect);
    onSelect();
    return () => emblaApi.off('select', onSelect);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const syncPosition = () => {
      setActiveSnapIndex(selectedStripIndex);
      const currentSnap = emblaApi.selectedScrollSnap();
      if (selectedStripIndex !== currentSnap) {
        emblaApi.scrollTo(selectedStripIndex, false);
      }
    };
    syncPosition();
    emblaApi.on('reInit', syncPosition);
    return () => emblaApi.off('reInit', syncPosition);
  }, [emblaApi, selectedStripIndex]);

  useEffect(() => {
    if (!emblaApi) return;
    const onPointerDown = () => {
      userInteractingRef.current = true;
    };
    const onSettle = () => {
      const index = emblaApi.selectedScrollSnap();
      if (userInteractingRef.current) {
        const item = ticketStripItems[index];
        if (item) navigateToItem(item);
        userInteractingRef.current = false;
      }
    };
    emblaApi.on('pointerDown', onPointerDown);
    emblaApi.on('settle', onSettle);
    return () => {
      emblaApi.off('pointerDown', onPointerDown);
      emblaApi.off('settle', onSettle);
    };
  }, [emblaApi, ticketStripItems, navigateToItem]);

  if (rounds.length <= 1) return null;

  return (
    <div className={isMobile ? 'w-full pt-2 pb-0' : 'px-4 pt-2 pb-2'}>
      <div className={isMobile ? 'w-full px-4 py-1 flex flex-col gap-1' : 'bg-card/25 border border-primary/20 rounded-lg px-3 py-2 flex flex-col gap-2'}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 flex items-center justify-center gap-1">
            <NeotroPressableButton
              size="sm"
              onClick={scrollStripPrev}
              aria-label="Previous round"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </NeotroPressableButton>
            <NeotroPressableButton
              size="sm"
              onClick={goToCurrentRound}
              aria-label="Go to current round"
            >
              <Play className="h-3.5 w-3.5" />
            </NeotroPressableButton>
            <NeotroPressableButton
              size="sm"
              onClick={scrollStripNext}
              aria-label="Next round"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </NeotroPressableButton>
          </div>
        </div>
        <div className={`relative flex-1 min-w-0 ${isMobile ? '-mx-4' : '-mx-3'}`}>
          <div className="pointer-events-none absolute left-1/2 top-0 bottom-0 z-10 flex -translate-x-1/2 flex-col items-center">
            <div className="h-full w-px bg-primary/80" />
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-card/90 to-transparent z-[5]" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card/90 to-transparent z-[5]" />
          <div ref={emblaRef} className="overflow-hidden">
            <div className={`flex items-center gap-2 px-1 ${isMobile ? 'py-1' : 'py-2'}`}>
              {ticketStripItems.map((item, index) => {
                const isActive = index === activeSnapIndex;
                const iconUrl = ticketMetaByKey[item.ticketKey]?.issueTypeIconUrl;
                const canDelete = isAdmin && deleteRound && item.type === 'round' && item.roundId;
                const chipButton = (
                  <button
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs whitespace-nowrap transition-all duration-200 ${
                      isActive
                        ? 'bg-primary/15 border-primary/80 text-foreground scale-110'
                        : 'bg-card hover:bg-accent/50 opacity-75'
                    }`}
                    onClick={() => handleChipClick(index)}
                  >
                    {iconUrl ? (
                      <img src={iconUrl} alt="" className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Ticket className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="font-mono font-semibold">{item.ticketKey}</span>
                    {item.pointsLabel && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {item.pointsLabel}
                      </span>
                    )}
                  </button>
                );
                return (
                  <div key={item.id} className="flex-none">
                    {canDelete ? (
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          {chipButton}
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => deleteRound(item.roundId!)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete round
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ) : chipButton}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
