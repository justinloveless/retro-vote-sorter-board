import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js';

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

export interface PokerSession {
  id: string;
  team_id: string;
  selections: Selections;
  game_state: GameState;
  average_points: number;
  ticket_number: string | null;
}

interface TeamMember {
  user_id: string;
  profiles?: {
    full_name: string | null;
  } | null;
}

export const usePokerSession = (teamId: string | null, teamMembers: TeamMember[], currentUserId: string | undefined) => {
  const [session, setSession] = useState<PokerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [presentUserIds, setPresentUserIds] = useState<string[]>([]);

  const getOrCreateSession = useCallback(async () => {
    if (!teamId || !currentUserId || teamMembers.length === 0) return;
    setLoading(true);

    let { data: existingSession, error } = await supabase
      .from('poker_sessions')
      .select('*')
      .eq('team_id', teamId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
      console.error('Error fetching poker session:', error);
      toast({ title: 'Error fetching session', variant: 'destructive' });
      setLoading(false);
      return;
    }

    if (existingSession) {
      setSession(existingSession);
    } else {
      const initialSelections: Selections = {};
      teamMembers.forEach(member => {
        initialSelections[member.user_id] = {
          points: 0,
          locked: false,
          name: member.profiles?.full_name || 'Anonymous'
        };
      });

      const { data: newSession, error: createError } = await supabase
        .from('poker_sessions')
        .insert({ team_id: teamId, selections: initialSelections, game_state: 'Selection', ticket_number: '' })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating poker session:', createError);
        toast({ title: 'Error creating session', variant: 'destructive' });
      } else {
        setSession(newSession);
      }
    }
    setLoading(false);
  }, [teamId, currentUserId, teamMembers, toast]);

  useEffect(() => {
    getOrCreateSession();
  }, [getOrCreateSession]);
  
  useEffect(() => {
    if (!session || !currentUserId) return;

    const channel = supabase.channel(`poker_session:${session.id}`, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });
    channelRef.current = channel;

    channel.on<PokerSession>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'poker_sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          setSession(payload.new as PokerSession);
        }
      );

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

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: currentUserId });
      }
    });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [session, currentUserId]);

  const updateSelections = async (newSelections: Selections) => {
    if (!session) return;
    const { error } = await supabase
      .from('poker_sessions')
      .update({ selections: newSelections })
      .eq('id', session.id);

    if (error) {
      console.error('Error updating selections', error);
      toast({ title: 'Error updating selections', variant: 'destructive' });
    }
  };
  
  const updateUserSelection = async (points: number) => {
    if (!session || !currentUserId) return;
    const currentSelections = session.selections;
    const userSelection = currentSelections[currentUserId];
    
    if (userSelection && !userSelection.locked) {
      const newSelections = {
        ...currentSelections,
        [currentUserId]: {
          ...userSelection,
          points,
        }
      };
      
      // Optimistic update
      setSession({ ...session, selections: newSelections });
      
      await updateSelections(newSelections);
    }
  };
  
  const toggleLockUserSelection = async () => {
    if (!session || !currentUserId) return;
    const currentSelections = session.selections;
    const userSelection = currentSelections[currentUserId];
    if (userSelection) {
      const newSelections = {
        ...currentSelections,
        [currentUserId]: { ...userSelection, locked: !userSelection.locked }
      };

      // Optimistic update
      setSession({ ...session, selections: newSelections });

      await updateSelections(newSelections);
    }
  };

  const updateTicketNumber = async (ticketNumber: string) => {
    if (!session) return;

    // Optimistic update
    setSession({ ...session, ticket_number: ticketNumber });

    const { error } = await supabase
      .from('poker_sessions')
      .update({ ticket_number: ticketNumber })
      .eq('id', session.id);

    if (error) {
      console.error('Error updating ticket number', error);
      toast({ title: 'Error updating ticket number', variant: 'destructive' });
      // Revert optimistic update on error
      getOrCreateSession();
    }
  };

  const playHand = async () => {
    if (!session) return;

    const newSelections = { ...session.selections };
    let aPlayerAbstained = false;

    Object.keys(newSelections).forEach(userId => {
      if (!newSelections[userId].locked) {
        newSelections[userId] = { ...newSelections[userId], points: -1, locked: true };
        aPlayerAbstained = true;
      }
    });

    const participatingPlayers = Object.values(newSelections).filter(s => s.points !== -1);
    const averagePoints = participatingPlayers.length > 0
      ? participatingPlayers.reduce((acc, curr) => acc + curr.points, 0) / participatingPlayers.length
      : 0;

    const newState: Partial<PokerSession> = { game_state: 'Playing', average_points: averagePoints };
    if (aPlayerAbstained) {
      newState.selections = newSelections;
    }

    // Optimistic update
    setSession({ ...session, ...newState });
    
    const { error } = await supabase
      .from('poker_sessions')
      .update(newState)
      .eq('id', session.id);
    if (error) console.error('Error playing hand', error);
  };

  const nextRound = async () => {
    if (!session) return;

    const resetSelections: Selections = {};
    Object.keys(session.selections).forEach(userId => {
        resetSelections[userId] = {
            ...session.selections[userId],
            points: 0,
            locked: false,
        };
    });
    
    // Optimistic update
    setSession({ ...session, selections: resetSelections, game_state: 'Selection', average_points: 0, ticket_number: '' });

    await supabase
      .from('poker_sessions')
      .update({ selections: resetSelections, game_state: 'Selection', average_points: 0, ticket_number: '' })
      .eq('id', session.id);
  };

  return { session, loading, updateUserSelection, toggleLockUserSelection, playHand, nextRound, updateTicketNumber, presentUserIds };
}; 