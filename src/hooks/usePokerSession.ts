import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  PokerSessionRound,
  POKER_FOLLOW_CURRENT_ROUND_EVENT,
} from './usePokerSessionHistory';
import { isUuidLike } from '@/lib/pokerSessionPathSlug';
import {
  fetchLatestPokerSessionRowForTeam,
  pokerSessionSettingsFromPreviousRow,
} from '@/lib/pokerSessionCloneSettings';
import { roundTicketPlaceholder } from '@/lib/pokerRoundTicketPlaceholder';

// Define types for session state
export interface PlayerSelection {
  points: number;
  /** When set with `points` as the lower Fibonacci value, vote is "between" that value and this one. */
  betweenHighPoints?: number;
  locked: boolean;
  name: string;
}

export interface Selections {
  [userId: string]: PlayerSelection;
}

export type GameState = 'Selection' | 'Playing';

export type WinningPoints =
  | { kind: 'single'; points: number }
  | { kind: 'between'; low: number; high: number };

/**
 * Plurality by numeric point value. A "between low–high" vote counts as a full vote for each endpoint.
 * Tie-break: higher point value wins (same as integer vote tie-break).
 */
export function getWinningVoteFromSelections(selections: PlayerSelection[]): WinningPoints {
  const participating = selections.filter((s) => s.points !== -1);
  if (participating.length === 0) return { kind: 'single', points: 0 };

  const weightByPoints = new Map<number, number>();
  const addWeight = (pt: number, w: number) => {
    weightByPoints.set(pt, (weightByPoints.get(pt) || 0) + w);
  };

  for (const s of participating) {
    if (s.betweenHighPoints != null) {
      const low = Math.min(s.points, s.betweenHighPoints);
      const high = Math.max(s.points, s.betweenHighPoints);
      addWeight(low, 1);
      addWeight(high, 1);
    } else {
      addWeight(s.points, 1);
    }
  }

  let bestPoints = 0;
  let bestWeight = -1;
  for (const [points, weight] of weightByPoints) {
    if (weight > bestWeight || (weight === bestWeight && points > bestPoints)) {
      bestWeight = weight;
      bestPoints = points;
    }
  }

  return { kind: 'single', points: bestPoints };
}

/** Value stored in `average_points` when the round is revealed (between → lower bound). */
export function winningVoteToStoredAveragePoints(w: WinningPoints): number {
  if (w.kind === 'single') return w.points;
  return w.low;
}

/** Returns stored average_points value; between winner uses lower bound. */
export function getPointsWithMostVotes(selections: PlayerSelection[]): number {
  return winningVoteToStoredAveragePoints(getWinningVoteFromSelections(selections));
}

// The main session object is now much simpler
export interface PokerSession {
  id: string;
  room_id: string;
  current_round_number: number;
  presence_enabled?: boolean;
  send_to_slack?: boolean;
  observer_ids?: string[];
  /** User currently holding spotlight; paired with `spotlight_round_number`. */
  spotlight_user_id?: string | null;
  /** Browser tab/window id for the client that holds spotlight (with `spotlight_user_id`). */
  spotlight_client_id?: string | null;
  spotlight_round_number?: number | null;
  /** When true (default), other participants jump to `spotlight_round_number` when the holder changes rounds. */
  spotlight_follow_enabled?: boolean;
}

// This is the composite type we'll use in the hook
export type PokerSessionState = Omit<PokerSession, 'id'> & { session_id: string } & Omit<PokerSessionRound, 'session_id' | 'completed_at'>;


