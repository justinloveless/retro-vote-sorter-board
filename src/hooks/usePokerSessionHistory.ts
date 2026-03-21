import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GameState } from './usePokerSession';
import { isUuidLike } from '@/lib/pokerSessionPathSlug';

/** Team poker URLs: resolve DB session id from team + slug so history never depends on merged UI state alone. */
export type PokerHistoryTeamRoute = { teamId: string; slug: string };

async function resolvePokerSessionPk(
  sessionIdHint: string | null | undefined,
  teamRoute: PokerHistoryTeamRoute | null | undefined
): Promise<string | null> {
  const slug = teamRoute?.slug?.trim();
  const teamId = teamRoute?.teamId?.trim();
  if (teamId && slug && slug !== 'null' && slug !== 'undefined') {
    let q = supabase.from('poker_sessions').select('id').eq('team_id', teamId);
    if (isUuidLike(slug)) {
      q = q.or(`id.eq.${slug},room_id.eq.${slug}`);
    } else {
      q = q.eq('room_id', slug);
    }
    const { data, error } = await q.maybeSingle();
    if (!error && data?.id) return data.id;
  }
  const hint = sessionIdHint?.trim();
  return hint && hint !== 'null' && hint !== 'undefined' ? hint : null;
}

/** Dispatched when the session advances so history can update `selectedRoundNumberRef` before `fetchRounds` races realtime. */
export const POKER_FOLLOW_CURRENT_ROUND_EVENT = 'poker-follow-current-round';

export type PokerFollowCurrentRoundDetail = { sessionId: string; roundNumber: number };

export interface PokerSessionRound {
  id: string;
  session_id: string;
  round_number: number;
  selections: any;
  average_points: number;
  ticket_number: string | null;
  ticket_title: string | null;
  /** Jira parent issue key (often epic) when known. */
  ticket_parent_key?: string | null;
  ticket_parent_summary?: string | null;
  completed_at: string;
  created_at: string;
  game_state: GameState;
  is_active: boolean;
}

