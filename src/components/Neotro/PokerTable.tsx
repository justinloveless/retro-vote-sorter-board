import React, { useState, useMemo, useCallback } from 'react';
import PointSelector from "@/components/Neotro/PointSelector";
import PlayingCard from "@/components/Neotro/PlayingCards/PlayingCard";
import PlayHandButton from "@/components/Neotro/PlayHandButton";
import CardState from "@/components/Neotro/PlayingCards/CardState";
import PointsDetails from "@/components/Neotro/PointDetails";
import NextRoundButton from "@/components/Neotro/NextRoundButton";
import HistoryNavigation from "@/components/Neotro/HistoryNavigation";
import { PokerSessionChat } from "@/components/Neotro/PokerSessionChat";
import { PokerSession } from '@/hooks/usePokerSession';
import { usePokerSessionHistory } from '@/hooks/usePokerSessionHistory';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { Home, Menu, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import "@/components/Neotro/neotro.css";

interface PokerTableProps {
  session: PokerSession | null;
  activeUserId: string | undefined;
  updateUserSelection: (points: number) => void;
  toggleLockUserSelection: () => void;
  playHand: () => void;
  nextRound: () => void;
  updateTicketNumber: (ticketNumber: string) => void;
  presentUserIds: string[];
  teamId?: string;
}

const PokerTable: React.FC<PokerTableProps> = ({
  session,
  activeUserId,
  updateUserSelection,
  toggleLockUserSelection,
  playHand,
  nextRound,
  updateTicketNumber,
  presentUserIds,
  teamId
}) => {
  const [displayTicketNumber, setDisplayTicketNumber] = useState('');
  const [isTicketInputFocused, setIsTicketInputFocused] = useState(false);
  const [shake, setShake] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Use history hook
  const {
    rounds,
    currentRound,
    isViewingHistory,
    canGoBack,
    canGoForward,
    goToPreviousRound,
    goToNextRound,
    goToCurrentRound,
  } = usePokerSessionHistory(session?.id || null);

  // Determine what data to display - history round or current session
  const displaySession = isViewingHistory && currentRound ? {
    ...session!,
    selections: currentRound.selections,
    average_points: currentRound.average_points,
    ticket_number: currentRound.ticket_number,
    ticket_title: currentRound.ticket_title,
    game_state: 'Playing' as const, // History rounds are always in "played" state
  } : session;

  // Debounce function
  const debounce = <F extends (...args: any[]) => any>(func: F, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    const debouncedFunc = (...args: Parameters<F>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);
    };

    debouncedFunc.cancel = () => {
      clearTimeout(timeoutId);
    };

    return debouncedFunc;
  };

  const debouncedUpdateTicketNumber = useCallback(
    debounce((value: string) => {
      updateTicketNumber(value);
    }, 500),
    [updateTicketNumber]
  );

  React.useEffect(() => {
    if (session?.ticket_number && !isTicketInputFocused) {
      setDisplayTicketNumber(session.ticket_number);
    }
  }, [session?.ticket_number, isTicketInputFocused]);

  const pointOptions = [1, 2, 3, 5, 8, 13, 21];

  const activeUserSelection = useMemo(() => {
    if (displaySession && activeUserId && displaySession.selections[activeUserId]) {
      return displaySession.selections[activeUserId];
    }
    return { points: 0, locked: false, name: '' };
  }, [displaySession, activeUserId]);

  const totalPlayers = displaySession ? Object.keys(displaySession.selections).length : 0;

  const handlePointChange = (increment: boolean) => {
    // Don't allow point changes when viewing history
    if (isViewingHistory) return;
    
    const currentIndex = pointOptions.indexOf(activeUserSelection.points);
    let newIndex = increment ? currentIndex + 1 : currentIndex - 1;
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= pointOptions.length) {
      newIndex = pointOptions.length - 1;
      if (increment) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    }

    updateUserSelection(pointOptions[newIndex]);
  };

  const handleTicketNumberChange = (value: string) => {
    // Don't allow ticket changes when viewing history
    if (isViewingHistory) return;
    
    setDisplayTicketNumber(value);
    debouncedUpdateTicketNumber(value);
  }

  const handleTicketNumberFocus = () => {
    setIsTicketInputFocused(true);
  }

  const handleTicketNumberBlur = () => {
    setIsTicketInputFocused(false);
    debouncedUpdateTicketNumber.cancel();
    if (session && displayTicketNumber !== session.ticket_number) {
      updateTicketNumber(displayTicketNumber);
    }
  }

  const handleAbstain = () => {
    // Don't allow abstain changes when viewing history
    if (isViewingHistory) return;
    
    if (activeUserSelection.points === -1) {
      updateUserSelection(1);
    } else {
      updateUserSelection(-1);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading Session...</div>
      </div>
    );
  }

  // Dynamic grid columns based on number of players
  const getGridColumns = (playerCount: number, isMobile: boolean) => {
    if (isMobile) {
      if (playerCount <= 2) return 'grid-cols-2';
      if (playerCount <= 6) return 'grid-cols-3';
      if (playerCount <= 8) return 'grid-cols-4';
      return 'grid-cols-4';
    } else {
      if (playerCount <= 4) return 'grid-cols-4';
      if (playerCount <= 6) return 'grid-cols-6';
      if (playerCount <= 8) return 'grid-cols-4';
      if (playerCount <= 12) return 'grid-cols-6';
      return 'grid-cols-8';
    }
  };

  if (isMobile) {
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
                  <PokerSessionChat
                    sessionId={session.id}
                    currentRoundNumber={currentRound?.round_number || session.current_round_number || 1}
                    currentUserId={activeUserId}
                    currentUserName={activeUserSelection.name}
                    isViewingHistory={isViewingHistory}
                  />
                </div>
              </DrawerContent>
            </Drawer>
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
            <div className={`grid ${getGridColumns(totalPlayers, true)} gap-2 max-w-full w-full justify-items-center`}>
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
                onAbstain={handleAbstain}
                isAbstained={activeUserSelection.points === -1}
                isAbstainedDisabled={session.game_state === 'Playing' || activeUserSelection.locked}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  console.log('rounds', rounds);
  console.log('currentRound', currentRound);
  console.log('session', session);
  console.log('currentRound', currentRound);
  // Desktop layout
  return (
    <div className={`poker-table relative flex flex-col h-full ${shake ? 'screen-shake' : ''}`}>
      {/* History Navigation for Desktop */}
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
              {/* Action Buttons - Only show if not viewing history */}
              {!isViewingHistory && (
                <div className="p-2 flex justify-between gap-2">
                  <PlayHandButton
                    onHandPlayed={playHand}
                    isHandPlayed={session.game_state === 'Playing'}
                  />
                  <NextRoundButton
                    onHandPlayed={nextRound}
                    isHandPlayed={session.game_state === 'Playing'}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="w-1/2 flex flex-col p-4">
          <div className="flex-grow flex items-end justify-center min-h-0 pb-8">
            <div className={`grid ${getGridColumns(totalPlayers, false)} gap-4 justify-items-center max-w-full`}>
              {Object.entries(displaySession.selections).map(([userId, selection]) => (
                <PlayingCard
                  key={userId}
                  cardState={displaySession.game_state === 'Playing' ? CardState.Played : ((selection as any).locked ? CardState.Locked : CardState.Selection)}
                  playerName={(selection as any).name}
                  pointsSelected={(selection as any).points}
                  isPresent={presentUserIds.includes(userId)}
                  totalPlayers={totalPlayers}
                />
              ))}
            </div>
          </div>
          {/* Point Selector - Only show if not viewing history */}
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
                  onAbstain={handleAbstain}
                  isAbstained={activeUserSelection.points === -1}
                  isAbstainedDisabled={session.game_state === 'Playing' || activeUserSelection.locked}
                />
              </div>
            </div>
          )}
        </div>
        <div className="w-1/4 p-4 flex flex-col">
            <div className=" rounded-lg h-full flex flex-col justify-end">
              <PokerSessionChat
                sessionId={session.id}
                currentRoundNumber={currentRound?.round_number || session.current_round_number || 1}
                currentUserId={activeUserId}
                currentUserName={activeUserSelection.name}
                isViewingHistory={isViewingHistory}
              />
            </div>
        </div>
      </div>
    </div>
  );
};

export default PokerTable;
