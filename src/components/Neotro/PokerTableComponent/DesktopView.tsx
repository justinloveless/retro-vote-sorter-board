import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DragToPlayProvider, DropZoneOverlay } from '@/components/Neotro/DragToPlay';
import { usePokerTable } from './context';
import { supabase } from '@/integrations/supabase/client';
import { useJiraTicketMetadata, type JiraTicketMeta } from '@/hooks/use-jira-ticket-metadata';
import CardHandSelector from "@/components/Neotro/CardHandSelector";
import PlayingCard from "@/components/Neotro/PlayingCards/PlayingCard";
import PlayHandButton from "@/components/Neotro/PlayHandButton";
import CardState from "@/components/Neotro/PlayingCards/CardState";
import NextRoundButton from "@/components/Neotro/NextRoundButton";
import { PokerSessionChat } from "@/components/shared/PokerSessionChat";
import { PokerConfig } from '../PokerConfig';
import { TicketDetailsNeotroButton } from '@/components/Neotro/TicketDetailsNeotroButton';
import { NeotroPressableButton } from '@/components/Neotro/NeotroPressableButton';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Send, Maximize2, Eye, GripVertical, RotateCcw, Search, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { PlayerSelection } from '@/hooks/usePokerSession';
import SubmitPointsToJira from '@/components/Neotro/SubmitPointsToJira';
import { JiraIssueDrawer } from '@/components/Neotro/JiraIssueDrawer';
import { EmbeddedTicketQueue } from '@/components/Neotro/EmbeddedTicketQueue';
import { useIsCompactViewport } from '@/hooks/use-compact-viewport';
import {
  DEFAULT_NEOTRO_PANEL_WIDTH,
  MAX_NEOTRO_PANEL_WIDTH,
  MIN_NEOTRO_PANEL_WIDTH,
  type NeotroPokerPanelVisibility,
  useNeotroPanelWidth,
  usePersistedNeotroPokerPanelVisibility,
  writePanelWidth,
} from '@/hooks/use-persisted-neotro-poker-panels';
import { RoundSelector } from '@/components/Neotro/RoundSelector';
import type { PokerSessionRound } from '@/hooks/usePokerSessionHistory';
import { displayTicketLabel, isSyntheticRoundTicket } from '@/lib/pokerRoundTicketPlaceholder';

