import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPokerSessionByRoom, createPokerSession, getPokerRound, createPokerRound, updatePokerRoundById, updatePokerSessionById, deletePokerSessionData } from '@/lib/dataClient';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChannel } from '@supabase/supabase-js';
import { PokerSessionRound } from './usePokerSessionHistory';

// Define types for session state
export interface PlayerSelection {
  points: number;
  locked: boolean;
  name: string;
}

export interface Selections {
  [userId: string]: PlayerSelection;
}

export type GameState = 'Selection' | 'Playing';

// The main session object is now much simpler
export interface PokerSession {
  id: string;
  room_id: string;
  current_round_number: number;
  presence_enabled?: boolean;
  send_to_slack?: boolean;
}

// This is the composite type we'll use in the hook
export type PokerSessionState = Omit<PokerSession, 'id'> & { session_id: string } & Omit<PokerSessionRound, 'session_id' | 'completed_at'>;


export const usePokerSession = (
  roomId: string | null,
  currentUserId: string | undefined,
  currentUserDisplayName: string | undefined,
  shouldCreate: boolean = false
) => {
  const [session, setSession] = useState<PokerSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const sessionChannelRef = useRef<RealtimeChannel | null>(null);
  const roundChannelRef = useRef<RealtimeChannel | null>(null);
  const [presentUserIds, setPresentUserIds] = useState<string[]>([]);
  const [allUserIds, setAllUserIds] = useState<string[]>([]);

  const manageSession = useCallback(async () => {
    if (!roomId || !currentUserId || !currentUserDisplayName) return;
    setLoading(true);

    // 1. Fetch the main session
    let sessionData = await getPokerSessionByRoom(roomId);

    // 2. Create session if it doesn't exist
    if (!sessionData && shouldCreate) {
      sessionData = await createPokerSession(roomId);
    } else if (!sessionData) {
      throw new Error('Session not found');
    }

    if (!sessionData) {
      setSession(null);
      setLoading(false);
      return;
    }

    // 3. Fetch the current round for the session
    let roundData = await getPokerRound(sessionData.id, sessionData.current_round_number);

    // 4. Create the first round if it doesn't exist
    if (!roundData) {
      const initialSelections: Selections = { [currentUserId]: { points: 1, locked: false, name: currentUserDisplayName } };
      roundData = await createPokerRound(sessionData.id, sessionData.current_round_number, initialSelections);
    }

    // 5. Add user to selections if they aren't there
    if (roundData && !roundData.selections[currentUserId]) {
      roundData.selections[currentUserId] = {
        points: 1,
        locked: false,
        name: currentUserDisplayName,
      };
      roundData = await updatePokerRoundById(roundData.id, { selections: roundData.selections });
    }

    // 6. Combine session and round data into a single state object
    setSession({ ...sessionData, ...roundData });
    setLoading(false);

  }, [roomId, currentUserId, currentUserDisplayName, toast, shouldCreate]);

  useEffect(() => {
    manageSession().catch(e => {
      console.error(e);
      toast({ title: 'Error loading session', description: e.message, variant: 'destructive' });
      setLoading(false);
    });
  }, [manageSession]);

  // Main channel for session-level events (presence, round changes)
  useEffect(() => {
    if (!session || !currentUserId || !currentUserDisplayName) return;

    const channel = supabase.channel(`poker_session:${session.session_id}`, {
      config: {
        presence: { key: currentUserId },
      },
    });

    sessionChannelRef.current = channel;

    channel.on<PokerSession>(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'poker_sessions',
        filter: `id=eq.${session.session_id}`
      },
      (payload) => {
        // A change to the session table (like config) triggers a state update.
        // Round changes are handled by the 'next_round_initiated' broadcast.
        setSession(prev => prev ? ({ ...prev, ...(payload.new as PokerSession) }) : null);
      }
    );

    channel.on(
      'broadcast',
      { event: 'next_round_initiated' },
      () => {
        manageSession();
      }
    );

    channel.on(
      'broadcast',
      { event: 'round_updated' },
      (payload) => {
        // Ignore broadcast if it's from the current user
        if (payload.senderUserId === currentUserId) return;

        setSession(prev => prev ? ({ ...prev, ...payload.payload }) : null);
      }
    );

    const isPresenceEnabled = session.presence_enabled !== false;
    if (isPresenceEnabled) {
      channel.on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const userIds = Object.keys(presenceState);
        setPresentUserIds(userIds);
      });

      channel.on('presence', { event: 'join' }, ({ key }) => {
        setPresentUserIds((prev) => [...new Set([...prev, key])]);
      });

      channel.on('presence', { event: 'leave' }, ({ key }) => {
        setPresentUserIds((prev) => prev.filter(id => id !== key));
      });
    }

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && isPresenceEnabled) {
        await channel.track({ user_id: currentUserId });
      }
    });

    return () => {
      if (sessionChannelRef.current) {
        supabase.removeChannel(sessionChannelRef.current);
        sessionChannelRef.current = null;
      }
    };
  }, [session?.session_id, currentUserId, currentUserDisplayName, session?.presence_enabled]);

  // Channel for round-specific updates is no longer needed for this approach.
  useEffect(() => {
    // Remove previous round channel if it exists
    if (roundChannelRef.current) {
      supabase.removeChannel(roundChannelRef.current);
      roundChannelRef.current = null;
    }
  }, [session?.id, session?.round_number]);

  useEffect(() => {
    if (session) {
      const userIds = Object.keys(session.selections);
      setAllUserIds(userIds);
      if (session.presence_enabled === false) {
        setPresentUserIds(userIds);
      }
    }
  }, [session?.selections, session?.presence_enabled]);


  const updateRoundState = async (newState: Partial<PokerSessionRound>) => {
    if (!session) return;
    const { data, error } = await updatePokerRoundById(session.id, newState);

    if (error) {
      console.error('Error updating round state:', error);
      toast({ title: 'Error updating round', description: error.message, variant: 'destructive' });
      return;
    }

    // Broadcast the change
    if (sessionChannelRef.current) {
      await sessionChannelRef.current.send({
        type: 'broadcast',
        event: 'round_updated',
        payload: { ...newState, senderUserId: currentUserId }
      });
    }
  };

  const updateUserSelection = async (points: number) => {
    if (!session || !currentUserId) return;
    const userSelection = session.selections[currentUserId];
    if (userSelection && !userSelection.locked) {
      const newSelections = { ...session.selections, [currentUserId]: { ...userSelection, points } };
      setSession(prev => prev ? { ...prev, selections: newSelections } : null);
      await updateRoundState({ selections: newSelections });
    }
  };

  const toggleLockUserSelection = async () => {
    if (!session || !currentUserId) return;
    const userSelection = session.selections[currentUserId];
    if (userSelection && userSelection.points !== -1) {
      const newSelections = { ...session.selections, [currentUserId]: { ...userSelection, locked: !userSelection.locked } };
      setSession(prev => prev ? { ...prev, selections: newSelections } : null);
      await updateRoundState({ selections: newSelections });
    }
  };

  const toggleAbstainUserSelection = async () => {
    if (!session || !currentUserId) return;
    const userSelection = session.selections[currentUserId];
    if (userSelection) {
      const isCurrentlyAbstained = userSelection.points === -1;
      const newSelection = {
        ...userSelection,
        points: isCurrentlyAbstained ? 1 : -1,
        locked: !isCurrentlyAbstained,
      };
      const newSelections = { ...session.selections, [currentUserId]: newSelection };
      setSession(prev => prev ? { ...prev, selections: newSelections } : null);
      await updateRoundState({ selections: newSelections });
    }
  };

  const updateSessionConfig = async (newConfig: Partial<PokerSession>) => {
    if (!session) return;
    await updatePokerSessionById(session.session_id, newConfig);
  };

  const updateTicketNumber = async (ticketNumber: string) => {
    await updateRoundState({ ticket_number: ticketNumber });
  };

  const playHand = async () => {
    if (!session) return;
    const newSelections: Selections = { ...session.selections };
    Object.values(newSelections).forEach((s: PlayerSelection) => { if (!s.locked) s.points = -1; });
    const participating = Object.values(newSelections).filter((s: PlayerSelection) => s.points !== -1);
    const average_points = participating.length > 0 ? participating.reduce((a, b) => a + b.points, 0) / participating.length : 0;

    const newState = { game_state: 'Playing' as GameState, selections: newSelections, average_points };

    setSession(prev => prev ? { ...prev, ...newState } : null);
    await updateRoundState(newState);

    // Emit notification to known participants when the hand starts
    try {
      const participantIds = Object.keys(newSelections);
      if (participantIds.length > 0) {
        const title = `Poker session started`;
        const roomId = session.room_id;
        // Use admin-send-notification for consistency and future flexibility
        await supabase.functions.invoke('admin-send-notification', {
          body: {
            recipients: participantIds.map(id => ({ userId: id })),
            type: 'poker_session',
            title,
            message: 'Click to join the session.',
            url: `/poker/${roomId}`
          }
        });
      }
    } catch (e) {
      console.warn('Failed to emit poker notifications', e);
    }
  };

  const nextRound = async (newTicketNumber?: string) => {
    if (!session) return;

    // 1. Create the new round
    const newRoundNumber = session.round_number + 1;
    const resetSelections: Selections = {};
    Object.keys(session.selections).forEach(key => {
      resetSelections[key] = { ...session.selections[key], points: 1, locked: false };
    });

    await createPokerRound(session.session_id, newRoundNumber, resetSelections, newTicketNumber);

    // 2. Update the session to point to the new round
    // The realtime subscription on the session table will trigger a full refresh for all clients.
    await updatePokerSessionById(session.session_id, { current_round_number: newRoundNumber });

    // 3. Broadcast to all clients to refetch the session data
    if (sessionChannelRef.current) {
      await sessionChannelRef.current.send({
        type: 'broadcast',
        event: 'next_round_initiated',
      });
    }

    // 4. Manually refetch for the local user
    manageSession();
  };

  const deleteAllRounds = async () => {
    if (!session) return;
    try {
      await deletePokerSessionData(session.session_id);
      toast({ title: 'All previous rounds have been deleted.' });
      window.dispatchEvent(new Event('rounds-deleted'));
      window.dispatchEvent(new Event('chats-deleted'));
    } catch (e: any) {
      console.error('Error deleting session data:', e);
      toast({ title: 'Error deleting session data', description: e.message, variant: 'destructive' });
    }
  };

  return { session, loading, updateUserSelection, toggleLockUserSelection, toggleAbstainUserSelection, playHand, nextRound, updateTicketNumber, presentUserIds: session?.presence_enabled === false ? allUserIds : presentUserIds, updateSessionConfig, deleteAllRounds };
};
