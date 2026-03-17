import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePokerTable } from './context';
import CardHandSelector from "@/components/Neotro/CardHandSelector";
import PlayingCard from "@/components/Neotro/PlayingCards/PlayingCard";
import PlayHandButton from "@/components/Neotro/PlayHandButton";
import CardState from "@/components/Neotro/PlayingCards/CardState";
import NextRoundButton from "@/components/Neotro/NextRoundButton";
import { PokerSessionChat } from "@/components/shared/PokerSessionChat";
import { PokerConfig } from '../PokerConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Send, Maximize2, Ticket, ChevronLeft, ChevronRight, Play, ListOrdered, ChevronDown, Eye, LogOut } from 'lucide-react';
import { PlayerSelection, getPointsWithMostVotes } from '@/hooks/usePokerSession';
import SubmitPointsToJira from '@/components/Neotro/SubmitPointsToJira';
import { JiraIssueDrawer } from '@/components/Neotro/JiraIssueDrawer';
import { EmbeddedTicketQueue } from '@/components/Neotro/EmbeddedTicketQueue';
import { supabase } from '@/integrations/supabase/client';
import useEmblaCarousel from 'embla-carousel-react';

function QueuePanelCard({
  teamId,
  ticketQueue,
  addTicketToQueue,
  removeTicketFromQueue,
  reorderQueue,
  clearQueue,
  displayTicketNumber,
  setDisplayTicketNumber,
  updateTicketNumber,
}: {
  teamId: string | undefined;
  ticketQueue: { id: string; ticket_key: string; ticket_summary: string | null; position: number }[];
  addTicketToQueue: (key: string, summary: string | null) => Promise<void>;
  removeTicketFromQueue: (id: string) => Promise<void>;
  reorderQueue: (items: { id: string; ticket_key: string; ticket_summary: string | null; position: number }[]) => Promise<void>;
  clearQueue: () => Promise<void>;
  displayTicketNumber: string;
  setDisplayTicketNumber: (key: string) => void;
  updateTicketNumber: (key: string) => void;
}) {
  const [isQueueOpen, setIsQueueOpen] = useState(true);
  return (
    <Collapsible open={isQueueOpen} onOpenChange={setIsQueueOpen} asChild>
      <Card className={`h-full flex flex-col ${!isQueueOpen ? 'h-auto' : ''}`}>
        <CollapsibleTrigger asChild>
          <CardHeader className="flex-shrink-0 pb-3 cursor-pointer">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ListOrdered className="h-5 w-5" />
              <span>Queue</span>
              {ticketQueue.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {ticketQueue.length}
                </Badge>
              )}
              <ChevronDown className={`h-5 w-5 ml-auto transform transition-transform ${isQueueOpen ? 'rotate-0' : '-rotate-90'}`} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent asChild forceMount>
          <CardContent className="flex-1 flex flex-col min-h-0 p-4 pt-0 data-[state=closed]:hidden">
            {teamId ? (
              <EmbeddedTicketQueue
                teamId={teamId}
                queue={ticketQueue}
                onAddTicket={addTicketToQueue}
                onRemoveTicket={removeTicketFromQueue}
                onReorderQueue={reorderQueue}
                onClearQueue={clearQueue}
                displayTicketNumber={displayTicketNumber}
                onSelectTicket={(ticketKey) => {
                  setDisplayTicketNumber(ticketKey);
                  updateTicketNumber(ticketKey);
                }}
              />
            ) : (
              <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
                Join a team to use the ticket queue
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

const getGridColumns = (playerCount: number) => {
    if (playerCount <= 4) return 'grid-cols-4';
    if (playerCount <= 6) return 'grid-cols-6';
    if (playerCount <= 8) return 'grid-cols-4';
    if (playerCount <= 12) return 'grid-cols-6';
    return 'grid-cols-8';
};

export const DesktopView: React.FC = () => {
    const {
        shake,
        currentRound,
        rounds,
        isViewingHistory,
        canGoBack,
        canGoForward,
        goToPreviousRound,
        goToNextRound,
        goToCurrentRound,
        goToRound,
        session,
        updateSessionConfig,
        updateUserSelection,
        deleteAllRounds,
        isSlackInstalled,
        playHand,
        nextRound,
        handleSendToSlack,
        isSending,
        displaySession,
        displayWinningPoints,
        cardGroups,
        activeUserSelection,
        totalPlayers,
        presentUserIds,
        pointOptions,
        handlePointChange,
        toggleLockUserSelection,
        toggleAbstainUserSelection,
        displayTicketNumber,
        setDisplayTicketNumber,
        teamId,
        activeUserId,
        userRole,
        isObserver,
        leaveObserverMode,
        enterObserverMode,
        setNextRoundDialogOpen,
        onNextRoundRequest,
        ticketQueue,
        addTicketToQueue,
        removeTicketFromQueue,
        reorderQueue,
        clearQueue,
        isJiraConfigured,
        updateTicketNumber,
    } = usePokerTable();

    const CARD_BASE_HEIGHT = 95;
    const desktopScale = totalPlayers <= 4 ? 1.6 : totalPlayers <= 6 ? 1.4 : totalPlayers <= 8 ? 1.2 : totalPlayers <= 12 ? 1.0 : 0.8;
    const scaledCardHeight = CARD_BASE_HEIGHT * desktopScale;
    const VISIBLE_STRIP = 10;
    const stackOverlap = scaledCardHeight - VISIBLE_STRIP;

    const [ticketMetaByKey, setTicketMetaByKey] = useState<Record<string, { issueTypeIconUrl?: string; storyPoints?: number | null; summary?: string }>>({});
    const userInteractingRef = useRef(false);

    const currentPointsLabel = useMemo(() => {
        if (isViewingHistory && currentRound && currentRound.average_points > 0) {
            return Number.isInteger(currentRound.average_points)
                ? `${currentRound.average_points} pts`
                : `${currentRound.average_points.toFixed(1)} pts`;
        }
        if (displaySession.game_state === 'Playing' && displayWinningPoints > 0) {
            return `${displayWinningPoints} pts`;
        }
        const livePoints = ticketMetaByKey[displayTicketNumber]?.storyPoints;
        return livePoints != null ? `${livePoints} pts` : null;
    }, [isViewingHistory, currentRound, displaySession.game_state, displayWinningPoints, ticketMetaByKey, displayTicketNumber]);

    const currentTicketKey = displaySession?.ticket_number || displayTicketNumber;
    const currentTicketSummary = useMemo(() => {
        const fromApi = ticketMetaByKey[currentTicketKey]?.summary;
        if (fromApi) return fromApi;
        const fromSession = (displaySession as { ticket_title?: string | null })?.ticket_title;
        if (fromSession) return fromSession;
        const fromQueue = ticketQueue.find((t) => t.ticket_key === currentTicketKey)?.ticket_summary;
        return fromQueue ?? null;
    }, [ticketMetaByKey, displaySession, ticketQueue, currentTicketKey]);

    const ticketStripItems = useMemo(() => {
        const roundItems = rounds
            .filter((round) => !!round.ticket_number)
            .map((round) => {
                const jiraPoints = ticketMetaByKey[round.ticket_number as string]?.storyPoints;
                const modePoints = getPointsWithMostVotes(
                    Object.values(round.selections || {}) as { points: number }[]
                );
                const displayPoints = jiraPoints ?? (modePoints > 0 ? modePoints : null);
                return {
                    id: `round-${round.id}`,
                    ticketKey: round.ticket_number as string,
                    pointsLabel: displayPoints != null ? `${displayPoints} pts` : null,
                    type: 'round' as const,
                    roundNumber: round.round_number,
                };
            });

        const currentTicketKey = displayTicketNumber || 'No ticket';
        const lastRound = roundItems[roundItems.length - 1];
        const currentIsDuplicate = lastRound?.ticketKey === currentTicketKey;

        const items = [...roundItems];

        if (!isViewingHistory && !currentIsDuplicate) {
            items.push({
                id: 'current-ticket',
                ticketKey: currentTicketKey,
                pointsLabel: currentPointsLabel,
                type: 'current' as const,
            });
        }

        return items;
    }, [rounds, displayTicketNumber, currentPointsLabel, ticketMetaByKey, isViewingHistory]);

    const selectedStripIndex = useMemo(() => {
        let result: number;
        if (isViewingHistory && currentRound) {
            const idx = ticketStripItems.findIndex(
                (item) => item.type === 'round' && item.roundNumber === currentRound.round_number
            );
            if (idx >= 0) { result = idx; return result; }
        }
        const currentIdx = ticketStripItems.findIndex((item) => item.type === 'current');
        if (currentIdx >= 0) { result = currentIdx; return result; }
        for (let i = ticketStripItems.length - 1; i >= 0; i--) {
            if (ticketStripItems[i].type === 'round') { result = i; return result; }
        }
        return 0;
    }, [isViewingHistory, currentRound, ticketStripItems]);

    const emblaOptions = useMemo(() => ({
        align: 'center' as const,
        containScroll: false,
        startIndex: selectedStripIndex,
        dragFree: false,
    }), []); // eslint-disable-line react-hooks/exhaustive-deps -- startIndex is only needed on mount; sync effect handles subsequent scrolls

    const [emblaRef, emblaApi] = useEmblaCarousel(emblaOptions);

    const [activeSnapIndex, setActiveSnapIndex] = useState(selectedStripIndex);

    // Derive ticket keys independently of ticketMetaByKey to avoid a
    // fetch → state update → new keys → re-fetch infinite loop.
    const ticketKeysForFetch = useMemo(() => {
        const fromRounds = rounds
            .map((r) => r.ticket_number)
            .filter((k): k is string => !!k);
        const current = displayTicketNumber || '';
        return Array.from(new Set([...fromRounds, current].filter((k) => k && k !== 'No ticket'))).sort().join(',');
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
                    body: {
                        teamId,
                        includeKeys: keys,
                    },
                });

                if (error || data?.error) {
                    return;
                }

                const nextMap: Record<string, { issueTypeIconUrl?: string; storyPoints?: number | null; summary?: string }> = {};
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

    const navigateToItem = useCallback((item: { ticketKey: string; type: string; roundNumber?: number }) => {
        if (!item || item.ticketKey === 'No ticket') return;
        if (item.type === 'round' && item.roundNumber) {
            if (currentRound?.round_number !== item.roundNumber) {
                goToRound(item.roundNumber);
            }
            return;
        }
        if (item.type === 'current') {
            if (isViewingHistory) { goToCurrentRound(); }
        }
    }, [currentRound, goToRound, isViewingHistory, goToCurrentRound]);

    const handleChipClick = useCallback((index: number) => {
        userInteractingRef.current = false;
        if (emblaApi) emblaApi.scrollTo(index);
        const item = ticketStripItems[index];
        if (item) navigateToItem(item);
    }, [emblaApi, ticketStripItems, navigateToItem]);

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
            const snap = emblaApi.selectedScrollSnap();
            setActiveSnapIndex(snap);
        };
        emblaApi.on('select', onSelect);
        onSelect();
        return () => { emblaApi.off('select', onSelect); };
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        // Keep strip position/highlight aligned to round state updates.
        setActiveSnapIndex(selectedStripIndex);
        const currentSnap = emblaApi.selectedScrollSnap();
        if (selectedStripIndex !== currentSnap) {
            emblaApi.scrollTo(selectedStripIndex);
        }
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

    if (!displaySession || !session) return null;

    return (
        <div className={`poker-table relative flex flex-col h-full ${shake ? 'screen-shake' : ''}`}>
            <div className="px-4 pt-2 pb-2">
                <div className="bg-card/25 border border-primary/20 rounded-lg px-3 py-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 flex items-center justify-center gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={scrollStripPrev}
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={goToCurrentRound}
                        >
                            <Play className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={scrollStripNext}
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                        </div>
                        <PokerConfig
                            config={{
                                presence_enabled: 'presence_enabled' in session && session.presence_enabled,
                                send_to_slack: 'send_to_slack' in session && session.send_to_slack,
                                observer_ids: (session as { observer_ids?: string[] }).observer_ids,
                                selections: session.selections,
                                team_id: session.team_id,
                            }}
                            onUpdateConfig={updateSessionConfig}
                            onDeleteAllRounds={deleteAllRounds}
                            isSlackIntegrated={isSlackInstalled}
                            userRole={userRole}
                            teamId={teamId}
                            iconOnly
                        />
                    </div>
                    <div className="relative flex-1 min-w-0">
                                <div className="pointer-events-none absolute left-1/2 top-0 bottom-0 z-10 flex -translate-x-1/2 flex-col items-center">
                                    <div className="h-full w-px bg-primary/80" />
                                </div>
                                <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-card/90 to-transparent z-[5]" />
                                <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card/90 to-transparent z-[5]" />
                                <div ref={emblaRef} className="overflow-hidden">
                                    <div className="flex items-center gap-2 py-2 px-1">
                                        {ticketStripItems.map((item, index) => {
                                            const isActive = index === activeSnapIndex;
                                            const iconUrl = ticketMetaByKey[item.ticketKey]?.issueTypeIconUrl;
                                            return (
                                                <div key={item.id} className="flex-none">
                                                    <button
                                                        type="button"
                                                        className={`inline-flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs whitespace-nowrap transition-all duration-200 ${isActive
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
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 min-h-0 relative">
                <div className="w-1/4 p-4 flex flex-col">
                    <div className="flex-grow overflow-hidden flex flex-col h-full justify-end">
                        <QueuePanelCard
                            teamId={teamId}
                            ticketQueue={ticketQueue}
                            addTicketToQueue={addTicketToQueue}
                            removeTicketFromQueue={removeTicketFromQueue}
                            reorderQueue={reorderQueue}
                            clearQueue={clearQueue}
                            displayTicketNumber={displayTicketNumber}
                            setDisplayTicketNumber={setDisplayTicketNumber}
                            updateTicketNumber={updateTicketNumber}
                        />
                    </div>
                </div>

                <div className="w-1/2 flex flex-col p-4">
                    {(displaySession.game_state === 'Playing' || !isViewingHistory) && (
                        <div className="flex flex-col items-center gap-2 pb-4 overflow-visible shrink-0">
                            <div className="w-64 flex flex-col gap-2 shrink-0 overflow-visible">
                                <div className="relative flex flex-col gap-1 bg-card/50 rounded-lg px-4 py-2.5 overflow-visible">
                                    {teamId && (displaySession.ticket_number || displayTicketNumber) && (
                                        <div className="absolute top-2 right-2">
                                            <JiraIssueDrawer
                                                issueIdOrKey={(displaySession.ticket_number || displayTicketNumber)!}
                                                teamId={teamId}
                                                trigger={
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Expand Jira issue">
                                                        <Maximize2 className="h-4 w-4" />
                                                    </Button>
                                                }
                                            />
                                        </div>
                                    )}
                                    <div className="flex items-center justify-center gap-2 pr-8 shrink-0 pt-0.5 pb-1">
                                        <span className="text-sm text-muted-foreground leading-[1.75]">
                                            {isViewingHistory ? 'Viewing:' : 'Now Pointing:'}
                                        </span>
                                        <span className="font-semibold text-foreground leading-[1.75]">
                                            {displaySession.ticket_number || displayTicketNumber || 'No ticket'}
                                        </span>
                                    </div>
                                    {currentTicketSummary && (
                                        <span className="text-sm font-normal text-muted-foreground italic text-center line-clamp-2">
                                            {currentTicketSummary}
                                        </span>
                                    )}
                                </div>
                                {displaySession.game_state === 'Playing' && (
                                    <div className="flex items-center justify-center gap-2 bg-primary/20 rounded-lg px-4 py-2">
                                        <span className="text-sm text-muted-foreground">Winning Points:</span>
                                        <span className="text-xl font-bold">{displayWinningPoints} pts</span>
                                    </div>
                                )}
                                {!isViewingHistory && (
                                    displaySession.game_state === 'Playing' ? (
                                        <div className="flex items-center justify-center gap-2 py-2">
                                            <NextRoundButton
                                                onHandPlayed={onNextRoundRequest}
                                                isHandPlayed={session.game_state === 'Playing'}
                                                className="w-full"
                                            />
                                        </div>
                                    ) : (
                                        <PlayHandButton
                                            onHandPlayed={playHand}
                                            isHandPlayed={session.game_state === 'Playing'}
                                            className="w-full"
                                        />
                                    )
                                )}
                            </div>
                        </div>
                    )}
                    <div className="flex-grow flex items-end justify-center min-h-0 pb-8">
                        {displaySession.game_state === 'Playing' && cardGroups ? (
                            <div className="flex flex-wrap items-end justify-center gap-x-6 gap-y-4">
                                {cardGroups.map(({ points, selections }) => (
                                    <div key={points} className="flex flex-col items-center space-y-2">
                                        <div className="flex flex-col items-center">
                                            {selections.map((selection, index) => (
                                                <div key={selection.userId}
                                                    className="relative transition-all duration-200 hover:-translate-y-2 hover:z-50"
                                                    style={{
                                                        marginTop: index > 0 ? `-${stackOverlap}px` : 0,
                                                        zIndex: selections.length - index,
                                                    }}>
                                                    <PlayingCard
                                                        cardState={CardState.Played}
                                                        playerName={selection.name}
                                                        pointsSelected={selection.points}
                                                        isPresent={presentUserIds.includes(selection.userId)}
                                                        totalPlayers={totalPlayers}
                                                        variant="stacked"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-center font-bold text-lg text-foreground bg-card/75 rounded-full px-4 py-1">
                                            {selections.length} x {points === -1 ? 'Abstain' : `${points} pts`}
                                        </div>
                                        <div className="flex flex-col items-center">
                                            {selections.map((selection) => (
                                                <span key={selection.userId} className="text-xs text-muted-foreground">
                                                    {selection.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={`grid ${getGridColumns(totalPlayers)} gap-x-4 gap-y-10 justify-items-center max-w-full`}>
                                {Object.entries(displaySession.selections).map(([userId, selection]: [string, PlayerSelection]) => (
                                    <PlayingCard
                                        key={userId}
                                        cardState={displaySession.game_state === 'Playing' ? CardState.Played : (selection.locked ? CardState.Locked : CardState.Selection)}
                                        playerName={selection.name}
                                        pointsSelected={selection.points}
                                        isPresent={presentUserIds.includes(userId)}
                                        totalPlayers={totalPlayers}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                    {displaySession.game_state === 'Playing' ? (
                        <div className="flex-shrink-0 flex flex-col items-center justify-center p-4 gap-2">
                            <div className="flex flex-col gap-2 w-full max-w-sm">
                                <SubmitPointsToJira
                                    teamId={teamId}
                                    ticketNumber={displaySession.ticket_number || displayTicketNumber}
                                    winningPoints={displayWinningPoints}
                                    isHandPlayed={true}
                                    isJiraConfigured={isJiraConfigured}
                                />
                                <Button
                                    onClick={handleSendToSlack}
                                    disabled={!isSlackInstalled || isSending}
                                    className="w-full"
                                >
                                    <Send className="h-4 w-4 mr-2" />
                                    {isSending ? 'Sending...' : 'Send to Slack'}
                                </Button>
                            </div>
                        </div>
                    ) : !isViewingHistory && !isObserver ? (
                        <div className="flex-shrink-0 flex items-center justify-center p-4">
                            <CardHandSelector
                                selectedPoints={activeUserSelection.points}
                                pointOptions={pointOptions}
                                onSelectPoints={(points) => updateUserSelection(points)}
                                onLockIn={toggleLockUserSelection}
                                isLockedIn={activeUserSelection.locked}
                                onAbstain={toggleAbstainUserSelection}
                                isAbstained={activeUserSelection.points === -1}
                                isAbstainedDisabled={session.game_state === 'Playing'}
                            />
                        </div>
                    ) : !isViewingHistory && isObserver ? (
                        <div className="flex-shrink-0 flex items-center justify-center p-4">
                            <div className="flex flex-col items-center gap-3 rounded-lg bg-card/50 border border-primary/20 px-6 py-4">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Eye className="h-5 w-5" />
                                    <span className="text-sm font-medium">You are an observer</span>
                                </div>
                                <Button variant="outline" size="sm" onClick={leaveObserverMode} className="gap-2">
                                    <LogOut className="h-4 w-4" />
                                    Leave observer mode
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </div>
                <div className="w-1/4 p-4 flex flex-col">
                    <div className=" rounded-lg h-full flex flex-col justify-end">
                        <PokerSessionChat />
                    </div>
                </div>
                {!isObserver && !isViewingHistory && (
                    <div className="absolute bottom-4 right-[calc(25%+1rem)] z-10">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={enterObserverMode} aria-label="Join as observer">
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Join as observer</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                )}
            </div>
        </div>
    );
} 