export const usePokerSessionHistory = (
  sessionId: string | null,
  initialRoundNumber?: number,
  teamRoute?: PokerHistoryTeamRoute | null
) => {
  const [rounds, setRounds] = useState<PokerSessionRound[]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [resolvedSessionPk, setResolvedSessionPk] = useState<string | null>(null);
  const { toast } = useToast();

  // Preserve the user's selected round when we refetch due to realtime changes.
  const selectedRoundNumberRef = useRef<number | undefined>(initialRoundNumber);
  /** Avoid clobbering in-app round navigation while `?round=` lags one frame behind `currentRoundIndex`. */
  const lastAppliedUrlRoundRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pk = await resolvePokerSessionPk(sessionId, teamRoute ?? null);
      if (!cancelled) setResolvedSessionPk(pk);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, teamRoute?.teamId, teamRoute?.slug]);

  useEffect(() => {
    lastAppliedUrlRoundRef.current = undefined;
  }, [resolvedSessionPk]);

  const fetchRounds = useCallback(async () => {
    const pk = resolvedSessionPk;
    if (!pk) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('poker_session_rounds')
        .select('*')
        .eq('session_id', pk)
        .order('round_number', { ascending: true });

      if (error) {
        console.error('Error fetching rounds:', error);
        toast({ title: 'Error fetching history', variant: 'destructive' });
        return;
      }

      setRounds(data || []);
      
      if (data && data.length > 0) {
        const desiredRoundNumber = selectedRoundNumberRef.current ?? initialRoundNumber;
        const targetIndex =
          desiredRoundNumber !== undefined
            ? data.findIndex((round) => round.round_number === desiredRoundNumber)
            : -1;

        if (targetIndex !== -1) {
          setCurrentRoundIndex(targetIndex);
        } else if (initialRoundNumber !== undefined) {
          // If specified round not found, default to latest
          setCurrentRoundIndex(data.length - 1);
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
  }, [resolvedSessionPk, initialRoundNumber, toast]);

  useEffect(() => {
    if (!resolvedSessionPk) {
      setRounds([]);
      setCurrentRoundIndex(0);
      return;
    }

    void fetchRounds();

    const handleFollowCurrentRound = (e: Event) => {
      const ce = e as CustomEvent<PokerFollowCurrentRoundDetail>;
      const { sessionId: sid, roundNumber } = ce.detail || ({} as PokerFollowCurrentRoundDetail);
      if (sid !== resolvedSessionPk || typeof roundNumber !== 'number') return;
      selectedRoundNumberRef.current = roundNumber;
      void fetchRounds();
    };
    window.addEventListener(POKER_FOLLOW_CURRENT_ROUND_EVENT, handleFollowCurrentRound);

    const channel = supabase
      .channel(`poker_session_rounds-changes-for-${resolvedSessionPk}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poker_session_rounds',
          filter: `session_id=eq.${resolvedSessionPk}`,
        },
        () => {
          void fetchRounds();
        }
      )
      .subscribe();
    
    // Listen for the custom event to refetch rounds
    const handleRoundEnded = () => void fetchRounds();
    window.addEventListener('round-ended', handleRoundEnded);

    const handleRoundsDeleted = () => void fetchRounds();
    window.addEventListener('rounds-deleted', handleRoundsDeleted);

    return () => {
      window.removeEventListener(POKER_FOLLOW_CURRENT_ROUND_EVENT, handleFollowCurrentRound);
      supabase.removeChannel(channel);
      window.removeEventListener('round-ended', handleRoundEnded);
      window.removeEventListener('rounds-deleted', handleRoundsDeleted);
    };
  }, [resolvedSessionPk, fetchRounds]);

  useEffect(() => {
    const round = rounds[currentRoundIndex];
    if (round) selectedRoundNumberRef.current = round.round_number;
  }, [rounds, currentRoundIndex]);

  useEffect(() => {
    if (initialRoundNumber === undefined) {
      lastAppliedUrlRoundRef.current = undefined;
      return;
    }
    if (rounds.length === 0) return;
    const idx = rounds.findIndex((r) => r.round_number === initialRoundNumber);
    if (idx === -1) return;
    if (lastAppliedUrlRoundRef.current === initialRoundNumber) return;

    lastAppliedUrlRoundRef.current = initialRoundNumber;
    selectedRoundNumberRef.current = initialRoundNumber;
    setCurrentRoundIndex(idx);
  }, [initialRoundNumber, rounds]);

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

  const goToRound = (roundNumber: number) => {
    const targetIndex = rounds.findIndex((round) => round.round_number === roundNumber);
    if (targetIndex !== -1) {
      setCurrentRoundIndex(targetIndex);
    }
  };

  const deleteRound = async (roundId: string) => {
    if (rounds.length <= 1) {
      toast({ title: 'Cannot delete the last round', variant: 'destructive' });
      return false;
    }
    const pk = resolvedSessionPk;
    if (!pk) return false;

    try {
      const roundToDelete = rounds.find((round) => round.id === roundId);
      if (!roundToDelete) {
        toast({ title: 'Round not found', variant: 'destructive' });
        return false;
      }
      const successTitle = roundToDelete.is_active ? 'Round cancelled' : 'Round deleted';
      const remaining = rounds.filter((r) => r.id !== roundId);

      const { data: sessionRow, error: sessionFetchError } = await supabase
        .from('poker_sessions')
        .select('current_round_number')
        .eq('id', pk)
        .single();

      if (sessionFetchError || sessionRow == null) {
        console.error('Error loading session for delete round', sessionFetchError);
        toast({ title: 'Error cancelling round', variant: 'destructive' });
        return false;
      }

      const pointerWasDeleted = sessionRow.current_round_number === roundToDelete.round_number;

      if (pointerWasDeleted && remaining.length > 0) {
        const newCurrent = Math.max(...remaining.map((r) => r.round_number));
        const { error: sessionUpdateError } = await supabase
          .from('poker_sessions')
          .update({ current_round_number: newCurrent })
          .eq('id', pk);
        if (sessionUpdateError) {
          console.error('Error repointing session after round delete', sessionUpdateError);
          toast({ title: 'Error cancelling round', variant: 'destructive' });
          return false;
        }
        await supabase.from('poker_session_rounds').update({ is_active: false }).eq('session_id', pk);
        await supabase
          .from('poker_session_rounds')
          .update({ is_active: true })
          .eq('session_id', pk)
          .eq('round_number', newCurrent);

        window.dispatchEvent(
          new CustomEvent(POKER_FOLLOW_CURRENT_ROUND_EVENT, {
            detail: { sessionId: pk, roundNumber: newCurrent },
          })
        );
      }

      const { error } = await supabase.from('poker_session_rounds').delete().eq('id', roundId);

      if (error) {
        console.error('Error deleting round:', error);
        toast({ title: 'Error deleting round', variant: 'destructive' });
        return false;
      }

      toast({ title: successTitle });
      await fetchRounds();
      window.dispatchEvent(new Event('rounds-deleted'));
      return true;
    } catch (error) {
      console.error('Error deleting round:', error);
      toast({ title: 'Error deleting round', variant: 'destructive' });
      return false;
    }
  };

  const currentRound = rounds[currentRoundIndex] || null;
  const isViewingHistory = currentRound ? !currentRound.is_active : true;
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
    goToRound,
    deleteRound,
    fetchRounds,
  };
};
