import React, { useEffect, useState } from 'react';
import { usePokerTable } from './context';
import PointSelector from "@/components/Neotro/PointSelector";
import PlayingCard from "@/components/Neotro/PlayingCards/PlayingCard";
import PlayHandButton from "@/components/Neotro/PlayHandButton";
import CardState from "@/components/Neotro/PlayingCards/CardState";
import PointsDetails from "@/components/Neotro/PointDetails";
import NextRoundButton from "@/components/Neotro/NextRoundButton";
import HistoryNavigation from "@/components/Neotro/HistoryNavigation";
import { PokerSessionChat } from "@/components/shared/PokerSessionChat";
import { PokerConfig } from '../PokerConfig';
import { Button } from '@/components/ui/button';
import { Send, ListOrdered } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PlayerSelection } from '@/hooks/usePokerSession';
import SubmitPointsToJira from '@/components/Neotro/SubmitPointsToJira';

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
        session,
        updateSessionConfig,
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
        handleTicketNumberChange,
        handleTicketNumberFocus,
        handleTicketNumberBlur,
        teamId,
        activeUserId,
        userRole,
        setNextRoundDialogOpen,
        onNextRoundRequest,
        ticketQueue,
        setQueuePanelOpen,
        isJiraConfigured,
    } = usePokerTable();

    const CARD_BASE_HEIGHT = 95;
    const desktopScale = totalPlayers <= 4 ? 1.6 : totalPlayers <= 6 ? 1.4 : totalPlayers <= 8 ? 1.2 : totalPlayers <= 12 ? 1.0 : 0.8;
    const scaledCardHeight = CARD_BASE_HEIGHT * desktopScale;
    const VISIBLE_STRIP = 10;
    const stackOverlap = scaledCardHeight - VISIBLE_STRIP;

    useEffect(() => {
        console.log('currentRound updated', currentRound)
    }, [currentRound]);

    if (!displaySession || !session) return null;

    return (
        <div className={`poker-table relative flex flex-col h-full ${shake ? 'screen-shake' : ''}`}>
            <div className="p-4">
                <div className="bg-card/25 border border-primary/20 rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                        <HistoryNavigation
                            currentRoundNumber={currentRound?.round_number || 1}
                            totalRounds={rounds.length}
                            isViewingHistory={isViewingHistory}
                            canGoBack={canGoBack}
                            canGoForward={canGoForward}
                            onPrevious={goToPreviousRound}
                            onNext={goToNextRound}
                            onGoToCurrent={goToCurrentRound}
                            embedded
                        />
                    </div>
                    <div className={`flex items-center gap-2 shrink-0 ${rounds.length > 1 ? 'border-l border-primary/20 pl-4' : ''}`}>
                        {teamId && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setQueuePanelOpen(true)}
                            >
                                <ListOrdered className="h-4 w-4 mr-2" />
                                Queue
                                {ticketQueue.length > 0 && (
                                    <Badge variant="secondary" className="ml-2 text-xs px-1.5">
                                        {ticketQueue.length}
                                    </Badge>
                                )}
                            </Button>
                        )}
                        <PokerConfig
                            config={{
                                presence_enabled: 'presence_enabled' in session && session.presence_enabled,
                                send_to_slack: 'send_to_slack' in session && session.send_to_slack
                            }}
                            onUpdateConfig={updateSessionConfig}
                            onDeleteAllRounds={deleteAllRounds}
                            isSlackIntegrated={isSlackInstalled}
                            userRole={userRole}
                            iconOnly
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-1 min-h-0">
                <div className="w-1/4 p-4 flex flex-col">
                    <div className="flex-grow overflow-y-auto pr-2">
                        <div className="bg-card/25 border-l-10 border-r-10 border-primary p-4 rounded-lg">
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
                            {!isViewingHistory && (
                                <div className="p-2 flex justify-between gap-2">
                                    <PlayHandButton
                                        onHandPlayed={playHand}
                                        isHandPlayed={session.game_state === 'Playing'}
                                    />
                                    <NextRoundButton
                                        onHandPlayed={onNextRoundRequest}
                                        isHandPlayed={session.game_state === 'Playing'}
                                    />
                                </div>
                            )}
                            {displaySession.game_state === 'Playing' && (
                                <div className="pt-2 px-2 space-y-2">
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
                    </div>
                </div>

                <div className="w-1/2 flex flex-col p-4">
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
                            <div className={`grid ${getGridColumns(totalPlayers)} gap-4 justify-items-center max-w-full`}>
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
                    {!isViewingHistory && (
                        <div className="flex-shrink-0 flex items-center justify-center p-4">
                            <div>
                                <PointSelector
                                    pointsIndex={pointOptions.indexOf(activeUserSelection.points)}
                                    selectedPoints={activeUserSelection.points}
                                    pointOptions={pointOptions}
                                    onPointsDecrease={() => handlePointChange(false)}
                                    onPointsIncrease={() => handlePointChange(true)}
                                    onLockIn={toggleLockUserSelection}
                                    isLockedIn={activeUserSelection.locked}
                                    onAbstain={toggleAbstainUserSelection}
                                    isAbstained={activeUserSelection.points === -1}
                                    isAbstainedDisabled={session.game_state === 'Playing'}
                                />
                            </div>
                        </div>
                    )}
                </div>
                <div className="w-1/4 p-4 flex flex-col">
                    <div className=" rounded-lg h-full flex flex-col justify-end">
                        <PokerSessionChat />
                    </div>
                </div>
            </div>
        </div>
    );
} 