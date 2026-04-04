import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Play, Power, Ticket, Trash2, Settings, Eye, EyeOff, Spotlight } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { NeotroPressableButton } from '@/components/Neotro/NeotroPressableButton';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import type { PokerSessionState, WinningPoints } from '@/hooks/usePokerSession';
import { deriveDisplayGameState } from '@/lib/pokerRoundDisplayGameState';
import type { JiraTicketMeta } from '@/hooks/use-jira-ticket-metadata';
import type { PokerSessionRound } from '@/hooks/usePokerSessionHistory';
import { displayTicketLabel, isSyntheticRoundTicket } from '@/lib/pokerRoundTicketPlaceholder';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePokerTable } from '@/components/Neotro/PokerTableComponent/context';

type PokerRoundGameStateMerge = Pick<PokerSessionState, 'game_state' | 'average_points' | 'selections'>;

interface RoundSelectorProps {
  rounds: PokerSessionRound[];
  session: { round_number?: number; current_round_number?: number } | null;
  displayTicketNumber: string;
  displaySession: { game_state?: string } | null;
  displayWinningPoints: number;
  displayWinningVote?: WinningPoints;
  currentRound: PokerSessionRound | null;
  isViewingHistory: boolean;
  /** From `useJiraTicketMetadata` — shared with the parent layout so we only fetch once. */
  ticketMetaByKey: Record<string, JiraTicketMeta>;
  goToRound: (roundNumber: number) => void;
  goToCurrentRound: () => void;
  deleteRound?: (roundId: string) => Promise<boolean>;
  onStartNewRoundRequest?: () => void;
  isAdmin?: boolean;
  /** When true, removes card styling and uses full width (for mobile) */
  isMobile?: boolean;
  onBack?: () => void;
  /** Room ID + copy link, etc. — top toolbar row, left of the centered round controls */
  toolbarExtras?: React.ReactNode;
  /** When false, only the top toolbar (back, extras, theme) is shown */
  showRoundStrip?: boolean;
  onSettingsClick?: () => void;
  isObserver?: boolean;
  onEnterObserverMode?: () => void;
  onLeaveObserverMode?: () => void;
  /** New chat messages received while viewing another round (shown on each round chip). */
  chatNewMessageCountByRound?: Record<number, number>;
}

