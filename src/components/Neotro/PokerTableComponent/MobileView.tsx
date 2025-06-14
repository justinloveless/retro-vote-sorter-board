import React from 'react';
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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Menu, MessageCircle, Send } from 'lucide-react';

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
        displaySession,
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
        displayTicketNumber,
        handleTicketNumberChange,
        handleTicketNumberFocus,
        handleTicketNumberBlur,
        teamId,
        activeUserId,
    } = usePokerTable();

    if (!displaySession || !session) return null;

    return (
        <div className={`poker-table relative flex flex-col h-full ${shake ? 'screen-shake' : ''}`}>
            {/* Mobile Header with History Navigation */}
            <div className="flex flex-col items-center justify-center p-4 space-y-3">
                <div className="flex gap-2">
                    <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} >
                        <DrawerTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-white/20 backdrop-blur border-white/30 text-white hover:bg-white/30"
                            >
                                <Menu className="h-4 w-4 mr-2" />
                                Details
                            </Button>
                        </DrawerTrigger>
                        <DrawerContent>
                            <DrawerHeader>
                                <DrawerTitle>Session Details</DrawerTitle>
                            </DrawerHeader>
                            <div className="p-4">
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
                                        config={session}
                                        onUpdateConfig={updateSessionConfig}
                                        onDeleteAllRounds={deleteAllRounds}
                                        isSlackIntegrated={isSlackInstalled}
                                    />
                                </div>
                                {displaySession.game_state === 'Playing' && (
                                    <div className="pt-4">
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
                        <DrawerTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-white/20 backdrop-blur border-white/30 text-white hover:bg-white/30"
                            >
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Chat
                            </Button>
                        </DrawerTrigger>
                        <DrawerContent className="h-[80vh]">
                            <div className="h-full p-4">
                                <PokerSessionChat isCollapsible={false} />
                            </div>
                        </DrawerContent>
                    </Drawer>
                    <PokerConfig
                        config={session}
                        onUpdateConfig={updateSessionConfig}
                        onDeleteAllRounds={deleteAllRounds}
                        isSlackIntegrated={isSlackInstalled}
                    />
                </div>

                {/* History Navigation */}
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

            {/* Mobile Main Content */}
            <div className="flex-1 flex flex-col p-4">
                {/* Cards Area */}
                <div className="flex-1 flex items-center justify-center min-h-0 mb-6">
                    {displaySession.game_state === 'Playing' && cardGroups ? (
                        <div className="flex flex-wrap items-end justify-center gap-x-2 gap-y-4">
                            {cardGroups.map(({ points, selections }) => (
                                <div key={points} className="flex flex-col items-center space-y-2">
                                    <div className="flex justify-center -space-x-10">
                                        {selections.map((selection, index) => (
                                            <div key={selection.userId} className="transition-transform transform hover:-translate-y-2"
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
                                    <div className="text-center font-bold text-sm text-foreground bg-card/75 rounded-full px-3 py-1">
                                        {selections.length} x {points === -1 ? 'Abstain' : `${points} pts`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={`grid ${getGridColumns(totalPlayers)} gap-2 max-w-full w-full justify-items-center`}>
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

                {/* Action Buttons - Only show if not viewing history */}
                {!isViewingHistory && (
                    <div className="flex-shrink-0 mb-4">
                        <div className="flex gap-2 mb-4">
                            <PlayHandButton
                                onHandPlayed={playHand}
                                isHandPlayed={session.game_state === 'Playing'}
                            />
                            <NextRoundButton
                                onHandPlayed={nextRound}
                                isHandPlayed={session.game_state === 'Playing'}
                            />
                        </div>
                    </div>
                )}

                {/* Mobile Point Selector - Only show if not viewing history */}
                {!isViewingHistory && (
                    <div className="flex-shrink-0">
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
                )}
            </div>
        </div>
    );
} 