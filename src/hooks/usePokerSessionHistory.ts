import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client.ts';
import { useToast } from '../hooks/use-toast.ts';
import { Selections } from './usePokerSession';
import { type GameState } from './usePokerSession';

export interface PokerSessionRound {
  id: string;
  session_id: string;
  round_number: number;
  selections: any;
  average_points: number;
  ticket_number: string | null;
  ticket_title: string | null;
  completed_at: string;
  created_at: string;
  game_state: GameState;
}

export const usePokerSessionHistory = (sessionId: string | null, initialRoundNumber?: number) => {
  const [rounds, setRounds] = useState<PokerSessionRound[]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchRounds = useCallback(async () => {
    if (!sessionId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('poker_session_rounds')
        .select('*')
        .eq('session_id', sessionId)
        .order('round_number', { ascending: true });

      if (error) {
        console.error('Error fetching rounds:', error);
        toast({ title: 'Error fetching history', variant: 'destructive' });
        return;
      }

      setRounds(data || []);
      
      if (data && data.length > 0) {
        // If initialRoundNumber is provided, try to find and set that round
        if (initialRoundNumber !== undefined) {
          const targetIndex = data.findIndex(round => round.round_number === initialRoundNumber);
          if (targetIndex !== -1) {
            setCurrentRoundIndex(targetIndex);
          } else {
            // If specified round not found, default to latest
            setCurrentRoundIndex(data.length - 1);
          }
        } else {
          // Set to the latest round by default
          setCurrentRoundIndex(data.length - 1);
        }
      } else {
        // If no rounds, reset index
        setCurrentRoundIndex(0);
      }
    } catch (error) {
      console.error('Error fetching rounds:', error);
      toast({ title: 'Error fetching history', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [sessionId, initialRoundNumber, toast]);

  useEffect(() => {
    if (sessionId) {
      fetchRounds();
    } else {
      setRounds([]);
      return;
    }

    const channel = supabase
      .channel(`poker_session_rounds-changes-for-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poker_session_rounds',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          fetchRounds();
        }
      )
      .subscribe();
    
    // Listen for the custom event to refetch rounds
    const handleRoundEnded = () => fetchRounds();
    window.addEventListener('round-ended', handleRoundEnded);

    const handleRoundsDeleted = () => fetchRounds();
    window.addEventListener('rounds-deleted', handleRoundsDeleted);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('round-ended', handleRoundEnded);
      window.removeEventListener('rounds-deleted', handleRoundsDeleted);
    };
  }, [sessionId]);

  const saveCurrentRound = async (
    sessionId: string,
    roundNumber: number,
    selections: any,
    averagePoints: number,
    ticketNumber?: string,
    ticketTitle?: string
  ) => {
    try {
      const { error } = await supabase
        .from('poker_session_rounds')
        .insert({
          session_id: sessionId,
          round_number: roundNumber,
          selections,
          average_points: averagePoints,
          ticket_number: ticketNumber,
          ticket_title: ticketTitle,
        });

      if (error) {
        console.error('Error saving round:', error);
        toast({ title: 'Error saving round history', variant: 'destructive' });
        return false;
      }

      // Refresh the rounds list
      await fetchRounds();
      return true;
    } catch (error) {
      console.error('Error saving round:', error);
      toast({ title: 'Error saving round history', variant: 'destructive' });
      return false;
    }
  };

  const goToPreviousRound = () => {
    if (currentRoundIndex > 0) {
      setCurrentRoundIndex(currentRoundIndex - 1);
    }
  };

  const goToNextRound = () => {
    if (currentRoundIndex < rounds.length - 1) {
      setCurrentRoundIndex(currentRoundIndex + 1);
    }
  };

  const goToCurrentRound = () => {
    if (rounds.length > 0) {
      setCurrentRoundIndex(rounds.length - 1);
    }
  };

  const isViewingHistory = currentRoundIndex < rounds.length - 1;
  const currentRound = rounds[currentRoundIndex] || null;
  const canGoBack = currentRoundIndex > 0;
  const canGoForward = currentRoundIndex < rounds.length - 1;

  return {
    rounds,
    currentRound,
    currentRoundIndex,
    isViewingHistory,
    canGoBack,
    canGoForward,
    loading,
    saveCurrentRound,
    goToPreviousRound,
    goToNextRound,
    goToCurrentRound,
    fetchRounds,
  };
};
