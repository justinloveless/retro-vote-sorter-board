import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
}

export const usePokerSessionHistory = (sessionId: string | null) => {
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
      // Set to the latest round by default
      if (data && data.length > 0) {
        setCurrentRoundIndex(data.length - 1);
      }
    } catch (error) {
      console.error('Error fetching rounds:', error);
      toast({ title: 'Error fetching history', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [sessionId, toast]);

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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchRounds]);

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
