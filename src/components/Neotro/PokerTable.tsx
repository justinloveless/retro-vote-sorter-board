import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import PointSelector from "@/components/Neotro/PointSelector";
import PlayingCard from "@/components/Neotro/PlayingCards/PlayingCard";
import PlayHandButton from "@/components/Neotro/PlayHandButton";
import CardState from "@/components/Neotro/PlayingCards/CardState";
import PointsDetails from "@/components/Neotro/PointDetails";
import NextRoundButton from "@/components/Neotro/NextRoundButton";
import { usePokerSession, PlayerSelection, Selections } from '@/hooks/usePokerSession';
import { useAuth } from '@/hooks/useAuth';
import "@/components/Neotro/neotro.css";
/* CSS for Neotro */

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  profiles?: {
    full_name: string | null;
  } | null;
}

interface NeotroProps {
  teamMembers: TeamMember[];
  activeUserId: string | undefined;
}

const Neotro: React.FC<NeotroProps> = ({ teamMembers, activeUserId }) => {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const { session, loading, updateUserSelection, toggleLockUserSelection, playHand, nextRound, updateTicketNumber, presentUserIds } = usePokerSession(
    teamId || null,
    teamMembers,
    activeUserId
  );
  
  const pointOptions = [1, 2, 3, 5, 8, 13, 21];

  const activeUserSelection = useMemo(() => {
    if (session && activeUserId && session.selections) {
      return session.selections[activeUserId];
    }
    return { points: 0, locked: false, name: '' };
  }, [session, activeUserId]);

  const handlePointChange = (increment: boolean) => {
    const currentIndex = pointOptions.indexOf(activeUserSelection.points);
    let newIndex = increment ? currentIndex + 1 : currentIndex - 1;
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= pointOptions.length) newIndex = pointOptions.length - 1;
    
    updateUserSelection(pointOptions[newIndex]);
  };
  
  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading Session...</div>
      </div>
    );
  }

  return (
    <div className="poker-table relative flex flex-col h-full w-full">
      <div className="flex flex-1">
        <div className="w-1/4 p-4">
          <div>
            <div className="bg-card/25 h-full border-l-10 border-r-10 border-primary p-4 rounded-lg">
              <PointsDetails
                selectedPoint={activeUserSelection.points}
                isHandPlayed={session.game_state === 'Playing'}
                averagePoints={session.average_points}
                ticketNumber={session.ticket_number}
                onTicketNumberChange={updateTicketNumber}
              />
              <div className="p-2 flex justify-between">
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
        <div className="w-3/4 flex flex-col p-4">
          <div className="flex-grow flex items-end justify-center min-h-0 pb-8">
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
                onAbstain={() => updateUserSelection(0)} // Simple abstain logic
                isAbstained={activeUserSelection.points === 0}
                isAbstainedDisabled={session.game_state === 'Playing' || activeUserSelection.locked}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Neotro;
