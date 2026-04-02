import React, { useState, useCallback, useMemo } from 'react';
import { usePokerTable } from './context';
import CardHandSelector from "@/components/Neotro/CardHandSelector";
import PlayingCard from "@/components/Neotro/PlayingCards/PlayingCard";
import PlayHandButton from "@/components/Neotro/PlayHandButton";
import CardState from "@/components/Neotro/PlayingCards/CardState";
import PointsDetails from "@/components/Neotro/PointDetails";
import NextRoundButton from "@/components/Neotro/NextRoundButton";
import { RoundSelector } from '@/components/Neotro/RoundSelector';
import { PlayingFieldRoundSlide } from '@/components/Neotro/PlayingFieldRoundSlide';
import { PokerSessionChat } from "@/components/shared/PokerSessionChat";
import { PokerConfig } from '../PokerConfig';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Send, Eye, Maximize2, RotateCcw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import useWindowSize from '@/hooks/use-window-size';
import { useIsCompactViewport } from '@/hooks/use-compact-viewport';
import SubmitPointsToJira from '@/components/Neotro/SubmitPointsToJira';
import { PokerBottomBar, type PanelVisibility } from '@/components/Neotro/PokerBottomBar';
import { JiraIssueDrawer } from '@/components/Neotro/JiraIssueDrawer';
import { NeotroPressableButton } from '@/components/Neotro/NeotroPressableButton';
import { TicketDetailsNeotroButton } from '@/components/Neotro/TicketDetailsNeotroButton';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import { DragToPlayProvider, DropZoneOverlay } from '@/components/Neotro/DragToPlay';
import { useJiraTicketMetadata } from '@/hooks/use-jira-ticket-metadata';
import { displayTicketLabel, isSyntheticRoundTicket } from '@/lib/pokerRoundTicketPlaceholder';

const getGridColumns = (playerCount: number) => {
    if (playerCount <= 2) return 'grid-cols-2';
    if (playerCount <= 6) return 'grid-cols-3';
    if (playerCount <= 8) return 'grid-cols-4';
    return 'grid-cols-4';
};

