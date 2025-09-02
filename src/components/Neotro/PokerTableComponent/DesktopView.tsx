import React, { useEffect, useState } from 'react';
import { usePokerTable } from './context.tsx';
import PointSelector from '../../../components/Neotro/PointSelector.tsx';
import PlayingCard from '../../../components/Neotro/PlayingCards/PlayingCard.tsx';
import PlayHandButton from '../../../components/Neotro/PlayHandButton.tsx';
import CardState from '../../../components/Neotro/PlayingCards/CardState.tsx';
import PointsDetails from '../../../components/Neotro/PointDetails.tsx';
import NextRoundButton from '../../../components/Neotro/NextRoundButton.tsx';
import HistoryNavigation from '../../../components/Neotro/HistoryNavigation.tsx';
import { PokerSessionChat } from '../../../components/shared/PokerSessionChat.tsx';
import { PokerConfig } from '../PokerConfig.tsx';
import { Button } from '../../../components/ui/button.tsx';
import { Send } from 'lucide-react';
import { type PlayerSelection } from '../../../hooks/usePokerSession.ts';

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
        setNextRoundDialogOpen
    } = usePokerTable();

    useEffect(() => {
        console.log('currentRound updated', currentRound)
    }, [currentRound]);

    if (!displaySession || !session) return null;

    return (
        <div className={`poker-table relative flex flex-col h-full ${shake ? 'screen-shake' : ''}`}>
            <div className="p-4">
                <HistoryNavigation
                    currentRoundNumber={currentRound?.round_number || 1}
                    totalRounds={rounds.length}
                    isViewingHistory={isViewingHistory}
                    canGoBack={canGoBack}
                    canGoForward={canGoForward}
                    onPrevious={goToPreviousRound}
                    onNext={goToNextRound}
                    onGoToCurrent={goToCurrentRound}
                />
            </div>

            <div className="flex flex-1 min-h-0">
                <div className="w-1/4 p-4 flex flex-col">
                    <div className="flex-grow overflow-y-auto pr-2">
                        <div className="bg-card/25 border-l-10 border-r-10 border-primary p-4 rounded-lg">
                            <PointsDetails
                                selectedPoint={activeUserSelection.points}
                                isHandPlayed={displaySession.game_state === 'Playing'}
                                averagePoints={displaySession.average_points}
                                ticketNumber={displayTicketNumber}
                                onTicketNumberChange={handleTicketNumberChange}
                                onTicketNumberFocus={handleTicketNumberFocus}
                                onTicketNumberBlur={handleTicketNumberBlur}
                                teamId={teamId}
                            />
                            <div className='flex justify-end pt-2'>
                                <PokerConfig
                                    config={{
                                        presence_enabled: 'presence_enabled' in session && session.presence_enabled,
                                        send_to_slack: 'send_to_slack' in session && session.send_to_slack
                                    }}
                                    onUpdateConfig={updateSessionConfig}
                                    onDeleteAllRounds={deleteAllRounds}
                                    isSlackIntegrated={isSlackInstalled}
                                    userRole={userRole}
                                />
                            </div>
                            {!isViewingHistory && (
                                <div className="p-2 flex justify-between gap-2">
                                    <PlayHandButton
                                        onHandPlayed={playHand}
                                        isHandPlayed={session.game_state === 'Playing'}
                                    />
                                    <NextRoundButton
                                        onHandPlayed={() => setNextRoundDialogOpen(true)}
                                        isHandPlayed={session.game_state === 'Playing'}
                                    />
                                </div>
                            )}
                            {displaySession.game_state === 'Playing' && (
                                <div className="pt-2 px-2">
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
                            <div className="flex flex-wrap items-end justify-center gap-x-4 gap-y-8">
                                {cardGroups.map(({ points, selections }) => (
                                    <div key={points} className="flex flex-col items-center space-y-2">
                                        <div className="flex justify-center -space-x-14">
                                            {selections.map((selection, index) => (
                                                <div key={selection.userId} className="transition-transform transform hover:-translate-y-4"
                                                    style={{ zIndex: selections.length - index }}>
                                                    <PlayingCard
                                                        cardState={CardState.Played}
                                                        playerName={selection.name}
                                                        pointsSelected={selection.points}
                                                        isPresent={presentUserIds.includes(selection.userId)}
                                                        totalPlayers={totalPlayers}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-center font-bold text-lg text-foreground bg-card/75 rounded-full px-4 py-1">
                                            {selections.length} x {points === -1 ? 'Abstain' : `${points} pts`}
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