export const usePokerSession = (
  roomId: string | null,
  currentUserId: string | undefined,
  currentUserDisplayName: string | undefined,
  shouldCreate: boolean = false,
  teamId?: string | null
) => {
  const [session, setSession] = useState<PokerSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  /** True when the row was removed in the DB (e.g. team admin deleted the session). */
  const [sessionDeletedRemotely, setSessionDeletedRemotely] = useState(false);
  const { toast } = useToast();
  const sessionChannelRef = useRef<RealtimeChannel | null>(null);
  const roundChannelRef = useRef<RealtimeChannel | null>(null);
  const [presentUserIds, setPresentUserIds] = useState<string[]>([]);
  const [allUserIds, setAllUserIds] = useState<string[]>([]);

  // For team sessions, fetch the full roster and build a selections object from it.
  // Excludes observer_ids (they don't play, no slot on table).
  // Returns null for non-team sessions.
  const fetchTeamSelections = useCallback(async (
    tId: string,
    existingSelections?: Selections,
    observerIds: string[] = []
  ): Promise<Selections | null> => {
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', tId);

    if (membersError || !members) return null;

    const observerSet = new Set(observerIds);
    const userIds = members.map(m => m.user_id).filter(uid => !observerSet.has(uid));
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, nickname')
      .in('id', userIds);

    const profileMap = new Map(
      (profiles || []).map(p => [p.id, p.nickname || p.full_name || 'Player'])
    );

    const selections: Selections = {};
    for (const uid of userIds) {
      const existing = existingSelections?.[uid];
      selections[uid] = existing ?? {
        points: 1,
        locked: false,
        name: profileMap.get(uid) || 'Player',
      };
    }
    return selections;
  }, []);

  const manageSession = useCallback(async (options?: { showLoading?: boolean }) => {
    if (!roomId || !currentUserId || !currentUserDisplayName) return;
    const slug = roomId.trim();
    if (!slug || slug === 'null' || slug === 'undefined') {
      setSession(null);
      setLoading(false);
      return;
    }
    const showLoading = options?.showLoading ?? true;
    if (showLoading) setLoading(true);

    // 1. Fetch the main session by room_id, or by id when the URL uses the session UUID (legacy null room_id rows).
    let { data: sessionData, error } = await supabase
      .from('poker_sessions')
      .select('*')
      .eq('room_id', slug)
      .single();

    if (error?.code === 'PGRST116' && isUuidLike(slug)) {
      const { data: byId, error: idError } = await supabase
        .from('poker_sessions')
        .select('*')
        .eq('id', slug)
        .single();
      if (!idError && byId) {
        sessionData = byId;
        error = null;
      } else {
        sessionData = undefined;
        error = idError ?? error;
      }
    }

    // 2. Create session if it doesn't exist
    if (error && error.code === 'PGRST116' && shouldCreate) {
      let settingsFromPrevious: Record<string, unknown> = {};
      if (teamId) {
        const previousRow = await fetchLatestPokerSessionRowForTeam(supabase, teamId);
        settingsFromPrevious = pokerSessionSettingsFromPreviousRow(previousRow);
      }

      const insertPayload: Record<string, unknown> = {
        ...settingsFromPrevious,
        room_id: slug,
        current_round_number: 1,
      };
      if (teamId) insertPayload.team_id = teamId;

      const { data: newSession, error: createError } = await supabase
        .from('poker_sessions')
        .insert(insertPayload)
        .select()
        .single();
      
      if (createError) throw createError;
      sessionData = newSession;
    } else if (error) {
      throw error;
    }

    if (!sessionData) {
      setSession(null);
      setLoading(false);
      return;
    }

    const effectiveTeamId = teamId || sessionData.team_id;
    const observerIds: string[] = (sessionData as { observer_ids?: string[] }).observer_ids ?? [];

    // For team-bound sessions, verify the current user is a team member
    if (effectiveTeamId) {
      const { data: membership } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', effectiveTeamId)
        .eq('user_id', currentUserId)
        .single();

      if (!membership) {
        toast({ title: 'Access denied', description: 'Only team members can join this pointing session.', variant: 'destructive' });
        setSession(null);
        setLoading(false);
        return;
      }
    }

    // 3. Fetch the current round for the session
    let { data: roundData, error: roundError } = await supabase
      .from('poker_session_rounds')
      .select('*')
      .eq('session_id', sessionData.id)
      .eq('round_number', sessionData.current_round_number)
      .single();

    // 4. Create the first round if it doesn't exist
    if (roundError && roundError.code === 'PGRST116') {
      let initialSelections: Selections;
      const isCurrentUserObserver = observerIds.includes(currentUserId);

      if (effectiveTeamId) {
        initialSelections = await fetchTeamSelections(effectiveTeamId, undefined, observerIds) ?? {};
        if (!isCurrentUserObserver && Object.keys(initialSelections).length === 0) {
          initialSelections = { [currentUserId]: { points: 1, locked: false, name: currentUserDisplayName } };
        }
      } else {
        initialSelections = isCurrentUserObserver ? {} : {
          [currentUserId]: { points: 1, locked: false, name: currentUserDisplayName },
        };
      }

      const { data: newRound, error: newRoundError } = await supabase
        .from('poker_session_rounds')
        .insert({
          session_id: sessionData.id,
          round_number: sessionData.current_round_number,
          selections: initialSelections,
          ticket_number: roundTicketPlaceholder(sessionData.current_round_number),
          is_active: true,
          game_state: 'Selection',
        })
        .select()
        .single();

      if (newRoundError) throw newRoundError;
      roundData = newRound;
    } else if (roundError) {
      throw roundError;
    }

    // 5. Reconcile selections with the team roster (team sessions only)
    if (roundData && effectiveTeamId) {
      const reconciledSelections = await fetchTeamSelections(effectiveTeamId, roundData.selections, observerIds);
      if (reconciledSelections) {
        const currentKeys = Object.keys(roundData.selections).sort();
        const newKeys = Object.keys(reconciledSelections).sort();
        const needsUpdate =
          currentKeys.join(',') !== newKeys.join(',');

        if (needsUpdate) {
          roundData.selections = reconciledSelections;
          const { data: updatedRound, error: updateRoundError } = await supabase
            .from('poker_session_rounds')
            .update({ selections: reconciledSelections })
            .eq('id', roundData.id)
            .select()
            .single();

          if (updateRoundError) throw updateRoundError;
          roundData = updatedRound;
        }
      }
    } else if (roundData && !roundData.selections[currentUserId] && !observerIds.includes(currentUserId)) {
      // Non-team session: add the current user if they aren't already in selections and aren't an observer
      roundData.selections[currentUserId] = {
        points: 1,
        locked: false,
        name: currentUserDisplayName,
      };
      const { data: updatedRound, error: updateRoundError } = await supabase
        .from('poker_session_rounds')
        .update({ selections: roundData.selections })
        .eq('id', roundData.id)
        .select()
        .single();

      if (updateRoundError) throw updateRoundError;
      roundData = updatedRound;
    }
    
    // 6. Combine session and round data into a single state object.
    // Always set session_id from the poker_sessions row — `id` after spread is the *round* id, and
    // round rows must never be mistaken for the session id (breaks history fetch + realtime).
    setSession({
      ...sessionData,
      ...roundData,
      session_id: sessionData.id,
    } as PokerSessionState);
    setLoading(false);

  }, [roomId, currentUserId, currentUserDisplayName, toast, shouldCreate, teamId, fetchTeamSelections]);

  useEffect(() => {
    setSessionDeletedRemotely(false);
  }, [roomId]);

  useEffect(() => {
    manageSession().catch(e => {
      console.error(e);
      toast({ title: 'Error loading session', description: e.message, variant: 'destructive' });
      setSession(null);
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
        const oldRow = payload.old as unknown as Record<string, unknown> | undefined;
        const row = payload.new as unknown as Record<string, unknown>;
        if (
          oldRow &&
          oldRow.current_round_number !== undefined &&
          row.current_round_number !== undefined &&
          oldRow.current_round_number !== row.current_round_number
        ) {
          void manageSession({ showLoading: false });
          return;
        }
        // Merge only poker_sessions columns. `prev.id` is the current round row id;
        // spreading payload.new would overwrite it with the session id and break updates.
        setSession((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            current_round_number: row.current_round_number as number,
            observer_ids: (row.observer_ids as string[] | undefined) ?? prev.observer_ids,
            presence_enabled:
              row.presence_enabled === null || row.presence_enabled === undefined
                ? prev.presence_enabled
                : (row.presence_enabled as boolean),
            send_to_slack:
              row.send_to_slack === null || row.send_to_slack === undefined
                ? prev.send_to_slack
                : (row.send_to_slack as boolean),
            spotlight_user_id:
              row.spotlight_user_id === undefined
                ? prev.spotlight_user_id
                : (row.spotlight_user_id as string | null),
            spotlight_client_id:
              row.spotlight_client_id === undefined
                ? prev.spotlight_client_id
                : (row.spotlight_client_id as string | null),
            spotlight_round_number:
              row.spotlight_round_number === undefined
                ? prev.spotlight_round_number
                : (row.spotlight_round_number as number | null),
            spotlight_follow_enabled:
              row.spotlight_follow_enabled === null || row.spotlight_follow_enabled === undefined
                ? prev.spotlight_follow_enabled
                : (row.spotlight_follow_enabled as boolean),
          };
        });
      }
    );

    channel.on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'poker_sessions',
        filter: `id=eq.${session.session_id}`,
      },
      () => {
        setSessionDeletedRemotely(true);
        setSession(null);
        setLoading(false);
      }
    );

    channel.on(
      'broadcast',
      { event: 'next_round_initiated' },
      ({ payload }: { payload?: { roundNumber?: number } }) => {
        const rn = payload?.roundNumber;
        if (typeof rn === 'number') {
          window.dispatchEvent(
            new CustomEvent(POKER_FOLLOW_CURRENT_ROUND_EVENT, {
              detail: { sessionId: session.session_id, roundNumber: rn },
            })
          );
        }
        manageSession({ showLoading: false });
      }
    );

    channel.on(
      'broadcast',
      { event: 'round_updated' },
      (msg) => {
        const data = msg.payload as Record<string, unknown> | undefined;
        if (!data) return;
        if (data.senderUserId === currentUserId) return;

        setSession((prev) => {
          if (!prev) return null;
          const { senderUserId: _u, session_id: _sid, ...roundPatch } = data;
          return { ...prev, ...roundPatch, session_id: prev.session_id };
        });
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
  }, [session?.session_id, currentUserId, currentUserDisplayName, session?.presence_enabled, manageSession]);

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
    const { data, error } = await supabase
      .from('poker_session_rounds')
      .update(newState)
      .eq('id', session.id)
      .select()
      .single();

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
    const { error } = await supabase
      .from('poker_sessions')
      .update(newConfig)
      .eq('id', session.session_id);
    if (error) {
      console.error('Error updating session config', error);
      return;
    }
    const hasSpotlightPatch =
      newConfig.spotlight_user_id !== undefined ||
      newConfig.spotlight_round_number !== undefined ||
      newConfig.spotlight_client_id !== undefined;
    if (hasSpotlightPatch && newConfig.observer_ids === undefined) {
      setSession((prev) =>
        prev
          ? {
              ...prev,
              ...(newConfig.spotlight_user_id !== undefined
                ? { spotlight_user_id: newConfig.spotlight_user_id }
                : {}),
              ...(newConfig.spotlight_client_id !== undefined
                ? { spotlight_client_id: newConfig.spotlight_client_id }
                : {}),
              ...(newConfig.spotlight_round_number !== undefined
                ? { spotlight_round_number: newConfig.spotlight_round_number }
                : {}),
            }
          : null
      );
    }
    // When observer_ids changes, sync current round selections (remove observers, add un-observers)
    if (newConfig.observer_ids !== undefined) {
      const effectiveTeamId = teamId || null;
      const oldObserverIds = (session as PokerSessionState & { observer_ids?: string[] }).observer_ids ?? [];
      let newSelections: Selections;
      if (effectiveTeamId) {
        newSelections = await fetchTeamSelections(effectiveTeamId, session.selections, newConfig.observer_ids) ?? session.selections;
      } else {
        const newObserverSet = new Set(newConfig.observer_ids);
        const oldObserverSet = new Set(oldObserverIds);
        newSelections = { ...session.selections };
        newConfig.observer_ids.forEach(uid => delete newSelections[uid]);
        const toAddBack = oldObserverIds.filter(uid => !newObserverSet.has(uid));
        if (toAddBack.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, full_name, nickname').in('id', toAddBack);
          const profileMap = new Map((profiles || []).map(p => [p.id, p.nickname || p.full_name || 'Player']));
          toAddBack.forEach(uid => {
            newSelections[uid] = session.selections[uid] ?? { points: 1, locked: false, name: profileMap.get(uid) || 'Player' };
          });
        }
      }
      if (Object.keys(newSelections).sort().join(',') !== Object.keys(session.selections).sort().join(',')) {
        await updateRoundState({ selections: newSelections });
        // Update local state immediately (broadcast is ignored for current user)
        setSession(prev => prev ? { ...prev, selections: newSelections, observer_ids: newConfig.observer_ids } : null);
      } else {
        setSession(prev => prev ? { ...prev, observer_ids: newConfig.observer_ids } : null);
      }
    }
  };

  const updateTicketNumber = async (
    ticketNumber: string,
    ticketTitle?: string | null,
    ticketParent?: { key: string; summary: string } | null
  ) => {
    if (!session) return;
    const trimmed = ticketNumber.trim();
    const persisted = trimmed || roundTicketPlaceholder(session.round_number);
    setSession((prev) => {
      if (!prev) return null;
      const next: PokerSessionState = {
        ...prev,
        ticket_number: persisted,
        ticket_title: ticketTitle ?? prev.ticket_title ?? null,
      };
      if (ticketParent !== undefined) {
        next.ticket_parent_key = ticketParent?.key ?? null;
        next.ticket_parent_summary = ticketParent?.summary ?? null;
      }
      return next;
    });
    const payload: Partial<PokerSessionRound> = {
      ticket_number: persisted,
      ticket_title: ticketTitle ?? null,
    };
    if (ticketParent !== undefined) {
      payload.ticket_parent_key = ticketParent?.key ?? null;
      payload.ticket_parent_summary = ticketParent?.summary ?? null;
    }
    await updateRoundState(payload);
  };
  
  const playHand = async () => {
    if (!session) return;
    const newSelections: Selections = { ...session.selections };
    Object.values(newSelections).forEach((s: PlayerSelection) => { if (!s.locked) s.points = -1; });
    const participating = Object.values(newSelections).filter((s: PlayerSelection) => s.points !== -1);
    const winning_points = getPointsWithMostVotes(participating);
    const newState = { game_state: 'Playing' as GameState, selections: newSelections, average_points: winning_points };

    setSession(prev => prev ? { ...prev, ...newState } : null);
    await updateRoundState(newState);

    // Notify once when the first hand starts; not on later rounds.
    try {
      const participantIds = Object.keys(newSelections);
      if (participantIds.length > 0 && session.round_number === 1) {
        const title = `Poker session started`;
        const pathSlug = session.room_id?.trim() || session.session_id;
        const notificationUrl = teamId 
          ? `/teams/${teamId}/poker/${pathSlug}`
          : `/poker/${pathSlug}`;
        await supabase.functions.invoke('admin-send-notification', {
          body: {
            recipients: participantIds.map(id => ({ userId: id })),
            type: 'poker_session',
            title,
            message: 'Click to join the session.',
            url: notificationUrl
          }
        });
      }
    } catch (e) {
      console.warn('Failed to emit poker notifications', e);
    }
  };

  const nextRound = async (newTicketNumber?: string) => {
    if (!session) return;

    const newRoundNumber = session.round_number + 1;
    const effectiveTeamId = teamId || null;
    const observerIds: string[] = (session as PokerSessionState & { observer_ids?: string[] }).observer_ids ?? [];

    let resetSelections: Selections;
    if (effectiveTeamId) {
      resetSelections = await fetchTeamSelections(effectiveTeamId, undefined, observerIds) ?? {};
    } else {
      resetSelections = {};
      const observerSet = new Set(observerIds);
      Object.entries(session.selections).forEach(([key, sel]) => {
        if (!observerSet.has(key)) {
          const { betweenHighPoints: _bn, ...selBase } = sel as PlayerSelection;
          resetSelections[key] = { ...selBase, points: 1, locked: false };
        }
      });
    }

    // Deactivate all currently-active rounds (Next Round is the "single active" flow).
    await supabase
      .from('poker_session_rounds')
      .update({ is_active: false })
      .eq('session_id', session.session_id)
      .eq('is_active', true);

    const { error: newRoundError } = await supabase.from('poker_session_rounds').insert({
        session_id: session.session_id,
        round_number: newRoundNumber,
        selections: resetSelections,
        ticket_number: newTicketNumber?.trim() || roundTicketPlaceholder(newRoundNumber),
        is_active: true,
        game_state: 'Selection',
    });

    if (newRoundError) {
        console.error('Error creating new round', newRoundError);
        return;
    }

    // Sync: update history selection ref before postgres realtime merge (race with selectedRoundNumberRef).
    window.dispatchEvent(
      new CustomEvent(POKER_FOLLOW_CURRENT_ROUND_EVENT, {
        detail: { sessionId: session.session_id, roundNumber: newRoundNumber },
      })
    );

    // 2. Update the session to point to the new round
    // The realtime subscription on the session table will trigger a full refresh for all clients.
    await supabase.from('poker_sessions').update({ current_round_number: newRoundNumber }).eq('id', session.session_id);

    // 3. Broadcast to all clients to refetch the session data
    if (sessionChannelRef.current) {
      await sessionChannelRef.current.send({
        type: 'broadcast',
        event: 'next_round_initiated',
        payload: { roundNumber: newRoundNumber },
      });
    }

    // 4. Manually refetch for the local user (keep UI mounted — no full-page loading state)
    manageSession({ showLoading: false });
  };

  const startNewRound = async (
    newTicketNumber?: string,
    newTicketTitle?: string | null,
    ticketParent?: { key: string; summary: string } | null
  ) => {
    if (!session) return;

    const newRoundNumber = session.round_number + 1;
    const trimmedTicket = newTicketNumber?.trim() ?? '';
    const ticketToStore = trimmedTicket || roundTicketPlaceholder(newRoundNumber);
    const effectiveTeamId = teamId || null;
    const observerIds: string[] = (session as PokerSessionState & { observer_ids?: string[] }).observer_ids ?? [];

    let resetSelections: Selections;
    if (effectiveTeamId) {
      resetSelections = await fetchTeamSelections(effectiveTeamId, undefined, observerIds) ?? {};
    } else {
      resetSelections = {};
      const observerSet = new Set(observerIds);
      Object.entries(session.selections).forEach(([key, sel]) => {
        if (!observerSet.has(key)) {
          const { betweenHighPoints: _bn, ...selBase } = sel as PlayerSelection;
          resetSelections[key] = { ...selBase, points: 1, locked: false };
        }
      });
    }

    const { error: newRoundError } = await supabase.from('poker_session_rounds').insert({
      session_id: session.session_id,
      round_number: newRoundNumber,
      selections: resetSelections,
      ticket_number: ticketToStore,
      ticket_title: newTicketTitle ?? null,
      ticket_parent_key: ticketParent?.key ?? null,
      ticket_parent_summary: ticketParent?.summary ?? null,
      is_active: true,
      game_state: 'Selection',
    });

    if (newRoundError) {
        console.error('Error creating new round', newRoundError);
        return;
    }

    window.dispatchEvent(
      new CustomEvent(POKER_FOLLOW_CURRENT_ROUND_EVENT, {
        detail: { sessionId: session.session_id, roundNumber: newRoundNumber },
      })
    );

    // Update session pointer so clients (and chat/queue) know which round is "latest".
    await supabase.from('poker_sessions').update({ current_round_number: newRoundNumber }).eq('id', session.session_id);

    // Reuse existing event so clients refetch their session-level data.
    if (sessionChannelRef.current) {
      await sessionChannelRef.current.send({
        type: 'broadcast',
        event: 'next_round_initiated',
        payload: { roundNumber: newRoundNumber },
      });
    }

    manageSession({ showLoading: false });
  };

  const startNewRounds = async (
    tickets: Array<{
      ticketNumber: string;
      ticketTitle?: string | null;
      ticketParent?: { key: string; summary: string } | null;
    }>
  ) => {
    if (!session) return;
    const normalizedTickets = tickets
      .map((t) => ({
        ticketNumber: t.ticketNumber.trim(),
        ticketTitle: t.ticketTitle ?? null,
        ticketParent: t.ticketParent,
      }))
      .filter((t) => t.ticketNumber);
    if (normalizedTickets.length === 0) return;

    const effectiveTeamId = teamId || null;
    const observerIds: string[] = (session as PokerSessionState & { observer_ids?: string[] }).observer_ids ?? [];

    let resetSelections: Selections;
    if (effectiveTeamId) {
      resetSelections = await fetchTeamSelections(effectiveTeamId, undefined, observerIds) ?? {};
    } else {
      resetSelections = {};
      const observerSet = new Set(observerIds);
      Object.entries(session.selections).forEach(([key, sel]) => {
        if (!observerSet.has(key)) {
          const { betweenHighPoints: _bn, ...selBase } = sel as PlayerSelection;
          resetSelections[key] = { ...selBase, points: 1, locked: false };
        }
      });
    }

    const { data: highestRoundData, error: highestRoundError } = await supabase
      .from('poker_session_rounds')
      .select('round_number')
      .eq('session_id', session.session_id)
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (highestRoundError) {
      console.error('Error loading highest round number', highestRoundError);
      return;
    }

    const startingRoundNumber = Math.max(session.round_number, highestRoundData?.round_number ?? 0);
    const roundsToInsert = normalizedTickets.map((ticket, index) => ({
      session_id: session.session_id,
      round_number: startingRoundNumber + index + 1,
      selections: resetSelections,
      ticket_number: ticket.ticketNumber,
      ticket_title: ticket.ticketTitle,
      ticket_parent_key: ticket.ticketParent?.key ?? null,
      ticket_parent_summary: ticket.ticketParent?.summary ?? null,
      is_active: true,
      game_state: 'Selection' as const,
    }));

    const { error: newRoundsError } = await supabase
      .from('poker_session_rounds')
      .insert(roundsToInsert);

    if (newRoundsError) {
      console.error('Error creating new rounds', newRoundsError);
      return;
    }

    const latestRoundNumber = startingRoundNumber + normalizedTickets.length;

    await supabase
      .from('poker_sessions')
      .update({ current_round_number: latestRoundNumber })
      .eq('id', session.session_id);

    if (sessionChannelRef.current) {
      await sessionChannelRef.current.send({
        type: 'broadcast',
        event: 'next_round_initiated',
        payload: { roundNumber: latestRoundNumber },
      });
    }

    manageSession({ showLoading: false });
  };

  const deleteAllRounds = async () => {
    if (!session) return;
    try {
      const { error } = await supabase.functions.invoke('delete-session-data', {
        body: { session_id: session.session_id },
      });
      if (error) throw new Error(`Function invocation failed: ${error.message}`);
      toast({ title: 'All previous rounds have been deleted.' });
      window.dispatchEvent(new Event('rounds-deleted'));
      window.dispatchEvent(new Event('chats-deleted'));
    } catch (e: any) {
      console.error('Error deleting session data:', e);
      toast({ title: 'Error deleting session data', description: e.message, variant: 'destructive' });
    }
  };

  return {
    session,
    loading,
    sessionDeletedRemotely,
    updateUserSelection,
    toggleLockUserSelection,
    toggleAbstainUserSelection,
    playHand,
    nextRound,
    startNewRound,
    startNewRounds,
    updateTicketNumber,
    presentUserIds: session?.presence_enabled === false ? allUserIds : presentUserIds,
    updateSessionConfig,
    deleteAllRounds,
  };
};