export const MobileView: React.FC = () => {
    const {
        shake,
        isDrawerOpen,
        setIsDrawerOpen,
        isChatDrawerOpen,
        setIsChatDrawerOpen,
        handleSendToSlack,
        isSlackInstalled,
        isSending,
        currentRound,
        currentRoundIndex,
        rounds,
        isViewingHistory,
        goToCurrentRound,
        goToRound,
        session,
        updateSessionConfig,
        deleteAllRounds,
        displaySession,
        displayWinningPoints,
        replayRound,
        cardGroups,
        activeUserSelection,
        totalPlayers,
        presentUserIds,
        playHand,
        nextRound,
        pointOptions,
        handlePointChange,
        toggleLockUserSelection,
        toggleAbstainUserSelection,
        updateUserSelection,
        lockInUserSelectionAtPoints,
        displayTicketNumber,
        handleTicketNumberChange,
        handleTicketNumberFocus,
        handleTicketNumberBlur,
        teamId,
        activeUserId,
        userRole,
        onNextRoundRequest,
        onEndRoundOnly,
        onStartNewRoundRequest,
        setQueuePanelOpen,
        isQueuePanelOpen,
        isJiraConfigured,
        isObserver,
        leaveObserverMode,
        enterObserverMode,
        chatUnreadCount,
        chatNewMessageCountByRound,
        markChatAsRead,
        goToPreviousRound,
        goToNextRound,
        canGoBack,
        canGoForward,
        deleteRound,
        onPokerBack,
        pokerToolbarExtras,
    } = usePokerTable();
    const { height } = useWindowSize();

    const activeRoundsSorted = useMemo(
        () => rounds.filter((r) => r.is_active).slice().sort((a, b) => a.round_number - b.round_number),
        [rounds]
    );

    const selectedRoundNumber =
        currentRound?.round_number ??
        session?.current_round_number ??
        session?.round_number ??
        1;

    const isOnLastActiveRound =
        !isViewingHistory &&
        activeRoundsSorted.length >= 1 &&
        activeRoundsSorted[activeRoundsSorted.length - 1]?.round_number === selectedRoundNumber;

    const isCompact = useIsCompactViewport();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    

    const handleDragDrop = useCallback((points: number) => {
        lockInUserSelectionAtPoints(points);
    }, [lockInUserSelectionAtPoints]);

    const isDragDisabled = activeUserSelection.locked || activeUserSelection.points === -1 || isObserver || isViewingHistory;

    const handleSwipeLeft = useCallback(() => {
        if (canGoForward) goToNextRound();
    }, [canGoForward, goToNextRound]);
    const handleSwipeRight = useCallback(() => {
        if (canGoBack) goToPreviousRound();
    }, [canGoBack, goToPreviousRound]);
    const { dragStyle, ...swipeHandlers } = useSwipeNavigation({
        onSwipeLeft: handleSwipeLeft,
        onSwipeRight: handleSwipeRight,
    });

    const togglePanel = useCallback((panel: keyof PanelVisibility) => {
        if (panel === 'details') setIsDrawerOpen((prev) => !prev);
        else if (panel === 'chat') {
            setIsChatDrawerOpen((prev) => !prev);
            if (!isChatDrawerOpen) markChatAsRead();
        } else if (panel === 'queue' || panel === 'jiraBrowser') setQueuePanelOpen((prev) => !prev);
        else if (panel === 'settings') setIsSettingsOpen(true);
    }, [setIsDrawerOpen, setIsChatDrawerOpen, setQueuePanelOpen, isChatDrawerOpen, markChatAsRead]);

    const currentTicketKey = displaySession?.ticket_number || displayTicketNumber;
    const currentTicketSummary = useMemo(() => {
        const fromSession = (displaySession as { ticket_title?: string | null })?.ticket_title;
        if (fromSession) return fromSession;
        return null;
    }, [displaySession, currentTicketKey]);

    const CARD_BASE_HEIGHT = 95;
    const mobileScale = totalPlayers <= 4 ? 1.4 : totalPlayers <= 6 ? 1.2 : totalPlayers <= 8 ? 1.0 : 0.8;
    const scaledCardHeight = CARD_BASE_HEIGHT * mobileScale;
    const VISIBLE_STRIP = 8;
    const stackOverlap = scaledCardHeight - VISIBLE_STRIP;

    const ticketMetaByKey = useJiraTicketMetadata(teamId, rounds, displayTicketNumber, session?.session_id);

    const compactTicketStripLabel = useMemo(
        () => displayTicketLabel(displaySession?.ticket_number || displayTicketNumber),
        [displaySession?.ticket_number, displayTicketNumber]
    );

    const compactTicketStripTooltip = useMemo(() => {
        const key = String(currentTicketKey || '').trim();
        const fromApi = !isSyntheticRoundTicket(key) ? ticketMetaByKey[key]?.summary : undefined;
        if (fromApi) return fromApi;
        const fromSession = (displaySession as { ticket_title?: string | null })?.ticket_title;
        if (fromSession) return fromSession;
        return compactTicketStripLabel;
    }, [ticketMetaByKey, displaySession, currentTicketKey, compactTicketStripLabel]);

    if (!displaySession || !session) return null;

    return (
        <div className={`poker-table relative flex flex-col h-full ${shake ? 'screen-shake' : ''}`}>
            {/* TODO: Refactor this to avoid code duplication */}
            {height < 750 ? (
                <>
                <ScrollArea className="flex-1 pr-4 overflow-x-hidden" {...swipeHandlers}>
                    {/* Mobile Round Selector */}
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
                        isMobile={true}
                        onBack={onPokerBack}
                        toolbarExtras={pokerToolbarExtras}
                        chatNewMessageCountByRound={chatNewMessageCountByRound}
                    />

                    {/* Mobile Main Content (short viewport) */}
                    <div className="flex-1 flex flex-col pt-1 px-4 pb-4" style={dragStyle}>
                        <PlayingFieldRoundSlide roundIndex={currentRoundIndex}>
                            <div className="flex flex-col items-center shrink-0 flex-none gap-1 pb-3">
                                <div className="flex flex-col shrink-0 w-full max-w-xs gap-1">
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
                                                    pokerSessionId={session.session_id}
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
                                                    pokerSessionId={session.session_id}
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
                                                title={compactTicketStripTooltip}
                                            >
                                                {compactTicketStripLabel}
                                            </span>
                                        </div>
                                    </div>
                                    ) : !isCompact ? (
                                    <div className="relative flex flex-col gap-1 bg-card/50 rounded-lg overflow-visible px-3 py-1.5">
                                        {teamId &&
                                        !isSyntheticRoundTicket(displaySession.ticket_number || displayTicketNumber) && (
                                            <div className="absolute top-2 right-2">
                                                <JiraIssueDrawer
                                                    issueIdOrKey={(displaySession.ticket_number || displayTicketNumber)!}
                                                    teamId={teamId}
                                                    pokerSessionId={session.session_id}
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
                                            <span className="text-sm font-normal text-muted-foreground italic text-center line-clamp-1">
                                                {currentTicketSummary}
                                            </span>
                                        )}
                                    </div>
                                    ) : null}
                                    {displaySession.game_state === 'Playing' && (
                                        <div className="relative flex items-center justify-center w-full pr-8 pt-0.5 pb-1">
                                            <div className="flex items-center justify-center gap-2 bg-primary/20 rounded-lg flex-1 min-w-0 px-3 py-1">
                                                <span className="text-sm text-muted-foreground">Winning Points:</span>
                                                <span className="font-bold text-base">{displayWinningPoints} pts</span>
                                            </div>
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
                                        </div>
                                    )}
                                    {!isViewingHistory && (
                                        displaySession.game_state === 'Playing' ? (
                                            <div className="flex items-center justify-center py-1">
                                                {isOnLastActiveRound ? (
                                                    <div className="flex w-full items-center justify-center gap-2">
                                                        <NextRoundButton
                                                            onHandPlayed={onEndRoundOnly}
                                                            isHandPlayed={displaySession.game_state === 'Playing'}
                                                            className="w-full"
                                                            label="End round"
                                                            systemMessagePrefix="Round ended by"
                                                        />
                                                        <NextRoundButton
                                                            onHandPlayed={() => {
                                                                onEndRoundOnly();
                                                                onStartNewRoundRequest();
                                                            }}
                                                            isHandPlayed={displaySession.game_state === 'Playing'}
                                                            className="w-full"
                                                            label="End + start another"
                                                            systemMessagePrefix="Round ended by"
                                                        />
                                                    </div>
                                                ) : (
                                                    <NextRoundButton
                                                        onHandPlayed={onNextRoundRequest}
                                                        isHandPlayed={displaySession.game_state === 'Playing'}
                                                        className="w-full"
                                                        label="Next Round"
                                                        systemMessagePrefix="Round completed by"
                                                    />
                                                )}
                                            </div>
                                        ) : !isCompact ? (
                                            <div className="flex items-center justify-center py-1">
                                                <PlayHandButton
                                                    onHandPlayed={playHand}
                                                    isHandPlayed={false}
                                                    className="w-full"
                                                />
                                            </div>
                                        ) : null
                                    )}
                                </div>
                            </div>

                        {/* Cards Area */}
                        <DragToPlayProvider onDrop={handleDragDrop} disabled={isDragDisabled}>
                        <div className="relative flex-1 flex items-center justify-center min-h-0 mb-6">
                            <DropZoneOverlay />
                            {displaySession.game_state === 'Playing' && cardGroups ? (
                                <div className="flex flex-wrap items-end justify-center gap-x-4 gap-y-3">
                                    {cardGroups.map(({ points, selections }) => (
                                        <div key={points} className="flex flex-col items-center space-y-2">
                                            <div className="flex flex-col items-center">
                                                {selections.map((selection, index) => (
                                                    <div key={selection.userId}
                                                        className="relative transition-all duration-200 hover:-translate-y-1 hover:z-50"
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
                                            <div className="text-center font-bold text-sm text-foreground bg-card/75 rounded-full px-3 py-1">
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
                                <div className={`grid ${getGridColumns(totalPlayers)} gap-x-2 gap-y-8 max-w-full w-full justify-items-center`}>
                                    {Object.entries(displaySession.selections).map(([userId, selection]) => (
                                        <div key={userId} className="flex flex-col items-center">
                                            <PlayingCard
                                                cardState={displaySession.game_state === 'Playing' ? CardState.Played : ((selection as any).locked ? CardState.Locked : CardState.Selection)}
                                                playerName={(selection as any).name}
                                                pointsSelected={(selection as any).points}
                                                isPresent={presentUserIds.includes(userId)}
                                                totalPlayers={totalPlayers}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {displaySession.game_state === 'Playing' && (
                            <div className="flex flex-col items-center gap-1 pb-2">
                                <div className="flex flex-col w-full max-w-xs gap-1">
                                    <SubmitPointsToJira
                                        teamId={teamId}
                                        ticketNumber={displaySession.ticket_number || displayTicketNumber}
                                        winningPoints={displayWinningPoints}
                                        isHandPlayed={true}
                                        isJiraConfigured={isJiraConfigured}
                                    />
                                    <NeotroPressableButton
                                        onClick={handleSendToSlack}
                                        isDisabled={!isSlackInstalled || isSending}
                                        isActive={isSlackInstalled && !isSending}
                                        activeShowsPressed={false}
                                        size="default"
                                        className="w-full"
                                    >
                                        <Send className="h-4 w-4 mr-2" />
                                        {isSending ? 'Sending...' : 'Send to Slack'}
                                    </NeotroPressableButton>
                                </div>
                            </div>
                        )}

                        {!isViewingHistory && !isObserver && (
                            <div className="flex-shrink-0 flex flex-col items-center gap-2">
                                <CardHandSelector
                                    selectedPoints={activeUserSelection.points}
                                    pointOptions={pointOptions}
                                    onSelectPoints={(points) => updateUserSelection(points)}
                                    onLockIn={toggleLockUserSelection}
                                    isLockedIn={activeUserSelection.locked}
                                    onAbstain={toggleAbstainUserSelection}
                                    isAbstained={activeUserSelection.points === -1}
                                    isAbstainedDisabled={displaySession.game_state === 'Playing'}
                                />
                            </div>
                        )}
                        </DragToPlayProvider>
                        {!isViewingHistory && isObserver && (
                            <div className="flex-shrink-0 flex flex-col items-center gap-2 rounded-lg bg-card/50 border border-primary/20 px-6 py-4">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Eye className="h-5 w-5" />
                                    <span className="text-sm font-medium">You are an observer</span>
                                </div>
                            </div>
                        )}
                        </PlayingFieldRoundSlide>
                    </div>
                </ScrollArea>
                <div className="flex-shrink-0">
                    <TooltipProvider>
                        <PokerBottomBar
                            visibility={{
                                details: isDrawerOpen,
                                chat: isChatDrawerOpen,
                                queue: isQueuePanelOpen,
                                jiraBrowser: isQueuePanelOpen,
                                roundSelector: false,
                                settings: true,
                            }}
                            onToggle={togglePanel}
                            isJiraConfigured={isJiraConfigured}
                            onSettingsClick={() => setIsSettingsOpen(true)}
                            isObserver={isObserver}
                            isViewingHistory={isViewingHistory}
                            onEnterObserverMode={enterObserverMode}
                            onLeaveObserverMode={leaveObserverMode}
                            chatUnreadCount={chatUnreadCount}
                            isMobile={true}
                            mobilePanelKeys={teamId ? ['details', 'jiraBrowser', 'chat', 'settings'] : ['details', 'jiraBrowser', 'chat', 'settings']}
                        />
                    </TooltipProvider>
                </div>
                </>
            ) : (
                <>
                <div className="flex-1 pr-4 overflow-y-auto overflow-x-hidden min-h-0" {...swipeHandlers}>
                    {/* Mobile Round Selector */}
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
                        isMobile={true}
                        onBack={onPokerBack}
                        toolbarExtras={pokerToolbarExtras}
                        chatNewMessageCountByRound={chatNewMessageCountByRound}
                    />

                    {/* Mobile Main Content (taller viewport) */}
                    <div className="flex-1 flex flex-col pt-1 px-4 pb-4" style={dragStyle}>
                        <PlayingFieldRoundSlide roundIndex={currentRoundIndex}>
                            <div className="flex flex-col items-center shrink-0 flex-none gap-1 pb-3">
                                <div className="flex flex-col shrink-0 w-full max-w-xs gap-1">
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
                                                    pokerSessionId={session.session_id}
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
                                                    pokerSessionId={session.session_id}
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
                                                title={compactTicketStripTooltip}
                                            >
                                                {compactTicketStripLabel}
                                            </span>
                                        </div>
                                    </div>
                                    ) : !isCompact ? (
                                    <div className="relative flex flex-col gap-1 bg-card/50 rounded-lg overflow-visible px-3 py-1.5">
                                        {teamId &&
                                        !isSyntheticRoundTicket(displaySession.ticket_number || displayTicketNumber) && (
                                            <div className="absolute top-2 right-2">
                                                <JiraIssueDrawer
                                                    issueIdOrKey={(displaySession.ticket_number || displayTicketNumber)!}
                                                    teamId={teamId}
                                                    pokerSessionId={session.session_id}
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
                                        <div className="relative flex items-center justify-center w-full pr-8 pt-0.5 pb-1">
                                            <div className="flex items-center justify-center gap-2 bg-primary/20 rounded-lg flex-1 min-w-0 px-3 py-1">
                                                <span className="text-sm text-muted-foreground">Winning Points:</span>
                                                <span className="font-bold text-base">{displayWinningPoints} pts</span>
                                            </div>
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
                                        </div>
                                    )}
                                    {!isViewingHistory && (
                                        displaySession.game_state === 'Playing' ? (
                                            <div className="flex items-center justify-center py-1">
                                                {isOnLastActiveRound ? (
                                                    <div className="flex w-full items-center justify-center gap-2">
                                                        <NextRoundButton
                                                            onHandPlayed={onEndRoundOnly}
                                                            isHandPlayed={displaySession.game_state === 'Playing'}
                                                            className="w-full"
                                                            label="End round"
                                                            systemMessagePrefix="Round ended by"
                                                        />
                                                        <NextRoundButton
                                                            onHandPlayed={() => {
                                                                onEndRoundOnly();
                                                                onStartNewRoundRequest();
                                                            }}
                                                            isHandPlayed={displaySession.game_state === 'Playing'}
                                                            className="w-full"
                                                            label="End + start another"
                                                            systemMessagePrefix="Round ended by"
                                                        />
                                                    </div>
                                                ) : (
                                                    <NextRoundButton
                                                        onHandPlayed={onNextRoundRequest}
                                                        isHandPlayed={displaySession.game_state === 'Playing'}
                                                        className="w-full"
                                                        label="Next Round"
                                                        systemMessagePrefix="Round completed by"
                                                    />
                                                )}
                                            </div>
                                        ) : !isCompact ? (
                                            <div className="flex items-center justify-center py-1">
                                                <PlayHandButton
                                                    onHandPlayed={playHand}
                                                    isHandPlayed={false}
                                                    className="w-full"
                                                />
                                            </div>
                                        ) : null
                                    )}
                                </div>
                            </div>

                        {/* Cards Area */}
                        <DragToPlayProvider onDrop={handleDragDrop} disabled={isDragDisabled}>
                        <div className="relative flex-1 flex items-center justify-center min-h-0 mb-6">
                            <DropZoneOverlay />
                            {displaySession.game_state === 'Playing' && cardGroups ? (
                                <div className="flex flex-wrap items-end justify-center gap-x-4 gap-y-3">
                                    {cardGroups.map(({ points, selections }) => (
                                        <div key={points} className="flex flex-col items-center space-y-2">
                                            <div className="flex flex-col items-center">
                                                {selections.map((selection, index) => (
                                                    <div key={selection.userId}
                                                        className="relative transition-all duration-200 hover:-translate-y-1 hover:z-50"
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
                                            <div className="text-center font-bold text-sm text-foreground bg-card/75 rounded-full px-3 py-1">
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
                                <div className={`grid ${getGridColumns(totalPlayers)} gap-x-2 gap-y-8 max-w-full w-full justify-items-center`}>
                                    {Object.entries(displaySession.selections).map(([userId, selection]) => (
                                        <div key={userId} className="flex flex-col items-center">
                                            <PlayingCard
                                                cardState={displaySession.game_state === 'Playing' ? CardState.Played : ((selection as any).locked ? CardState.Locked : CardState.Selection)}
                                                playerName={(selection as any).name}
                                                pointsSelected={(selection as any).points}
                                                isPresent={presentUserIds.includes(userId)}
                                                totalPlayers={totalPlayers}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {displaySession.game_state === 'Playing' && (
                            <div className="flex flex-col items-center gap-1 pb-2">
                                <div className="flex flex-col w-full max-w-xs gap-1">
                                    <SubmitPointsToJira
                                        teamId={teamId}
                                        ticketNumber={displaySession.ticket_number || displayTicketNumber}
                                        winningPoints={displayWinningPoints}
                                        isHandPlayed={true}
                                        isJiraConfigured={isJiraConfigured}
                                    />
                                    <NeotroPressableButton
                                        onClick={handleSendToSlack}
                                        isDisabled={!isSlackInstalled || isSending}
                                        isActive={isSlackInstalled && !isSending}
                                        activeShowsPressed={false}
                                        size="default"
                                        className="w-full"
                                    >
                                        <Send className="h-4 w-4 mr-2" />
                                        {isSending ? 'Sending...' : 'Send to Slack'}
                                    </NeotroPressableButton>
                                </div>
                            </div>
                        )}

                        {!isViewingHistory && !isObserver && (
                            <div className="flex-shrink-0 flex flex-col items-center gap-2">
                                <CardHandSelector
                                    selectedPoints={activeUserSelection.points}
                                    pointOptions={pointOptions}
                                    onSelectPoints={(points) => updateUserSelection(points)}
                                    onLockIn={toggleLockUserSelection}
                                    isLockedIn={activeUserSelection.locked}
                                    onAbstain={toggleAbstainUserSelection}
                                    isAbstained={activeUserSelection.points === -1}
                                    isAbstainedDisabled={displaySession.game_state === 'Playing'}
                                />
                            </div>
                        )}
                        </DragToPlayProvider>
                        {!isViewingHistory && isObserver && (
                            <div className="flex-shrink-0 flex flex-col items-center gap-2 rounded-lg bg-card/50 border border-primary/20 px-6 py-4">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Eye className="h-5 w-5" />
                                    <span className="text-sm font-medium">You are an observer</span>
                                </div>
                            </div>
                        )}
                        </PlayingFieldRoundSlide>
                    </div>
                </div>
                <div className="flex-shrink-0">
                    <TooltipProvider>
                        <PokerBottomBar
                            visibility={{
                                details: isDrawerOpen,
                                chat: isChatDrawerOpen,
                                queue: isQueuePanelOpen,
                                jiraBrowser: isQueuePanelOpen,
                                roundSelector: false,
                                settings: true,
                            }}
                            onToggle={togglePanel}
                            isJiraConfigured={isJiraConfigured}
                            onSettingsClick={() => setIsSettingsOpen(true)}
                            isObserver={isObserver}
                            isViewingHistory={isViewingHistory}
                            onEnterObserverMode={enterObserverMode}
                            onLeaveObserverMode={leaveObserverMode}
                            chatUnreadCount={chatUnreadCount}
                            isMobile={true}
                            mobilePanelKeys={teamId ? ['details', 'jiraBrowser', 'chat', 'settings'] : ['details', 'jiraBrowser', 'chat', 'settings']}
                        />
                    </TooltipProvider>
                </div>
                </>
            )}
            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <DrawerContent>
                    <DrawerHeader>
                        <DrawerTitle>Session Details</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4">
                        <PointsDetails
                            selectedPoint={activeUserSelection.points}
                            isHandPlayed={displaySession.game_state === 'Playing'}
                            winningPoints={displayWinningPoints}
                            ticketNumber={displayTicketNumber}
                            onTicketNumberChange={handleTicketNumberChange}
                            onTicketNumberFocus={handleTicketNumberFocus}
                            onTicketNumberBlur={handleTicketNumberBlur}
                            teamId={teamId}
                        />
                        <div className='flex justify-end pt-2'>
                            <Button variant="outline" size="sm" onClick={() => { setIsDrawerOpen(false); setIsSettingsOpen(true); }}>
                                Settings
                            </Button>
                        </div>
                        {displaySession.game_state === 'Playing' && (
                            <div className="pt-4 space-y-2">
                                <SubmitPointsToJira
                                    teamId={teamId}
                                    ticketNumber={displayTicketNumber}
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
                        )}
                    </div>
                </DrawerContent>
            </Drawer>
            <Drawer open={isChatDrawerOpen} onOpenChange={setIsChatDrawerOpen}>
                <DrawerContent className="h-[80vh]">
                    <div className="h-full px-4 pb-4 pt-0">
                        <PokerSessionChat embedded />
                    </div>
                </DrawerContent>
            </Drawer>
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