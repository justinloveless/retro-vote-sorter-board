import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import PointSelector from "@/components/Neotro/PointSelector";
import PlayingCard from "@/components/Neotro/PlayingCards/PlayingCard";
import PlayHandButton from "@/components/Neotro/PlayHandButton";
import CardState from "@/components/Neotro/PlayingCards/CardState";
import PointsDetails from "@/components/Neotro/PointDetails";
import NextRoundButton from "@/components/Neotro/NextRoundButton";
import { usePokerSession, PlayerSelection, Selections } from '@/hooks/usePokerSession';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
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

  useEffect(() => {
    const fetchTeamPrefix = async () => {
      if (teamId) {
        const { data, error } = await supabase
          .from('teams')
          .select('jira_ticket_prefix')
          .eq('id', teamId)
          .single();

        if (data && data.jira_ticket_prefix) {
          if (!session?.ticket_number) {
            setDisplayTicketNumber(data.jira_ticket_prefix);
          }
        }
      }
    };
    fetchTeamPrefix();
  }, [teamId, session?.ticket_number]);

  useEffect(() => {
    if (session?.ticket_number && !isTicketInputFocused) {
      setDisplayTicketNumber(session.ticket_number);
    } else if (teamId && !session?.ticket_number && !isTicketInputFocused) {
      // If session ticket number is cleared (e.g., new round), re-apply prefix
      const fetchTeamPrefix = async () => {
        const { data } = await supabase
          .from('teams')
          .select('jira_ticket_prefix')
          .eq('id', teamId)
          .single();
        setDisplayTicketNumber(data?.jira_ticket_prefix || '');
      };
      fetchTeamPrefix();
    }
  }, [session?.ticket_number, teamId, isTicketInputFocused]);

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
    // On blur, immediately update the ticket number, cancelling any pending debounce
    debouncedUpdateTicketNumber.cancel();
    if (session && displayTicketNumber !== session.ticket_number) {
      updateTicketNumber(displayTicketNumber);
    }
  }

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading Session...</div>
      </div>
    );
  }

  return (
    <div className={`poker-table relative flex flex-col h-full ${shake ? 'screen-shake' : ''}`}>
      <div className="flex flex-1 min-h-0">
        <div className="w-1/4 p-4 flex flex-col">
          <div className="flex-grow overflow-y-auto pr-2">
            <div className="bg-card/25 h-full border-l-10 border-r-10 border-primary p-4 rounded-lg">
              <PointsDetails
                teamId={teamId}
                selectedPoint={activeUserSelection.points}
                isHandPlayed={session.game_state === 'Playing'}
                averagePoints={session.average_points}
                ticketNumber={displayTicketNumber}
                onTicketNumberChange={handleTicketNumberChange}
                onTicketNumberFocus={handleTicketNumberFocus}
                onTicketNumberBlur={handleTicketNumberBlur}
              />
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
                onAbstain={() => updateUserSelection(-1)} // Simple abstain logic
                isAbstained={activeUserSelection.points === -1}
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