export const RoundSelector: React.FC<RoundSelectorProps> = ({
  rounds,
  session,
  displayTicketNumber,
  displaySession,
  displayWinningPoints,
  displayWinningVote,
  currentRound,
  isViewingHistory,
  ticketMetaByKey,
  goToRound,
  goToCurrentRound,
  deleteRound,
  onStartNewRoundRequest = () => {},
  isAdmin = false,
  isMobile = false,
  onBack,
  toolbarExtras,
  showRoundStrip = true,
  onSettingsClick,
  isObserver = false,
  onEnterObserverMode,
  onLeaveObserverMode,
  chatNewMessageCountByRound = {},
}) => {
  const { theme, toggleTheme } = useTheme();
  const userInteractingRef = useRef(false);
  const {
    spotlightRoundNumber,
    isSpotlightMine,
    onSpotlightClick,
    activateRoundById,
  } = usePokerTable();

  const currentPointsLabel = useMemo(() => {
    const rawTicket = displayTicketNumber || currentRound?.ticket_number || '';
    const storyPointsFromIssue = !isSyntheticRoundTicket(rawTicket)
      ? ticketMetaByKey[String(rawTicket).trim()]?.storyPoints
      : undefined;

    if (isViewingHistory) {
      if (storyPointsFromIssue != null) {
        return `${storyPointsFromIssue} pts`;
      }
      if (currentRound && currentRound.average_points > 0) {
        return Number.isInteger(currentRound.average_points)
          ? `${currentRound.average_points} pts`
          : `${currentRound.average_points.toFixed(1)} pts`;
      }
      return null;
    }
    if (displaySession?.game_state === 'Playing' && displayWinningVote) {
      if (displayWinningVote.kind === 'between') {
        return `Between ${displayWinningVote.low} & ${displayWinningVote.high}`;
      }
      if (displayWinningPoints > 0) {
        return `${displayWinningPoints} pts`;
      }
    }
    return storyPointsFromIssue != null ? `${storyPointsFromIssue} pts` : null;
  }, [
    isViewingHistory,
    currentRound,
    displaySession?.game_state,
    displayWinningPoints,
    displayWinningVote,
    ticketMetaByKey,
    displayTicketNumber,
    currentRound?.ticket_number,
  ]);

  /** DB pointer (realtime) can move ahead of merged `round_number` on the session object — prefer it for the strip. */
  const sessionPointer = session?.current_round_number ?? session?.round_number ?? 1;

  const ticketStripItems = useMemo(() => {
    // List every round so completed / inactive rounds without tickets stay reachable (legacy sessions).
    const sortedRounds = rounds.slice().sort((a, b) => a.round_number - b.round_number);
    const hasRoundForPointer = sortedRounds.some((r) => r.round_number === sessionPointer);
    const stripCurrentNumber =
      hasRoundForPointer
        ? sessionPointer
        : sortedRounds.length > 0
          ? (sortedRounds.find((r) => r.is_active)?.round_number ??
              sortedRounds[sortedRounds.length - 1]!.round_number)
          : sessionPointer;

    const roundItems = sortedRounds.map((round) => {
        const isLatestRound = round.round_number === stripCurrentNumber;
        const isSelectedRound = currentRound?.round_number === round.round_number;
        const ticketKey = displayTicketLabel(round.ticket_number);
        const storyPoints = !isSyntheticRoundTicket(round.ticket_number)
          ? ticketMetaByKey[String(round.ticket_number || '').trim()]?.storyPoints
          : undefined;
        const displayPoints = storyPoints ?? null;
        return {
          id: `round-${round.id}`,
          roundId: round.id,
          ticketKey,
          pointsLabel: displayPoints != null ? `${displayPoints} pts` : (isSelectedRound ? currentPointsLabel : null),
          type: isLatestRound ? ('current' as const) : ('round' as const),
          roundNumber: round.round_number,
          isActive: round.is_active,
        };
      });

    const currentRoundExists = roundItems.some((item) => item.type === 'current');

    const items = [...roundItems];

    // Only synthesize a chip when there are no round rows yet (brand-new session). A synthetic row has no
    // `roundId`, so `goToRound` cannot run — it used to appear whenever the session pointer did not match
    // any fetched round, which produced a duplicate "No ticket" next to the real round.
    if (!isViewingHistory && !currentRoundExists && sortedRounds.length === 0) {
      items.push({
        id: 'current-ticket',
        roundId: undefined,
        ticketKey: displayTicketNumber.trim() || `Round ${sessionPointer}`,
        pointsLabel: currentPointsLabel,
        type: 'current' as const,
        roundNumber: sessionPointer,
        isActive: true,
      });
    }

    return items;
  }, [
    rounds,
    currentPointsLabel,
    ticketMetaByKey,
    isViewingHistory,
    currentRound,
    sessionPointer,
    displayTicketNumber,
  ]);

  const selectedStripIndex = useMemo(() => {
    if (currentRound) {
      const idx = ticketStripItems.findIndex((item) => item.roundNumber === currentRound.round_number);
      if (idx >= 0) return idx;
    }
    const currentIdx = ticketStripItems.findIndex((item) => item.type === 'current');
    if (currentIdx >= 0) return currentIdx;
    for (let i = ticketStripItems.length - 1; i >= 0; i--) {
      if (ticketStripItems[i].type === 'round') return i;
    }
    return 0;
  }, [currentRound, ticketStripItems]);

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

  const activeRoundsSorted = useMemo(
    () => rounds.filter((r) => r.is_active).slice().sort((a, b) => a.round_number - b.round_number),
    [rounds]
  );

  const goToNextActiveRound = useCallback(() => {
    if (activeRoundsSorted.length === 0) return;

    const currentRoundNumber =
      currentRound?.round_number ??
      session?.current_round_number ??
      session?.round_number ??
      1;

    const idx = activeRoundsSorted.findIndex((r) => r.round_number === currentRoundNumber);
    if (idx < 0) {
      // If the currently selected round isn't active, jump to the first active.
      goToRound(activeRoundsSorted[0].round_number);
      return;
    }

    const next = activeRoundsSorted[(idx + 1) % activeRoundsSorted.length];
    if (next) goToRound(next.round_number);
  }, [
    activeRoundsSorted,
    currentRound?.round_number,
    goToRound,
    session?.current_round_number,
    session?.round_number,
  ]);

  const navigateToItem = useCallback(
    (item: { ticketKey: string; type: string; roundNumber?: number }) => {
      if (!item) return;
      if (item.roundNumber) {
        if (currentRound?.round_number !== item.roundNumber) {
          goToRound(item.roundNumber);
        }
        return;
      }
    },
    [currentRound, goToRound]
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
    return () => { emblaApi.off('select', onSelect); };
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
    return () => { emblaApi.off('reInit', syncPosition); };
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

  const canShowRoundStrip = showRoundStrip;

  return (
    <div className={isMobile ? 'w-full pt-2 pb-0' : 'px-4'}>
      <div className={isMobile ? 'w-full px-4 py-1 flex flex-col gap-1' : 'px-3 py-2 flex flex-col gap-2'}>
        <div className="grid w-full min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-x-1 gap-y-1 sm:gap-x-2 min-h-9 py-1">
          <div className="flex min-w-0 items-center justify-self-start gap-1 sm:gap-2">
            {onBack ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 gap-1 px-1.5 sm:px-2 h-9"
                onClick={onBack}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className={isMobile ? 'sr-only' : undefined}>Back</span>
              </Button>
            ) : (
              <span className="w-0 shrink-0" aria-hidden />
            )}
            {toolbarExtras}
          </div>
          <div className="flex shrink-0 items-center justify-center gap-0.5 sm:gap-1 min-h-0">
            {canShowRoundStrip && (
              <>
                <NeotroPressableButton
                  size="sm"
                  onClick={scrollStripPrev}
                  aria-label="Previous round"
                  title="Previous round"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </NeotroPressableButton>
                <NeotroPressableButton
                  size="sm"
                  onClick={goToNextActiveRound}
                  aria-label="Go to next active round"
                  title="Next active round"
                >
                  <Play className="h-3.5 w-3.5" />
                </NeotroPressableButton>
                <NeotroPressableButton
                  size="sm"
                  onClick={onStartNewRoundRequest}
                  aria-label="Start new round"
                  title="New round"
                >
                  <span className="font-mono font-semibold text-sm leading-none">+</span>
                </NeotroPressableButton>
                <NeotroPressableButton
                  size="sm"
                  onClick={scrollStripNext}
                  aria-label="Next round"
                  title="Next round"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </NeotroPressableButton>
              </>
            )}
          </div>
          <div className="flex min-w-0 items-center justify-end justify-self-end gap-1 sm:gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Dark mode' : 'Light mode'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </Button>
            {!isMobile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <NeotroPressableButton
                    variant="gold"
                    size="sm"
                    isActive={isSpotlightMine}
                    onClick={onSpotlightClick}
                    aria-label={isSpotlightMine ? 'Stop spotlighting' : 'Spotlight this round'}
                  >
                    <Spotlight className="h-4 w-4" />
                  </NeotroPressableButton>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isSpotlightMine ? 'Stop spotlighting' : 'Spotlight this round'}
                </TooltipContent>
              </Tooltip>
            )}
            {(onEnterObserverMode || onLeaveObserverMode) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <NeotroPressableButton
                    size="sm"
                    isActive={isObserver}
                    onClick={() => (isObserver ? onLeaveObserverMode : onEnterObserverMode)?.()}
                    aria-label={isObserver ? 'Leave observer mode' : 'Join as observer'}
                  >
                    {isObserver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </NeotroPressableButton>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isObserver ? 'Leave observer mode' : 'Join as observer'}
                </TooltipContent>
              </Tooltip>
            )}
            {onSettingsClick && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <NeotroPressableButton
                    size="sm"
                    onClick={onSettingsClick}
                    aria-label="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </NeotroPressableButton>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Settings
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        {canShowRoundStrip && (
        <div className={`relative flex-1 min-w-0 ${isMobile ? '-mx-4' : '-mx-3'}`}>
          <div className="pointer-events-none absolute left-1/2 top-0 bottom-0 z-10 flex -translate-x-1/2 flex-col items-center">
            <div className="h-full w-px bg-primary/80" />
          </div>
          <div
            ref={emblaRef}
            className="overflow-hidden [-webkit-mask-image:linear-gradient(to_right,transparent,black_28px,black_calc(100%_-_28px),transparent)] [mask-image:linear-gradient(to_right,transparent,black_28px,black_calc(100%_-_28px),transparent)]"
          >
            <div className={`flex items-center gap-2 px-1 ${isMobile ? 'py-1' : 'py-2'}`}>
              {ticketStripItems.map((item, index) => {
                const isSelected = index === activeSnapIndex;
                const isRoundActive = !!item.isActive;
                const iconUrl = ticketMetaByKey[item.ticketKey]?.issueTypeIconUrl;
                const roundRow = item.roundId ? rounds.find((r) => r.id === item.roundId) : undefined;
                const mergedForStripRound: PokerRoundGameStateMerge | null = roundRow
                  ? session
                    ? ({ ...session, ...roundRow } as PokerRoundGameStateMerge)
                    : (roundRow as PokerRoundGameStateMerge)
                  : null;
                const canActivateRound =
                  !!roundRow &&
                  !roundRow.is_active &&
                  !!mergedForStripRound &&
                  deriveDisplayGameState(mergedForStripRound, roundRow) === 'Selection';

                const canDelete = isAdmin && deleteRound && item.roundId && ticketStripItems.filter(i => i.roundId).length > 1;
                const deleteActionLabel = item.isActive ? 'Cancel round' : 'Delete round';
                const showRoundContextMenu = !!item.roundId && (canDelete || canActivateRound);
                const newChatCount =
                  item.roundNumber != null ? chatNewMessageCountByRound[item.roundNumber] ?? 0 : 0;
                const isSpotlightRound =
                  spotlightRoundNumber != null &&
                  item.roundNumber != null &&
                  item.roundNumber === spotlightRoundNumber;
                const chipButton = (
                  <div className="relative inline-flex">
                    {newChatCount > 0 && (
                      <span
                        className="pointer-events-none absolute -right-1 -top-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm tabular-nums"
                        aria-hidden
                      >
                        {newChatCount > 9 ? '9+' : newChatCount}
                      </span>
                    )}
                    <div className="relative inline-flex">
                      <button
                        type="button"
                        className={`relative inline-flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs whitespace-nowrap transition-all duration-200 ${
                          isSelected
                            ? isRoundActive
                              ? 'bg-emerald-500/15 border-emerald-400/80 text-foreground scale-110 ring-1 ring-emerald-400/30 shadow-[0_0_14px_rgba(16,185,129,0.35)]'
                              : 'bg-primary/15 border-primary/80 text-foreground scale-110'
                            : isRoundActive
                              ? 'bg-emerald-500/10 border-emerald-400/70 text-foreground ring-1 ring-emerald-400/20 shadow-[0_0_10px_rgba(16,185,129,0.32)]'
                              : 'bg-card hover:bg-accent/50 opacity-75'
                        }${
                          isSpotlightRound
                            ? ' overflow-visible !border-2 !border-solid !border-amber-400 ring-0 shadow-none'
                            : ''
                        }`}
                        onClick={() => handleChipClick(index)}
                      >
                        {isSpotlightRound && (
                          <div
                            className="pointer-events-none z-0 neotro-spotlight-overlay"
                            aria-hidden
                          >
                            <div className="neotro-spotlight-cone" />
                          </div>
                        )}
                        <span className="relative z-[1] inline-flex items-center gap-2">
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
                        </span>
                      </button>
                    </div>
                  </div>
                );
                return (
                  <div key={item.id} className="flex-none">
                    {showRoundContextMenu ? (
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          {chipButton}
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          {canActivateRound && (
                            <ContextMenuItem onClick={() => void activateRoundById(item.roundId!)}>
                              <Power className="h-4 w-4 mr-2" />
                              Activate round
                            </ContextMenuItem>
                          )}
                          {canDelete && (
                            <ContextMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => deleteRound(item.roundId!)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {deleteActionLabel}
                            </ContextMenuItem>
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
                    ) : (
                      chipButton
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
