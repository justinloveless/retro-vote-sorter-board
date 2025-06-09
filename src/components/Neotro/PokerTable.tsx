import React, { useState, useMemo, useCallback } from 'react';
import PointSelector from "@/components/Neotro/PointSelector";
import PlayingCard from "@/components/Neotro/PlayingCards/PlayingCard";
import PlayHandButton from "@/components/Neotro/PlayHandButton";
import CardState from "@/components/Neotro/PlayingCards/CardState";
import PointsDetails from "@/components/Neotro/PointDetails";
import NextRoundButton from "@/components/Neotro/NextRoundButton";
import LockInButton from "@/components/Neotro/LockInButton";
import AbstainButton from "@/components/Neotro/AbstainButton";
import { PokerSession } from '@/hooks/usePokerSession';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { PanelLeftOpen } from 'lucide-react';
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
}

const PokerTable: React.FC<PokerTableProps> = ({
  session,
  activeUserId,
  updateUserSelection,
  toggleLockUserSelection,
  playHand,
  nextRound,
  updateTicketNumber,
  presentUserIds
}) => {
  const [displayTicketNumber, setDisplayTicketNumber] = useState('');
  const [isTicketInputFocused, setIsTicketInputFocused] = useState(false);
  const [shake, setShake] = useState(false);

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
    if (session && activeUserId && session.selections[activeUserId]) {
      return session.selections[activeUserId];
    }
    return { points: 0, locked: false, name: '' };
  }, [session, activeUserId]);

  const handlePointChange = (increment: boolean) => {
    const currentIndex = pointOptions.indexOf(activeUserSelection.points);
    let newIndex = increment ? currentIndex + 1 : currentIndex - 1;
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= pointOptions.length) {
      newIndex = pointOptions.length - 1;
      if (increment) {
        setShake(true);
        setTimeout(() => setShake(false), 500); // Reset shake after animation duration
      }
    }

    updateUserSelection(pointOptions[newIndex]);
  };

  const handleTicketNumberChange = (value: string) => {
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

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading Session...</div>
      </div>
    );
  }

  return (
    <div className={`poker-table relative flex flex-col h-full ${shake ? 'screen-shake' : ''}`}>
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        <div className="w-full md:w-1/4 p-4 flex-col hidden md:flex">
          <div className="flex-grow overflow-y-auto pr-2">
            <div className="bg-card/25 h-full border-l-10 border-r-10 border-primary p-4 rounded-lg flex flex-col">
              <div className="flex-grow">
                <PointsDetails
                  selectedPoint={activeUserSelection.points}
                  isHandPlayed={session.game_state === 'Playing'}
                  averagePoints={session.average_points}
                  ticketNumber={displayTicketNumber}
                  onTicketNumberChange={handleTicketNumberChange}
                  onTicketNumberFocus={handleTicketNumberFocus}
                  onTicketNumberBlur={handleTicketNumberBlur}
                />
              </div>
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
            </div>
          </div>
        </div>
        <div className="w-full md:w-3/4 flex flex-col h-full p-0 md:p-4">
          <div className="md:hidden p-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full">
                  <PanelLeftOpen className="h-4 w-4 mr-2" />
                  Show Details
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Session Details</SheetTitle>
                </SheetHeader>
                <PointsDetails
                  selectedPoint={activeUserSelection.points}
                  isHandPlayed={session.game_state === 'Playing'}
                  averagePoints={session.average_points}
                  ticketNumber={displayTicketNumber}
                  onTicketNumberChange={handleTicketNumberChange}
                  onTicketNumberFocus={handleTicketNumberFocus}
                  onTicketNumberBlur={handleTicketNumberBlur}
                />
              </SheetContent>
            </Sheet>
          </div>
          <div className="flex-grow flex items-center justify-center min-h-0">
            <div className="flex flex-wrap gap-4 justify-center items-center">
              {Object.entries(session.selections).map(([userId, selection]) => (
                <PlayingCard
                  key={userId}
                  cardState={session.game_state === 'Playing' ? CardState.Played : (selection.locked ? CardState.Locked : CardState.Selection)}
                  playerName={selection.name}
                  pointsSelected={selection.points}
                  isPresent={presentUserIds.includes(userId)}
                />
              ))}
            </div>
          </div>
          <div className="flex-shrink-0 p-4">
            <div className="md:hidden space-y-2">
              <div className="flex justify-stretch gap-4 w-full">
                <PlayHandButton
                  onHandPlayed={playHand}
                  isHandPlayed={session.game_state === 'Playing'}
                />
                <NextRoundButton
                  onHandPlayed={nextRound}
                  isHandPlayed={session.game_state === 'Playing'}
                />
              </div>
              <div className="flex justify-stretch gap-4 w-full">
                <LockInButton onLockIn={toggleLockUserSelection} isLockedIn={activeUserSelection.locked} />
                <AbstainButton onAbstain={() => updateUserSelection(-1)} isAbstained={activeUserSelection.points === -1} isDisabled={session.game_state === 'Playing' || activeUserSelection.locked} />
              </div>
              <PointSelector
                pointsIndex={pointOptions.indexOf(activeUserSelection.points)}
                selectedPoints={activeUserSelection.points}
                pointOptions={pointOptions}
                onPointsDecrease={() => handlePointChange(false)}
                onPointsIncrease={() => handlePointChange(true)}
              />
            </div>
            <div className="hidden md:flex items-center justify-center gap-4">
              <LockInButton onLockIn={toggleLockUserSelection} isLockedIn={activeUserSelection.locked} />
              <PointSelector
                pointsIndex={pointOptions.indexOf(activeUserSelection.points)}
                selectedPoints={activeUserSelection.points}
                pointOptions={pointOptions}
                onPointsDecrease={() => handlePointChange(false)}
                onPointsIncrease={() => handlePointChange(true)}
              />
              <AbstainButton onAbstain={() => updateUserSelection(-1)} isAbstained={activeUserSelection.points === -1} isDisabled={session.game_state === 'Playing' || activeUserSelection.locked} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PokerTable;
