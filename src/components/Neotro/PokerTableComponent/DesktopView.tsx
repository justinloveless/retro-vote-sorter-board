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
import { NeotroPressableButton } from '@/components/Neotro/NeotroPressableButton';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Send, Maximize2, Eye, GripVertical, RotateCcw } from 'lucide-react';
import { PlayerSelection } from '@/hooks/usePokerSession';
import SubmitPointsToJira from '@/components/Neotro/SubmitPointsToJira';
import { JiraIssueDrawer } from '@/components/Neotro/JiraIssueDrawer';
import { EmbeddedTicketQueue } from '@/components/Neotro/EmbeddedTicketQueue';
import { supabase } from '@/integrations/supabase/client';
import { useIsCompactViewport } from '@/hooks/use-compact-viewport';
import { PokerBottomBar, type PanelVisibility } from '@/components/Neotro/PokerBottomBar';
import { RoundSelector } from '@/components/Neotro/RoundSelector';

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
  isJiraConfigured,
  showJiraBrowser = true,
  showQueue = true,
  onResizeStart,
}: {
  teamId: string | undefined;
  ticketQueue: { id: string; ticket_key: string; ticket_summary: string | null; position: number; team_id?: string; added_by?: string | null; created_at?: string }[];
  addTicketToQueue: (key: string, summary: string | null) => Promise<void>;
  removeTicketFromQueue: (id: string) => Promise<void>;
  reorderQueue: (items: { id: string; ticket_key: string; ticket_summary: string | null; position: number; team_id?: string; added_by?: string | null; created_at?: string }[]) => Promise<void>;
  clearQueue: () => Promise<void>;
  displayTicketNumber: string;
  setDisplayTicketNumber: (key: string) => void;
  updateTicketNumber: (key: string) => void;
  isJiraConfigured: boolean;
  showJiraBrowser?: boolean;
  showQueue?: boolean;
  onResizeStart?: (e: React.MouseEvent) => void;
}) {
  return (
    <Card className="relative h-full flex flex-col">
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
            teamId={teamId}
            isJiraConfigured={isJiraConfigured}
            showJiraBrowser={showJiraBrowser}
            showQueue={showQueue}
            queue={ticketQueue as any}
            onAddTicket={addTicketToQueue}
            onRemoveTicket={removeTicketFromQueue}
            onReorderQueue={reorderQueue as any}
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
        ticketQueue,
        addTicketToQueue,
        removeTicketFromQueue,
        reorderQueue,
        clearQueue,
        isJiraConfigured,
        updateTicketNumber,
        chatUnreadCount,
        markChatAsRead,
        chatMessagesForRound,
        deleteRound,
    } = usePokerTable();

    const isCompact = useIsCompactViewport();
    const [panelVisibility, setPanelVisibility] = useState<PanelVisibility>({
        chat: true,
        queue: true,
        jiraBrowser: true,
        roundSelector: true,
        settings: true,
    });
    const togglePanel = useCallback((panel: keyof PanelVisibility) => {
        setPanelVisibility((prev) => {
            const next = { ...prev, [panel]: !prev[panel] };
            if (panel === 'chat' && next.chat) markChatAsRead();
            return next;
        });
    }, [markChatAsRead]);

    useEffect(() => {
        if (panelVisibility.chat) markChatAsRead();
    }, [panelVisibility.chat, markChatAsRead, chatMessagesForRound.length]);

    const PANEL_WIDTH_KEY = 'neotro-panel-width';
    const DEFAULT_PANEL_WIDTH = 320;
    const MIN_PANEL_WIDTH = 240;
    const MAX_PANEL_WIDTH = 480;
    const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
        if (typeof window === 'undefined') return DEFAULT_PANEL_WIDTH;
        const stored = localStorage.getItem(`${PANEL_WIDTH_KEY}-left`);
        return stored ? Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Number(stored))) : DEFAULT_PANEL_WIDTH;
    });
    const [rightPanelWidth, setRightPanelWidth] = useState(() => {
        if (typeof window === 'undefined') return DEFAULT_PANEL_WIDTH;
        const stored = localStorage.getItem(`${PANEL_WIDTH_KEY}-right`);
        return stored ? Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Number(stored))) : DEFAULT_PANEL_WIDTH;
    });
    const resizeSideRef = useRef<'left' | 'right' | null>(null);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);
    const currentWidthRef = useRef({ left: DEFAULT_PANEL_WIDTH, right: DEFAULT_PANEL_WIDTH });

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
            const next = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startWidthRef.current + delta));
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
                localStorage.setItem(`${PANEL_WIDTH_KEY}-${side}`, String(val));
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
    const CARD_BASE_HEIGHT = 95;
    const desktopScale = totalPlayers <= 4 ? 1.6 : totalPlayers <= 6 ? 1.4 : totalPlayers <= 8 ? 1.2 : totalPlayers <= 12 ? 1.0 : 0.8;
    const scaledCardHeight = CARD_BASE_HEIGHT * desktopScale;
    // In compact mode, show less of each card (smaller visible strip) = more overlap = shorter stack
    const VISIBLE_STRIP = isCompact ? 4 : 10;
    const stackOverlap = scaledCardHeight - VISIBLE_STRIP;

    const [ticketMetaByKey, setTicketMetaByKey] = useState<Record<string, { issueTypeIconUrl?: string; storyPoints?: number | null; summary?: string }>>({});

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

    if (!displaySession || !session) return null;

    return (
        <div className={`poker-table relative flex flex-col flex-1 min-h-0 ${shake ? 'screen-shake' : ''}`}>
            {panelVisibility.roundSelector && (
                <RoundSelector
                    rounds={rounds}
                    session={session}
                    displayTicketNumber={displayTicketNumber}
                    displaySession={displaySession}
                    displayWinningPoints={displayWinningPoints}
                    currentRound={currentRound}
                    isViewingHistory={isViewingHistory}
                    teamId={teamId}
                    ticketQueue={ticketQueue}
                    goToRound={goToRound}
                    goToCurrentRound={goToCurrentRound}
                    deleteRound={deleteRound}
                    isAdmin={userRole === 'admin' || userRole === 'owner'}
                    onStartNewRoundRequest={onStartNewRoundRequest}
                />
            )}

            <div className="flex flex-1 min-h-0 overflow-hidden relative">
                {(panelVisibility.queue || (panelVisibility.jiraBrowser && isJiraConfigured)) && (
                <div className="absolute left-0 top-0 bottom-0 flex flex-col z-10" style={{ width: leftPanelWidth }}>
                    <div className="flex-grow overflow-hidden flex flex-col h-full justify-end p-4">
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
                                isJiraConfigured={isJiraConfigured}
                                showJiraBrowser={panelVisibility.jiraBrowser}
                                showQueue={panelVisibility.queue}
                                onResizeStart={(e) => handleResizeStart('left', e)}
                            />
                    </div>
                </div>
                )}

                <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden p-4">
                    {(displaySession.game_state === 'Playing' || !isViewingHistory) && (
                        <div className={`flex flex-col items-center shrink-0 flex-none ${isCompact ? 'gap-1 pb-2' : 'gap-2 pb-4'}`}>
                            <div className={`flex flex-col shrink-0 w-64 ${isCompact ? 'gap-1' : 'gap-2'}`}>
                                <div className={`relative flex flex-col gap-1 bg-card/50 rounded-lg overflow-visible ${isCompact ? 'px-3 py-1.5' : 'px-4 py-2.5'}`}>
                                    {teamId && (displaySession.ticket_number || displayTicketNumber) && (
                                        <div className="absolute top-2 right-2">
                                            <JiraIssueDrawer
                                                issueIdOrKey={(displaySession.ticket_number || displayTicketNumber)!}
                                                teamId={teamId}
                                                trigger={
                                                    <NeotroPressableButton
                                                        size="sm"
                                                        activeShowsPressed={false}
                                                        aria-label="Expand Jira issue"
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
                                                placeholder="No ticket"
                                                className="font-semibold text-foreground leading-[1.75] bg-transparent border-b border-transparent hover:border-muted-foreground/30 focus:border-primary focus:outline-none min-w-[6rem] text-center"
                                            />
                                        ) : (
                                            <span className="font-semibold text-foreground leading-[1.75]">
                                                {displaySession.ticket_number || displayTicketNumber || 'No ticket'}
                                            </span>
                                        )}
                                    </div>
                                    {currentTicketSummary && (
                                        <span className={`text-sm font-normal text-muted-foreground italic text-center ${isCompact ? 'line-clamp-1' : 'line-clamp-2'}`}>
                                            {currentTicketSummary}
                                        </span>
                                    )}
                                </div>
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
                                    ) : (
                                        <PlayHandButton
                                            onHandPlayed={playHand}
                                            isHandPlayed={false}
                                            className="w-full"
                                        />
                                    )
                                )}
                            </div>
                        </div>
                    )}
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col items-center justify-end pb-2">
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
                {panelVisibility.chat && (
                <div className="absolute right-0 top-0 bottom-0 flex flex-col z-10" style={{ width: rightPanelWidth }}>
                    <div className="flex-1 min-w-0 h-full flex flex-col justify-end p-4">
                        <PokerSessionChat onResizeStart={(e) => handleResizeStart('right', e)} />
                    </div>
                </div>
                )}
            </div>

            <div className="flex-shrink-0 w-full min-w-0">
                <TooltipProvider>
                    <PokerBottomBar
                        visibility={panelVisibility}
                        onToggle={togglePanel}
                        isJiraConfigured={isJiraConfigured}
                        chatUnreadCount={chatUnreadCount}
                        onSettingsClick={() => setIsSettingsOpen(true)}
                        isObserver={isObserver}
                        isViewingHistory={isViewingHistory}
                        onEnterObserverMode={enterObserverMode}
                        onLeaveObserverMode={leaveObserverMode}
                    />
                </TooltipProvider>
            </div>
            <PokerConfig
                config={{
                    presence_enabled: 'presence_enabled' in session && session.presence_enabled,
                    send_to_slack: 'send_to_slack' in session && session.send_to_slack,
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