function QueuePanelCard({
  teamId,
  rounds,
  addTicketToQueue,
  addTicketsToQueueBatch,
  displayTicketNumber,
  setDisplayTicketNumber,
  updateTicketNumber,
  isJiraConfigured,
  showJiraBrowser = true,
  onMetadataFromBrowse,
  onResizeStart,
  className,
}: {
  teamId: string | undefined;
  rounds: PokerSessionRound[];
  addTicketToQueue: (key: string, summary: string | null) => Promise<void>;
  addTicketsToQueueBatch: (tickets: Array<{ ticketKey: string; ticketSummary: string | null }>) => Promise<void>;
  displayTicketNumber: string;
  setDisplayTicketNumber: (key: string) => void;
  updateTicketNumber: (key: string) => void;
  isJiraConfigured: boolean;
  showJiraBrowser?: boolean;
  onMetadataFromBrowse?: (meta: Record<string, JiraTicketMeta>) => void;
  onResizeStart?: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <Card className={`relative h-full flex flex-col ${className ?? ''}`}>
      {onResizeStart && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize left panel"
          className="absolute right-0 top-0 bottom-0 w-2 -mr-1 flex cursor-col-resize items-center justify-center z-10"
          onMouseDown={onResizeStart}
        >
          <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
            <GripVertical className="h-2.5 w-2.5" />
          </div>
        </div>
      )}
      <CardContent className="flex-1 flex flex-col min-h-0 p-4">
        {teamId ? (
          <EmbeddedTicketQueue
            key={teamId}
            teamId={teamId}
            isJiraConfigured={isJiraConfigured}
            rounds={rounds}
            showJiraBrowser={showJiraBrowser}
            onAddTicket={addTicketToQueue}
            onAddTicketsBatch={addTicketsToQueueBatch}
            displayTicketNumber={displayTicketNumber}
            onSelectTicket={(ticketKey) => {
              setDisplayTicketNumber(ticketKey);
              updateTicketNumber(ticketKey);
            }}
            onMetadataFromBrowse={onMetadataFromBrowse}
          />
        ) : (
          <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
            Join a team to use the ticket queue
          </div>
        )}
      </CardContent>
    </Card>
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
        replayRound,
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
        handleTicketNumberChange,
        handleTicketNumberFocus,
        handleTicketNumberBlur,
        teamId,
        activeUserId,
        userRole,
        isObserver,
        leaveObserverMode,
        enterObserverMode,
        setNextRoundDialogOpen,
        onNextRoundRequest,
        onStartNewRoundRequest,
        addTicketToQueue,
        addTicketsToQueueBatch,
        isJiraConfigured,
        updateTicketNumber,
        chatUnreadCount,
        chatNewMessageCountByRound,
        markChatAsRead,
        chatMessagesForRound,
        deleteRound,
        onPokerBack,
        pokerToolbarExtras,
    } = usePokerTable();

    const isCompact = useIsCompactViewport();
    const [panelVisibility, setPanelVisibility] = usePersistedNeotroPokerPanelVisibility();
    const togglePanel = useCallback((panel: keyof NeotroPokerPanelVisibility) => {
        setPanelVisibility((prev) => {
            const next = { ...prev, [panel]: !prev[panel] };
            if (panel === 'chat' && next.chat) markChatAsRead();
            return next;
        });
    }, [markChatAsRead]);

    useEffect(() => {
        if (panelVisibility.chat) markChatAsRead();
    }, [panelVisibility.chat, markChatAsRead, chatMessagesForRound.length]);

    const [leftPanelWidth, setLeftPanelWidth] = useNeotroPanelWidth('left');
    const [rightPanelWidth, setRightPanelWidth] = useNeotroPanelWidth('right');
    const resizeSideRef = useRef<'left' | 'right' | null>(null);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);
    const currentWidthRef = useRef({ left: DEFAULT_NEOTRO_PANEL_WIDTH, right: DEFAULT_NEOTRO_PANEL_WIDTH });

    const [isResizing, setIsResizing] = useState(false);

    const handleResizeStart = useCallback((side: 'left' | 'right', e: React.MouseEvent) => {
        e.preventDefault();
        resizeSideRef.current = side;
        startXRef.current = e.clientX;
        startWidthRef.current = side === 'left' ? leftPanelWidth : rightPanelWidth;
        setIsResizing(true);
    }, [leftPanelWidth, rightPanelWidth]);

    useEffect(() => {
        currentWidthRef.current = { left: leftPanelWidth, right: rightPanelWidth };
    }, [leftPanelWidth, rightPanelWidth]);

    useEffect(() => {
        if (!isResizing) return;
        const onMove = (e: MouseEvent) => {
            if (!resizeSideRef.current) return;
            const delta = resizeSideRef.current === 'left' ? e.clientX - startXRef.current : startXRef.current - e.clientX;
            const next = Math.min(MAX_NEOTRO_PANEL_WIDTH, Math.max(MIN_NEOTRO_PANEL_WIDTH, startWidthRef.current + delta));
            if (resizeSideRef.current === 'left') {
                setLeftPanelWidth(next);
                currentWidthRef.current.left = next;
            } else {
                setRightPanelWidth(next);
                currentWidthRef.current.right = next;
            }
        };
        const onUp = () => {
            const side = resizeSideRef.current;
            resizeSideRef.current = null;
            if (side) {
                const val = side === 'left' ? currentWidthRef.current.left : currentWidthRef.current.right;
                writePanelWidth(side, val);
            }
            setIsResizing(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const handleDragDrop = useCallback((points: number) => {
        updateUserSelection(points);
        setTimeout(() => toggleLockUserSelection(), 50);
    }, [updateUserSelection, toggleLockUserSelection]);

    const isDragDisabled = activeUserSelection.locked || activeUserSelection.points === -1 || isObserver || isViewingHistory;
    const CARD_BASE_HEIGHT = 95;
    const desktopScale = totalPlayers <= 4 ? 1.6 : totalPlayers <= 6 ? 1.4 : totalPlayers <= 8 ? 1.2 : totalPlayers <= 12 ? 1.0 : 0.8;
    const scaledCardHeight = CARD_BASE_HEIGHT * desktopScale;
    // In compact mode, show less of each card (smaller visible strip) = more overlap = shorter stack
    const VISIBLE_STRIP = isCompact ? 4 : 10;
    const stackOverlap = scaledCardHeight - VISIBLE_STRIP;

    const [browseMeta, setBrowseMeta] = useState<Record<string, JiraTicketMeta>>({});
    const browseMetaRef = useRef(browseMeta);
    browseMetaRef.current = browseMeta;

    const hookMeta = useJiraTicketMetadata(
      isJiraConfigured ? undefined : teamId,
      rounds,
      displayTicketNumber
    );

    const ticketKeysForMetaDigest = useMemo(() => {
      const fromRounds = rounds
        .map((r) => r.ticket_number)
        .filter((k): k is string => !!k && !isSyntheticRoundTicket(k));
      const current = displayTicketNumber || '';
      return Array.from(
        new Set(
          [...fromRounds, current].filter((k) => k && k !== 'No ticket' && !isSyntheticRoundTicket(k))
        )
      )
        .sort()
        .join(',');
    }, [rounds, displayTicketNumber]);

    const mergeBrowseMetadata = useCallback((meta: Record<string, JiraTicketMeta>) => {
      setBrowseMeta((prev) => ({ ...prev, ...meta }));
    }, []);

    /** Batch fetch for keys not already in browse metadata (realtime rounds, etc.) — keysOnly skips full board JQL. */
    useEffect(() => {
      if (!teamId || !isJiraConfigured) return;
      const keys = ticketKeysForMetaDigest ? ticketKeysForMetaDigest.split(',') : [];
      const keysToFetch = keys.filter((k) => k && !browseMetaRef.current[k]);
      if (keysToFetch.length === 0) return;
      let cancelled = false;
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke('get-jira-board-issues', {
            body: { teamId, includeKeys: keysToFetch, keysOnly: true },
          });
          if (cancelled || error || data?.error) return;
          const next: Record<string, JiraTicketMeta> = {};
          for (const issue of data?.issues || []) {
            if (issue?.key) {
              next[issue.key] = {
                summary: issue.summary ?? undefined,
                storyPoints: issue.storyPoints ?? null,
                issueTypeIconUrl: issue.issueTypeIconUrl,
              };
            }
          }
          if (cancelled || Object.keys(next).length === 0) return;
          browseMetaRef.current = { ...browseMetaRef.current, ...next };
          setBrowseMeta((prev) => ({ ...prev, ...next }));
        } catch {
          /* skip */
        }
      })();
      return () => { cancelled = true; };
    }, [teamId, isJiraConfigured, ticketKeysForMetaDigest]);

    const ticketMetaByKey = isJiraConfigured ? { ...hookMeta, ...browseMeta } : hookMeta;

    const currentPointsLabel = useMemo(() => {
        if (isViewingHistory && currentRound && currentRound.average_points > 0) {
            return Number.isInteger(currentRound.average_points)
                ? `${currentRound.average_points} pts`
                : `${currentRound.average_points.toFixed(1)} pts`;
        }
        if (displaySession.game_state === 'Playing' && displayWinningPoints > 0) {
            return `${displayWinningPoints} pts`;
        }
        const rawForPoints = displayTicketNumber || displaySession?.ticket_number || '';
        const livePoints = !isSyntheticRoundTicket(rawForPoints)
          ? ticketMetaByKey[String(rawForPoints).trim()]?.storyPoints
          : undefined;
        return livePoints != null ? `${livePoints} pts` : null;
    }, [
        isViewingHistory,
        currentRound,
        displaySession.game_state,
        displayWinningPoints,
        ticketMetaByKey,
        displayTicketNumber,
        displaySession?.ticket_number,
    ]);

    const currentTicketKey = displaySession?.ticket_number || displayTicketNumber;
    const currentTicketSummary = useMemo(() => {
        const fromApi = !isSyntheticRoundTicket(currentTicketKey)
          ? ticketMetaByKey[String(currentTicketKey || '').trim()]?.summary
          : undefined;
        if (fromApi) return fromApi;
        const fromSession = (displaySession as { ticket_title?: string | null })?.ticket_title;
        if (fromSession) return fromSession;
        return null;
    }, [ticketMetaByKey, displaySession, currentTicketKey]);

    if (!displaySession || !session) return null;

    const compactTicketStripLabel = displayTicketLabel(displaySession.ticket_number || displayTicketNumber);

    return (
        <div className={`poker-table relative flex flex-col flex-1 min-h-0 ${shake ? 'screen-shake' : ''}`}>
            <RoundSelector
                rounds={rounds}
                session={session}
                displayTicketNumber={displayTicketNumber}
                displaySession={displaySession}
                displayWinningPoints={displayWinningPoints}
                currentRound={currentRound}
                isViewingHistory={isViewingHistory}
                ticketMetaByKey={ticketMetaByKey}
                goToRound={goToRound}
                goToCurrentRound={goToCurrentRound}
                deleteRound={deleteRound}
                isAdmin={userRole === 'admin' || userRole === 'owner'}
                onStartNewRoundRequest={onStartNewRoundRequest}
                onBack={onPokerBack}
                toolbarExtras={pokerToolbarExtras}
                showRoundStrip
                onSettingsClick={() => setIsSettingsOpen(true)}
                isObserver={isObserver}
                onEnterObserverMode={enterObserverMode}
                onLeaveObserverMode={leaveObserverMode}
                chatNewMessageCountByRound={chatNewMessageCountByRound}
            />

            <div className="flex flex-1 min-h-0 overflow-hidden relative">
                {isJiraConfigured && (
                    <>
                        <div
                            className="absolute left-0 top-0 bottom-0 z-10 overflow-hidden transition-[width] duration-200 ease-out"
                            style={{ width: panelVisibility.jiraBrowser ? leftPanelWidth : 0 }}
                            aria-hidden={!panelVisibility.jiraBrowser}
                        >
                            <div
                                className="relative flex h-full flex-col"
                                style={{ width: leftPanelWidth }}
                            >
                                <div className="flex flex-grow flex-col justify-end overflow-hidden pr-4 pb-4 pt-4">
                                    <QueuePanelCard
                                        teamId={teamId}
                                        rounds={rounds}
                                        addTicketToQueue={addTicketToQueue}
                                        addTicketsToQueueBatch={addTicketsToQueueBatch}
                                        displayTicketNumber={displayTicketNumber}
                                        setDisplayTicketNumber={setDisplayTicketNumber}
                                        updateTicketNumber={updateTicketNumber}
                                        isJiraConfigured={isJiraConfigured}
                                        showJiraBrowser={true}
                                        onMetadataFromBrowse={mergeBrowseMetadata}
                                        onResizeStart={(e) => handleResizeStart('left', e)}
                                        className="rounded-l-none"
                                    />
                                    {panelVisibility.jiraBrowser && (
                                        <button
                                            type="button"
                                            onClick={() => togglePanel('jiraBrowser')}
                                            className="absolute right-2 top-1/2 z-20 flex h-10 w-6 -translate-y-1/2 items-center justify-center rounded-r-md border bg-card/90 shadow-md transition-colors hover:bg-accent/50"
                                            aria-label="Collapse Jira panel"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        {!panelVisibility.jiraBrowser && (
                            <button
                                type="button"
                                onClick={() => togglePanel('jiraBrowser')}
                                className="absolute left-0 top-1/2 z-20 flex h-24 w-8 -translate-y-1/2 items-center justify-center rounded-r-lg border bg-card/80 shadow-md transition-colors hover:bg-accent/50"
                                aria-label="Open Jira panel"
                            >
                                <Search className="h-4 w-4" />
                            </button>
                        )}
                    </>
                )}

                <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden pt-2 px-4 pb-4">
                    {(displaySession.game_state === 'Playing' ||
                        !isViewingHistory ||
                        (isViewingHistory && isCompact)) && (
                        <div className={`flex flex-col items-center shrink-0 flex-none ${isCompact ? 'gap-1 pb-2' : 'gap-2 pb-4'}`}>
                            <div className={`flex flex-col shrink-0 ${isCompact ? 'w-full max-w-md gap-1' : 'w-64 gap-2'}`}>
                                {isCompact && !isViewingHistory && displaySession.game_state !== 'Playing' ? (
                                    <div className="flex flex-row items-stretch gap-2 w-full">
                                        <PlayHandButton
                                            onHandPlayed={playHand}
                                            isHandPlayed={false}
                                            className="flex-1 min-w-0"
                                        />
                                        {teamId &&
                                        isJiraConfigured &&
                                        !isSyntheticRoundTicket(displaySession.ticket_number || displayTicketNumber) ? (
                                            <JiraIssueDrawer
                                                issueIdOrKey={(displaySession.ticket_number || displayTicketNumber)!}
                                                teamId={teamId}
                                                trigger={
                                                    <TicketDetailsNeotroButton className="flex-1 min-w-0" />
                                                }
                                            />
                                        ) : (
                                            <TicketDetailsNeotroButton
                                                disabled
                                                className="flex-1 min-w-0"
                                                title={
                                                    !teamId || !isJiraConfigured
                                                        ? 'Jira is not available'
                                                        : 'Select a ticket first'
                                                }
                                            />
                                        )}
                                    </div>
                                ) : isCompact &&
                                  (isViewingHistory ||
                                      (!isViewingHistory && displaySession.game_state === 'Playing')) ? (
                                    <div className="relative flex w-full flex-row items-center gap-2 rounded-lg bg-card/50 px-3 py-1.5">
                                        {teamId &&
                                        isJiraConfigured &&
                                        !isSyntheticRoundTicket(displaySession.ticket_number || displayTicketNumber) && (
                                            <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
                                                <JiraIssueDrawer
                                                    issueIdOrKey={(displaySession.ticket_number || displayTicketNumber)!}
                                                    teamId={teamId}
                                                    trigger={
                                                        <NeotroPressableButton
                                                            variant="emerald"
                                                            size="sm"
                                                            activeShowsPressed={false}
                                                            aria-label="Expand Jira issue"
                                                            title="Issue details"
                                                        >
                                                            <Maximize2 className="h-4 w-4" />
                                                        </NeotroPressableButton>
                                                    }
                                                />
                                            </div>
                                        )}
                                        <div
                                            className={`flex min-w-0 flex-1 items-center justify-center gap-2 ${
                                                teamId &&
                                                isJiraConfigured &&
                                                !isSyntheticRoundTicket(displaySession.ticket_number || displayTicketNumber)
                                                    ? 'pr-10'
                                                    : ''
                                            }`}
                                        >
                                            <span className="shrink-0 text-sm text-muted-foreground">
                                                {isViewingHistory ? 'Viewing:' : 'Now Pointing:'}
                                            </span>
                                            <span
                                                className="min-w-0 truncate text-center font-semibold text-foreground"
                                                title={currentTicketSummary || compactTicketStripLabel}
                                            >
                                                {compactTicketStripLabel}
                                            </span>
                                        </div>
                                    </div>
                                ) : !isCompact ? (
                                <div className="relative flex flex-col gap-1 bg-card/50 rounded-lg overflow-visible px-4 py-2.5">
                                    {teamId &&
                                    !isSyntheticRoundTicket(displaySession.ticket_number || displayTicketNumber) && (
                                        <div className="absolute top-2 right-2">
                                            <JiraIssueDrawer
                                                issueIdOrKey={(displaySession.ticket_number || displayTicketNumber)!}
                                                teamId={teamId}
                                                trigger={
                                                    <NeotroPressableButton
                                                        variant="emerald"
                                                        size="sm"
                                                        activeShowsPressed={false}
                                                        aria-label="Expand Jira issue"
                                                        title="Issue details"
                                                    >
                                                        <Maximize2 className="h-4 w-4" />
                                                    </NeotroPressableButton>
                                                }
                                            />
                                        </div>
                                    )}
                                    <div className="flex items-center justify-center gap-2 pr-8 shrink-0 pt-0.5 pb-1">
                                        <span className="text-sm text-muted-foreground leading-[1.75]">
                                            {isViewingHistory ? 'Viewing:' : 'Now Pointing:'}
                                        </span>
                                        {!isViewingHistory && displaySession.game_state !== 'Playing' ? (
                                            <input
                                                type="text"
                                                value={displayTicketNumber || ''}
                                                onChange={(e) => handleTicketNumberChange(e.target.value)}
                                                onFocus={handleTicketNumberFocus}
                                                onBlur={handleTicketNumberBlur}
                                                placeholder={`Round ${displaySession.round_number ?? session?.current_round_number ?? 1}`}
                                                className="font-semibold text-foreground leading-[1.75] bg-transparent border-b border-transparent hover:border-muted-foreground/30 focus:border-primary focus:outline-none min-w-[6rem] text-center"
                                            />
                                        ) : (
                                            <span className="font-semibold text-foreground leading-[1.75]">
                                                {displayTicketLabel(displaySession.ticket_number || displayTicketNumber)}
                                            </span>
                                        )}
                                    </div>
                                    {currentTicketSummary && (
                                        <span className="text-sm font-normal text-muted-foreground italic text-center line-clamp-2">
                                            {currentTicketSummary}
                                        </span>
                                    )}
                                </div>
                                ) : null}
                                {displaySession.game_state === 'Playing' && (
                                    <div className={`relative flex items-center justify-center w-full pr-8 pt-0.5 pb-1`}>
                                        <div className={`flex items-center justify-center gap-2 bg-primary/20 rounded-lg flex-1 min-w-0 ${isCompact ? 'px-3 py-1' : 'px-4 py-2'}`}>
                                            <span className="text-sm text-muted-foreground">Winning Points:</span>
                                            <span className={`font-bold ${isCompact ? 'text-base' : 'text-xl'}`}>{displayWinningPoints} pts</span>
                                        </div>
                                        {!isObserver && (
                                            <div className="absolute right-0 top-1/2 -translate-y-1/2">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <NeotroPressableButton
                                                                size="sm"
                                                                activeShowsPressed={false}
                                                                aria-label="Replay"
                                                                title="Replay round"
                                                                onClick={replayRound}
                                                            >
                                                                <RotateCcw className="h-4 w-4" />
                                                            </NeotroPressableButton>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Replay</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {!isViewingHistory && (
                                    displaySession.game_state === 'Playing' ? (
                                        <div className={`flex items-center justify-center ${isCompact ? 'py-1' : 'gap-2 py-2'}`}>
                                            <NextRoundButton
                                                onHandPlayed={onNextRoundRequest}
                                                isHandPlayed={true}
                                                className="w-full"
                                            />
                                        </div>
                                    ) : !isCompact ? (
                                        <PlayHandButton
                                            onHandPlayed={playHand}
                                            isHandPlayed={false}
                                            className="w-full"
                                        />
                                    ) : null
                                )}
                            </div>
                        </div>
                    )}
                    <DragToPlayProvider onDrop={handleDragDrop} disabled={isDragDisabled}>
                    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
                        <div className="my-auto flex flex-col items-center gap-2 w-full min-h-0">
                            <div className="relative min-h-0 w-full overflow-hidden flex flex-col items-center">
                                <DropZoneOverlay />
                        {displaySession.game_state === 'Playing' && cardGroups ? (
                            <TooltipProvider>
                            <div className={`flex flex-wrap items-end justify-center ${isCompact ? 'gap-x-4 gap-y-2' : 'gap-x-6 gap-y-4'}`}>
                                {cardGroups.map(({ points, selections }) => (
                                    <div key={points} className={`flex flex-col items-center ${isCompact ? 'space-y-1' : 'space-y-2'}`}>
                                        <div className="flex flex-col items-center">
                                            {(isCompact ? selections.slice(0, 1) : selections).map((selection, index) => (
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
                                        <div className={`text-center font-bold text-foreground bg-card/75 rounded-full ${isCompact ? 'text-sm px-3 py-0.5' : 'text-lg px-4 py-1'}`}>
                                            {selections.length} x {points === -1 ? 'Abstain' : `${points} pts`}
                                        </div>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className={`flex flex-col items-center cursor-default ${isCompact ? 'gap-0' : ''}`}>
                                                    {selections.length > 1 ? (
                                                        isCompact ? (
                                                            selections.length === 2 ? (
                                                                <>
                                                                    <span className="text-muted-foreground text-[10px]">{selections[0].name}</span>
                                                                    <span className="text-muted-foreground text-[10px]">{selections[1].name}</span>
                                                                </>
                                                            ) : (
                                                                <span className="text-muted-foreground text-[10px]">
                                                                    {selections[0].name}
                                                                    <span className="font-medium text-primary/80"> +{selections.length - 1}</span>
                                                                </span>
                                                            )
                                                        ) : (
                                                            <>
                                                                {selections.slice(0, 4).map((s) => (
                                                                    <span key={s.userId} className="text-muted-foreground text-xs">{s.name}</span>
                                                                ))}
                                                                {selections.length > 4 && (
                                                                    selections.length === 5 ? (
                                                                        <span className="text-muted-foreground text-xs">{selections[4].name}</span>
                                                                    ) : (
                                                                        <span className="font-medium text-primary/80 text-xs">+{selections.length - 4}</span>
                                                                    )
                                                                )}
                                                            </>
                                                        )
                                                    ) : (
                                                        <span className={`text-muted-foreground ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                                                            {selections[0].name}
                                                        </span>
                                                    )}
                                                </div>
                                            </TooltipTrigger>
                                            {selections.length > 1 && (
                                                <TooltipContent>
                                                    <p className="font-medium">{selections.length} x {points === -1 ? 'Abstain' : `${points} pts`}</p>
                                                    <ul className="list-disc list-inside mt-1 text-sm">
                                                        {selections.map((s) => (
                                                            <li key={s.userId}>{s.name}</li>
                                                        ))}
                                                    </ul>
                                                </TooltipContent>
                                            )}
                                        </Tooltip>
                                    </div>
                                ))}
                            </div>
                            </TooltipProvider>
                        ) : (
                            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 max-w-full">
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
                        <div className={`flex-shrink-0 flex items-center justify-center ${isCompact ? 'p-2 gap-2 flex-row flex-wrap' : 'p-4 pt-2 gap-2 flex-col'}`}>
                            <div className={isCompact ? 'flex flex-row flex-wrap items-center justify-center gap-2' : 'flex flex-col gap-2 w-full max-w-sm'}>
                                <SubmitPointsToJira
                                    teamId={teamId}
                                    ticketNumber={displaySession.ticket_number || displayTicketNumber}
                                    winningPoints={displayWinningPoints}
                                    isHandPlayed={true}
                                    isJiraConfigured={isJiraConfigured}
                                    compact={isCompact}
                                />
                                <NeotroPressableButton
                                    onClick={handleSendToSlack}
                                    isDisabled={!isSlackInstalled || isSending}
                                    isActive={isSlackInstalled && !isSending}
                                    activeShowsPressed={false}
                                    size="default"
                                    className={isCompact ? 'shrink-0' : 'w-full'}
                                >
                                    <Send className="h-4 w-4 mr-2" />
                                    {isSending ? 'Sending...' : 'Send to Slack'}
                                </NeotroPressableButton>
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
                                isAbstainedDisabled={false}
                            />
                        </div>
                    ) : !isViewingHistory && isObserver ? (
                        <div className="flex-shrink-0 flex items-center justify-center p-4">
                            <div className="flex items-center gap-2 text-muted-foreground rounded-lg bg-card/50 border border-primary/20 px-6 py-4">
                                <Eye className="h-5 w-5" />
                                <span className="text-sm font-medium">You are an observer</span>
                            </div>
                        </div>
                    ) : null}
                        </div>
                    </div>
                    </DragToPlayProvider>
                </div>
                {panelVisibility.chat ? (
                    <div className="absolute right-0 top-0 bottom-0 flex flex-col z-10" style={{ width: rightPanelWidth }}>
                        <div className="flex-1 min-w-0 h-full flex flex-col justify-end pl-4 pt-4 pb-4 relative">
                            <PokerSessionChat onResizeStart={(e) => handleResizeStart('right', e)} wrapperClassName="rounded-r-none" />
                            <button
                                type="button"
                                onClick={() => togglePanel('chat')}
                                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-10 w-6 flex items-center justify-center rounded-l-md border bg-card/90 shadow-md hover:bg-accent/50 transition-colors"
                                aria-label="Collapse chat panel"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => { togglePanel('chat'); markChatAsRead(); }}
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-24 w-8 flex items-center justify-center rounded-l-lg border bg-card/80 shadow-md hover:bg-accent/50 transition-colors relative"
                        aria-label="Open chat panel"
                    >
                        <MessageCircle className="h-4 w-4" />
                        {chatUnreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[1rem] px-1 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-medium">
                                {chatUnreadCount > 9 ? '9+' : String(chatUnreadCount)}
                            </span>
                        )}
                    </button>
                )}
            </div>

            <PokerConfig
                config={{
                    presence_enabled: 'presence_enabled' in session && session.presence_enabled,
                    send_to_slack: 'send_to_slack' in session && session.send_to_slack,
                    spotlight_follow_enabled: session.spotlight_follow_enabled !== false,
                    observer_ids: (session as { observer_ids?: string[] }).observer_ids,
                    selections: session.selections,
                    team_id: teamId,
                }}
                onUpdateConfig={updateSessionConfig}
                onDeleteAllRounds={deleteAllRounds}
                isSlackIntegrated={isSlackInstalled}
                userRole={userRole}
                teamId={teamId}
                open={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
            />
        </div>
    );
} 