import { useState, useEffect, useCallback, useMemo } from 'react';
import { getDb } from '@/lib/backend/getDataClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export type RetroStage = 'thinking' | 'voting' | 'discussing' | 'closed';

interface RetroBoard {
  id: string;
  room_id: string;
  title: string;
  is_private: boolean;
  password_hash: string | null;
  created_at: string;
  archived: boolean;
  team_id: string | null;
  retro_stage: RetroStage | null;
}

interface RetroColumn {
  id: string;
  board_id: string;
  title: string;
  color: string;
  position: number;
  sort_order?: number;
  is_action_items: boolean | null;
}

interface RetroItem {
  id: string;
  board_id: string;
  column_id: string;
  text: string;
  author: string;
  author_id?: string;
  votes: number;
  created_at: string;
  session_id?: string;
  profiles?: { avatar_url: string; full_name: string } | null;
}

interface TeamActionItem {
  id: string;
  team_id: string;
  text: string;
  source_board_id?: string | null;
  source_item_id?: string | null;
  created_at: string;
  created_by?: string | null;
  assigned_to?: string | null;
}

interface RetroComment {
  id: string;
  item_id: string;
  author: string;
  author_id?: string;
  text: string;
  created_at: string;
  session_id?: string;
  profiles?: { avatar_url: string; full_name: string } | null;
}

interface RetroBoardConfig {
  id: string;
  board_id: string;
  allow_anonymous: boolean;
  voting_enabled: boolean;
  max_votes_per_user: number | null;
  show_author_names: boolean;
  retro_stages_enabled: boolean | null;
  enforce_stage_readiness: boolean | null;
  allow_self_votes?: boolean | null;
  vote_emoji?: string | null;
  timer_started_at?: string | null;
  timer_duration_seconds?: number;
  timer_time_left_seconds?: number;
  timer_is_running?: boolean;
  timer_music_enabled?: boolean;
  timer_music_offset_seconds?: number;
  timer_alarm_enabled?: boolean;
}

interface ActiveUser {
  id: string;
  user_id?: string;
  user_name: string;
  last_seen: string;
  avatar_url?: string;
}

export interface RetroVote {
  id: string;
  item_id: string;
  user_id: string | null;
  session_id: string | null;
}

export interface ItemVoter {
  key: string;
  name: string;
  avatarUrl?: string | null;
}

export type AudioSummaryStatus = 'generating' | 'ready' | 'playing' | 'paused';

export interface AudioSummaryState {
  columnId: string;
  status: AudioSummaryStatus;
  script?: string | Blob;
}

export const useRetroBoard = (roomId: string) => {
  const [board, setBoard] = useState<RetroBoard | null>(null);
  const [columns, setColumns] = useState<RetroColumn[]>([]);
  const [items, setItems] = useState<RetroItem[]>([]);
  const [comments, setComments] = useState<RetroComment[]>([]);
  const [boardConfig, setBoardConfig] = useState<RetroBoardConfig | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [votes, setVotes] = useState<RetroVote[]>([]);
  const [teamActionItems, setTeamActionItems] = useState<TeamActionItem[]>([]);
  const [boardActionStatus, setBoardActionStatus] = useState<Record<string, { id: string; done: boolean; assigned_to?: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [sessionId] = useState(() => {
    const existingSessionId = localStorage.getItem('retroSessionId');
    if (existingSessionId) {
      return existingSessionId;
    }
    const newSessionId = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('retroSessionId', newSessionId);
    return newSessionId;
  });
  const [presenceChannel, setPresenceChannel] = useState<any>(null);
  const [audioSummaryState, setAudioSummaryState] = useState<AudioSummaryState | null>(null);
  const [audioUrlToPlay, setAudioUrlToPlay] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, { avatar_url: string; full_name: string }>>({});
  const { toast } = useToast();
  const { profile } = useAuth();

  // Helper function to fetch and cache profiles
  const fetchProfileData = useCallback(async (authorId: string) => {
    if (profileCache[authorId]) {
      return profileCache[authorId];
    }

    try {
      const { data, error } = await getDb()
        .from('profiles')
        .select('avatar_url, full_name')
        .eq('id', authorId)
        .single();

      if (error) throw error;

      if (data) {
        setProfileCache(prev => ({ ...prev, [authorId]: data }));
        return data;
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
    return null;
  }, [profileCache]);

  // Update user presence using Supabase realtime presence
  const updatePresence = useCallback(async (userName: string, avatarUrl?: string) => {
    if (!presenceChannel || !userName.trim()) return;

    await presenceChannel.track({
      user_id: profile?.id || sessionId,
      user_name: userName,
      last_seen: new Date().toISOString(),
      avatar_url: avatarUrl
    });
  }, [presenceChannel, sessionId, profile?.id]);

  const clearAudioUrlToPlay = useCallback(() => {
    setAudioUrlToPlay(null);
  }, []);

  // Broadcast focus card to all connected users
  const focusItem = useCallback(async (itemId: string | null) => {
    setFocusedItemId(itemId);
    if (!presenceChannel) return;
    await presenceChannel.send({
      type: 'broadcast',
      event: 'focus-card',
      payload: { itemId }
    });
  }, [presenceChannel]);

  // Broadcast readiness changes to all connected users
  const broadcastReadinessChange = useCallback(async (readinessData: {
    boardId: string;
    stage: string;
    userId: string;  // Now always present (auth user ID or session ID)
    sessionId?: string;  // Kept for backward compatibility but not used
    isReady: boolean;
    userName?: string;
  }) => {
    if (!presenceChannel) return;

    console.log('📤 [Broadcast] Sending readiness change:', readinessData);

    await presenceChannel.send({
      type: 'broadcast',
      event: 'readiness-change',
      payload: readinessData
    });
  }, [presenceChannel]);

  // Load board data with better error handling and loading state management
  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    const loadBoardData = async () => {
      try {
        setLoading(true);

        // Load or create board
        let { data: boardData, error: boardError } = await getDb()
          .from('retro_boards')
          .select('*')
          .eq('room_id', roomId)
          .single();

        if (boardError && boardError.code === 'PGRST116') {
          // Board doesn't exist, create it
          const { data: newBoard, error: createError } = await getDb()
            .from('retro_boards')
            .insert([{ room_id: roomId, title: 'RetroScope Session' }])
            .select()
            .single();

          if (createError) throw createError;
          boardData = newBoard;
        } else if (boardError) {
          throw boardError;
        }

        setBoard(boardData);

        // Load board config
        const { data: configData, error: configError } = await getDb()
          .from('retro_board_config')
          .select('*')
          .eq('board_id', boardData.id)
          .single();

        if (configError && configError.code === 'PGRST116') {
          // Config doesn't exist, create it
          const { data: newConfig, error: createConfigError } = await getDb()
            .from('retro_board_config')
            .insert([{ board_id: boardData.id }])
            .select()
            .single();

          if (createConfigError) throw createConfigError;
          setBoardConfig(newConfig);
        } else if (configError) {
          throw configError;
        } else {
          setBoardConfig(configData);
        }

        // Load columns
        const { data: columnsData, error: columnsError } = await getDb()
          .from('retro_columns')
          .select('*')
          .eq('board_id', boardData.id)
          .order('position');

        if (columnsError) throw columnsError;
        setColumns(columnsData || []);

        // Load items
        const { data: itemsData, error: itemsError } = await getDb()
          .from('retro_items')
          .select('*, profiles(avatar_url, full_name)')
          .eq('board_id', boardData.id)
          .order('votes', { ascending: false });

        if (itemsError) throw itemsError;
        setItems(itemsData || []);

        // Cache profile data from items
        const itemProfiles: Record<string, { avatar_url: string; full_name: string }> = {};
        (itemsData || []).forEach(item => {
          if (item.author_id && item.profiles) {
            itemProfiles[item.author_id] = item.profiles;
          }
        });
        setProfileCache(prev => ({ ...prev, ...itemProfiles }));

        // Load comments
        const { data: commentsData, error: commentsError } = await getDb()
          .from('retro_comments')
          .select('*, profiles(avatar_url, full_name)')
          .in('item_id', (itemsData || []).map(item => item.id))
          .order('created_at');

        if (commentsError) throw commentsError;
        setComments(commentsData || []);

        // Cache profile data from comments
        const commentProfiles: Record<string, { avatar_url: string; full_name: string }> = {};
        (commentsData || []).forEach(comment => {
          if (comment.author_id && comment.profiles) {
            commentProfiles[comment.author_id] = comment.profiles;
          }
        });
        setProfileCache(prev => ({ ...prev, ...commentProfiles }));

        // Load open team action items for this board's team, excluding items from the current board
        if (boardData.team_id) {
          const { data: openActions, error: actionsError } = await getDb()
            .from('team_action_items')
            .select('*')
            .eq('team_id', boardData.team_id)
            .eq('done', false)
            .or(`source_board_id.is.null,source_board_id.neq.${boardData.id}`)
            .order('created_at', { ascending: true });

          if (actionsError) throw actionsError;
          setTeamActionItems(openActions || []);
          // Also load status mapping for items on this board (done may be true)
          const { data: boardActions } = await getDb()
            .from('team_action_items')
            .select('id, source_item_id, done, assigned_to')
            .eq('team_id', boardData.team_id)
            .eq('source_board_id', boardData.id);
          const statusMap: Record<string, { id: string; done: boolean; assigned_to?: string | null }> = {};
          (boardActions || []).forEach(a => {
            if (a.source_item_id) statusMap[a.source_item_id] = { id: a.id, done: !!a.done, assigned_to: a.assigned_to };
          });
          setBoardActionStatus(statusMap);
        } else {
          setTeamActionItems([]);
          setBoardActionStatus({});
        }

        // Load all votes for items on this board (includes legacy rows with null board_id)
        const itemIds = (itemsData || []).map(item => item.id);
        if (itemIds.length > 0) {
          const { data: votesData, error: votesError } = await getDb()
            .from('retro_votes')
            .select('id, item_id, user_id, session_id')
            .in('item_id', itemIds);

          if (votesError) throw votesError;

          const loadedVotes = (votesData || []).filter(
            (vote): vote is RetroVote => !!vote.item_id
          ) as RetroVote[];
          setVotes(loadedVotes);

          // Batch-fetch profiles for voters not already cached from items/comments
          const voterIds = [...new Set(
            loadedVotes
              .map(vote => vote.user_id)
              .filter((id): id is string => !!id && !itemProfiles[id] && !commentProfiles[id])
          )];

          if (voterIds.length > 0) {
            const { data: voterProfiles } = await getDb()
              .from('profiles')
              .select('id, avatar_url, full_name')
              .in('id', voterIds);

            if (voterProfiles?.length) {
              const voterProfileMap: Record<string, { avatar_url: string; full_name: string }> = {};
              voterProfiles.forEach(p => {
                voterProfileMap[p.id] = { avatar_url: p.avatar_url, full_name: p.full_name };
              });
              setProfileCache(prev => ({ ...prev, ...voterProfileMap }));
            }
          }
        } else {
          setVotes([]);
        }

      } catch (error) {
        console.error('Error loading board data:', error);
        toast({
          title: "Error loading retro board",
          description: "Please try refreshing the page.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadBoardData();
  }, [roomId, toast]);

  const handleNewItem = useCallback(async (payload: any) => {
    const newItem = payload.new as RetroItem;
    // Check if item already exists to prevent duplicates from optimistic updates
    if (items.some(item => item.id === newItem.id)) {
      return;
    }
    
    if (newItem.author_id) {
      const profileData = await fetchProfileData(newItem.author_id);
      newItem.profiles = profileData;
    }
    
    setItems(prevItems => [...prevItems, newItem]);
  }, [items, fetchProfileData]);

  const handleNewComment = useCallback(async (payload: any) => {
    const newComment = payload.new as RetroComment;
    if (items.some(item => item.id === newComment.item_id)) {
      // Check if comment already exists
      if (comments.some(comment => comment.id === newComment.id)) {
        return;
      }
      
      if (newComment.author_id) {
        const profileData = await fetchProfileData(newComment.author_id);
        newComment.profiles = profileData;
      }
      
      setComments(prevComments => [...prevComments, newComment]);
    }
  }, [items, comments, fetchProfileData]);

  // Set up realtime presence and data subscriptions
  useEffect(() => {
    if (!board) return;

    const channel = getDb().channel(`retro-board-${board.id}`, {
      config: {
        presence: {
          key: sessionId,
        },
      },
    });

    // Presence events
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users = Object.values(state).map((p: any) => p[0]);
      setActiveUsers(users as ActiveUser[]);
    });

    // Broadcast events
    channel.on('broadcast', { event: 'play-summary-audio' }, ({ payload }) => {
      if (payload.url) {
        setAudioUrlToPlay(payload.url);
      }
    })
    .on('broadcast', { event: 'readiness-change' }, ({ payload }) => {
      console.log('📡 [Broadcast] Readiness change received:', payload);
      
      // Dispatch window event for useUserReadiness hooks to pick up
      const readinessChangeEvent = new CustomEvent('readiness-change', {
        detail: payload
      });
      window.dispatchEvent(readinessChangeEvent);
    })
    .on('broadcast', { event: 'focus-card' }, ({ payload }) => {
      setFocusedItemId(payload?.itemId ?? null);
    })
    .on('broadcast', { event: 'retro-timer-changed' }, ({ payload }) => {
      const timerChangeEvent = new CustomEvent('retro-timer-changed', {
        detail: payload
      });
      window.dispatchEvent(timerChangeEvent);
    });

    // Database changes
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'retro_items' }, handleNewItem)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'retro_items' }, (payload) => {
        const updatedItem = payload.new as RetroItem;
        setItems(currentItems =>
          currentItems.map(item =>
            item.id === updatedItem.id ? { ...item, ...updatedItem } : item
          )
        );
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'retro_items' }, (payload) => {
        const deletedItem = payload.old as RetroItem;
        setItems(currentItems => currentItems.filter(item => item.id !== deletedItem.id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'retro_comments' }, handleNewComment)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'retro_comments' }, (payload) => {
        const deletedComment = payload.old as RetroComment;
        setComments(currentComments => currentComments.filter(comment => comment.id !== deletedComment.id));
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'retro_votes',
        filter: `board_id=eq.${board.id}`,
      }, async (payload) => {
        const newVote = payload.new as RetroVote;
        if (!newVote?.item_id) return;

        setVotes(current => {
          if (current.some(vote => vote.id === newVote.id)) return current;
          // Drop optimistic temp vote for the same voter/item if present
          const withoutTemp = current.filter(vote => {
            if (!vote.id.startsWith('temp-')) return true;
            const sameItem = vote.item_id === newVote.item_id;
            const sameUser = !!newVote.user_id && vote.user_id === newVote.user_id;
            const sameSession = !!newVote.session_id && vote.session_id === newVote.session_id;
            return !(sameItem && (sameUser || sameSession));
          });
          return [...withoutTemp, newVote];
        });

        if (newVote.user_id) {
          await fetchProfileData(newVote.user_id);
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'retro_votes',
        filter: `board_id=eq.${board.id}`,
      }, (payload) => {
        const deletedVote = payload.old as Partial<RetroVote>;
        setVotes(current => {
          if (deletedVote.id) {
            return current.filter(vote => vote.id !== deletedVote.id);
          }
          // Fallback match when DELETE payload lacks full row (replica identity default)
          return current.filter(vote => {
            const sameItem = vote.item_id === deletedVote.item_id;
            const sameUser = deletedVote.user_id != null && vote.user_id === deletedVote.user_id;
            const sameSession = deletedVote.session_id != null && vote.session_id === deletedVote.session_id;
            return !(sameItem && (sameUser || sameSession));
          });
        });
      })
      // Team action items realtime for this team
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_action_items',
        filter: board?.team_id ? `team_id=eq.${board.team_id}` : undefined as any
      }, (payload) => {
        const newAction = payload.new as any;
        const oldAction = payload.old as any;
        if (payload.eventType === 'INSERT') {
          if (newAction && newAction.done === false) {
            // Skip showing items sourced from the current board in the Open Action Items column
            if (!board?.id || newAction.source_board_id == null || newAction.source_board_id !== board.id) {
              setTeamActionItems(prev => [...prev, newAction]);
            }
          }
          // Update board status map for items on this board
          if (newAction?.source_board_id === board?.id && newAction?.source_item_id) {
            setBoardActionStatus(prev => ({ ...prev, [newAction.source_item_id]: { id: newAction.id, done: !!newAction.done, assigned_to: newAction.assigned_to } }));
          }
        } else if (payload.eventType === 'UPDATE') {
          if (newAction.done === true) {
            setTeamActionItems(prev => prev.filter(a => a.id !== newAction.id));
          } else {
            // If this action item belongs to the current board, ensure it's not listed
            if (board?.id && newAction.source_board_id === board.id) {
              setTeamActionItems(prev => prev.filter(a => a.id !== newAction.id));
            } else {
              setTeamActionItems(prev => prev.map(a => a.id === newAction.id ? newAction : a));
            }
          }
          if (newAction?.source_board_id === board?.id && newAction?.source_item_id) {
            setBoardActionStatus(prev => ({ ...prev, [newAction.source_item_id]: { id: newAction.id, done: !!newAction.done, assigned_to: newAction.assigned_to } }));
          }
        } else if (payload.eventType === 'DELETE') {
          if (oldAction) {
            setTeamActionItems(prev => prev.filter(a => a.id !== oldAction.id));
          }
          if (oldAction?.source_board_id === board?.id && oldAction?.source_item_id) {
            setBoardActionStatus(prev => {
              const clone = { ...prev };
              delete clone[oldAction.source_item_id];
              return clone;
            });
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'retro_board_config',
        filter: `board_id=eq.${board.id}`
      }, (payload) => {
        const updatedConfig = payload.new as RetroBoardConfig;
        setBoardConfig(current => current ? { ...current, ...updatedConfig } : updatedConfig);
        const timerFields: (keyof RetroBoardConfig)[] = [
          'timer_started_at',
          'timer_duration_seconds',
          'timer_time_left_seconds',
          'timer_is_running',
          'timer_music_enabled',
          'timer_music_offset_seconds',
          'timer_alarm_enabled',
        ];
        const changedKeys = Object.keys(payload.new).filter((key) => {
          const oldValue = (payload.old as Record<string, unknown>)[key];
          const newValue = (payload.new as Record<string, unknown>)[key];
          return oldValue !== newValue;
        });
        const hasNonTimerChanges = changedKeys.some(
          (key) => !timerFields.includes(key as keyof RetroBoardConfig)
        );
        if (hasNonTimerChanges) {
          toast({
            title: 'Board settings updated',
            description: 'Configuration changes have been applied.',
            duration: 2500,
          });
        }
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'retro_boards',
        filter: `id=eq.${board.id}`
      }, (payload) => {
        const updatedBoard = payload.new as RetroBoard;
        // Update board state with new stage and other properties
        setBoard(currentBoard => 
          currentBoard ? { ...currentBoard, ...updatedBoard } : null
        );
        
        // Show toast notification for stage changes if retro_stage changed
        if (payload.old.retro_stage !== updatedBoard.retro_stage) {
          const stageLabels: Record<string, string> = {
            'thinking': 'Thinking',
            'voting': 'Voting', 
            'discussing': 'Discussing',
            'closed': 'Closed'
          };
          
          const newStageLabel = stageLabels[updatedBoard.retro_stage || 'thinking'] || updatedBoard.retro_stage;
          
          toast({
            title: "Stage Changed",
            description: `Retrospective moved to ${newStageLabel} stage`,
            duration: 4000,
          });
        }
      })


    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setPresenceChannel(channel);
      }
    });

    return () => {
      getDb().removeChannel(channel);
    };
  }, [board, sessionId, handleNewItem, handleNewComment, fetchProfileData]);

  const updateBoardTitle = async (title: string) => {
    if (!board) return;

    const oldTitle = board.title;
    setBoard(prev => prev ? { ...prev, title } : null); // Optimistic update

    const { error } = await getDb()
      .from('retro_boards')
      .update({ title })
      .eq('id', board.id);

    if (error) {
      console.error('Error updating board title:', error);
      setBoard(prev => prev ? { ...prev, title: oldTitle } : null); // Revert on error
      toast({
        title: "Error updating title",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateBoardConfig = async (config: Partial<RetroBoardConfig>) => {
    if (!board || !boardConfig) return;

    const oldConfig = { ...boardConfig };
    setBoardConfig(prev => prev ? { ...prev, ...config } : null); // Optimistic update

    const { error } = await getDb()
      .from('retro_board_config')
      .update(config)
      .eq('board_id', board.id);

    if (error) {
      console.error('Error updating board config:', error);
      setBoardConfig(oldConfig); // Revert on error
      toast({
        title: "Error updating configuration",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const addItem = async (text: string, columnId: string, author: string, isAnonymous: boolean) => {
    if (!board) return;

    const effectiveAuthorId = profile?.id || null;

    const { data: newItem, error } = await getDb()
      .from('retro_items')
      .insert([{
        board_id: board.id,
        column_id: columnId,
        text,
        author,
        author_id: effectiveAuthorId,
        session_id: isAnonymous ? sessionId : null
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding item:', error);
      toast({
        title: "Error adding item",
        description: "Please try again.",
        variant: "destructive",
      });
    }

    // Update presence when adding item
    updatePresence(author === 'Anonymous' ? (profile?.full_name || 'Anonymous User') : author);

    // If this item is in the designated action items column, create a team action item
    try {
      const targetColumn = columns.find(c => c.id === columnId);
      if (newItem && targetColumn?.is_action_items && board.team_id) {
        const { data: actionItem, error: actionError } = await getDb()
          .from('team_action_items')
          .insert([{
            team_id: board.team_id,
            text: newItem.text,
            source_board_id: board.id,
            source_item_id: newItem.id,
            created_by: effectiveAuthorId
          }])
          .select('id')
          .single();

        if (actionError) {
          console.error('Error creating team action item:', actionError);
          toast({
            title: 'Error creating action item',
            description: 'The card was added, but assignment may not work until you refresh.',
            variant: 'destructive',
          });
        } else if (actionItem) {
          // Keep local status in sync so assign/done work immediately (don't wait on realtime)
          setBoardActionStatus(prev => ({
            ...prev,
            [newItem.id]: { id: actionItem.id, done: false, assigned_to: null },
          }));
        }
      }
    } catch (e) {
      console.error('Error creating team action item:', e);
    }
  };

  const markTeamActionItemDone = async (actionItemId: string) => {
    // Optimistic remove from Open Action Items list
    const prevOpen = teamActionItems;
    setTeamActionItems(prev => prev.filter(a => a.id !== actionItemId));

    const { error } = await getDb()
      .from('team_action_items')
      .update({ done: true, done_at: new Date().toISOString(), done_by: profile?.id || null })
      .eq('id', actionItemId);
    if (error) {
      console.error('Error marking action item done:', error);
      toast({ title: 'Error completing action item', variant: 'destructive' });
      // Revert optimistic update on error
      setTeamActionItems(prevOpen);
    }
  };

  const resolveBoardActionLink = async (
    sourceItemId: string
  ): Promise<{ id: string; done: boolean; assigned_to?: string | null } | null> => {
    const existingLink = boardActionStatus[sourceItemId];
    if (existingLink) return existingLink;

    const { data: existing, error: lookupError } = await getDb()
      .from('team_action_items')
      .select('id, done, assigned_to')
      .eq('source_item_id', sourceItemId)
      .maybeSingle();

    if (lookupError) {
      console.error('Error looking up team action item:', lookupError);
      return null;
    }

    if (existing) {
      const link = { id: existing.id, done: !!existing.done, assigned_to: existing.assigned_to };
      setBoardActionStatus(prev => ({ ...prev, [sourceItemId]: link }));
      return link;
    }

    return null;
  };

  const toggleBoardActionItemDone = async (sourceItemId: string, nextDone: boolean) => {
    let link = await resolveBoardActionLink(sourceItemId);

    if (!link && nextDone) {
      // If no action record exists but toggling to done from board, create one linked to this item
      const targetItem = items.find(i => i.id === sourceItemId);
      if (board?.team_id && targetItem) {
        const { data, error } = await getDb()
          .from('team_action_items')
          .insert([{
            team_id: board.team_id,
            text: targetItem.text,
            source_board_id: board.id,
            source_item_id: sourceItemId,
            created_by: profile?.id || null,
            done: true,
            done_at: new Date().toISOString(),
            done_by: profile?.id || null,
          }])
          .select('id')
          .single();
        if (error || !data) {
          // Unique race: another client may have created it — look up and update instead
          const raced = await resolveBoardActionLink(sourceItemId);
          if (!raced) {
            console.error('Error creating team action item:', error);
            toast({ title: 'Error updating action item', variant: 'destructive' });
            return;
          }
          link = raced;
        } else {
          link = { id: data.id, done: true, assigned_to: null };
          setBoardActionStatus(prev => ({ ...prev, [sourceItemId]: link! }));
          return;
        }
      }
    }

    if (!link) return;

    const actionId = link.id;
    const previous = { ...link };

    // Optimistic update
    setBoardActionStatus(prev => ({
      ...prev,
      [sourceItemId]: { ...link!, done: nextDone },
    }));
    const { error } = await getDb()
      .from('team_action_items')
      .update({
        done: nextDone,
        done_at: nextDone ? new Date().toISOString() : null,
        done_by: nextDone ? (profile?.id || null) : null,
      })
      .eq('id', actionId);
    if (error) {
      setBoardActionStatus(prev => ({ ...prev, [sourceItemId]: previous }));
      toast({ title: 'Error updating action item', variant: 'destructive' });
    }
  };

  const assignTeamActionItem = async (actionItemId: string, userId: string | null) => {
    // Optimistic update for Open Action Items list
    const previous = teamActionItems;
    setTeamActionItems(prev => prev.map(a => a.id === actionItemId ? { ...a, assigned_to: userId } : a));
    const { error } = await getDb()
      .from('team_action_items')
      .update({ assigned_to: userId })
      .eq('id', actionItemId);
    if (error) {
      setTeamActionItems(previous);
      toast({ title: 'Error assigning action item', variant: 'destructive' });
    }
  };

  const assignBoardActionItem = async (sourceItemId: string, userId: string | null) => {
    let link = await resolveBoardActionLink(sourceItemId);

    if (!link) {
      const targetItem = items.find(i => i.id === sourceItemId);
      if (!board?.team_id || !targetItem) return;

      const { data, error } = await getDb()
        .from('team_action_items')
        .insert([{
          team_id: board.team_id,
          text: targetItem.text,
          source_board_id: board.id,
          source_item_id: sourceItemId,
          created_by: profile?.id || null,
          assigned_to: userId ?? null,
        }])
        .select('id')
        .single();

      if (!error && data) {
        setBoardActionStatus(prev => ({
          ...prev,
          [sourceItemId]: { id: data.id, done: false, assigned_to: userId ?? null },
        }));
        return;
      }

      // Unique constraint race: row already exists — look up and update instead
      link = await resolveBoardActionLink(sourceItemId);
      if (!link) {
        console.error('Error assigning action item:', error);
        toast({ title: 'Error assigning action item', variant: 'destructive' });
        return;
      }
    }

    const previous = { ...link };
    setBoardActionStatus(prev => ({
      ...prev,
      [sourceItemId]: { ...link!, assigned_to: userId ?? null },
    }));
    const { error } = await getDb()
      .from('team_action_items')
      .update({ assigned_to: userId ?? null })
      .eq('id', link.id);
    if (error) {
      setBoardActionStatus(prev => ({ ...prev, [sourceItemId]: previous }));
      toast({ title: 'Error assigning action item', variant: 'destructive' });
    }
  };

  const addColumn = async (title: string) => {
    if (!board) return;

    const colors = [
      'bg-purple-100 border-purple-300',
      'bg-orange-100 border-orange-300',
      'bg-pink-100 border-pink-300',
      'bg-indigo-100 border-indigo-300'
    ];

    const { data: newColumn, error } = await getDb()
      .from('retro_columns')
      .insert([{
        board_id: board.id,
        title,
        color: colors[columns.length % colors.length],
        position: columns.length + 1,
        is_action_items: false
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding column:', error);
      toast({
        title: "Error adding column",
        description: "Please try again.",
        variant: "destructive",
      });
    } else if (newColumn) {
      setColumns(prevColumns => [...prevColumns, newColumn]);
    }
  };

  const updateColumn = async (columnId: string, updates: { title?: string; is_action_items?: boolean }) => {
    const oldColumns = [...columns];
    
    // If setting this column as action items, ensure other columns are not action items
    if (updates.is_action_items === true) {
      setColumns(prevColumns =>
        prevColumns.map(column =>
          column.id === columnId 
            ? { ...column, ...updates }
            : { ...column, is_action_items: false }
        )
      );
      
      // Update all columns in the database - set others to false
      if (board) {
        const { error: resetError } = await getDb()
          .from('retro_columns')
          .update({ is_action_items: false })
          .eq('board_id', board.id)
          .neq('id', columnId);
          
        if (resetError) {
          console.error('Error resetting other columns:', resetError);
        }
      }
    } else {
      setColumns(prevColumns =>
        prevColumns.map(column =>
          column.id === columnId ? { ...column, ...updates } : column
        )
      );
    }

    const { error } = await getDb()
      .from('retro_columns')
      .update(updates)
      .eq('id', columnId);

    if (error) {
      console.error('Error updating column:', error);
      setColumns(oldColumns);
      toast({
        title: "Error updating column",
        description: "Please try again.",
        variant: "destructive",
      });
    } else if (updates.is_action_items !== undefined) {
      toast({
        title: updates.is_action_items ? "Action items column set" : "Action items column removed",
        description: updates.is_action_items 
          ? "This column is now designated for action items." 
          : "This column is no longer the action items column.",
      });
    }
  };

  const deleteColumn = async (columnId: string) => {
    try {
      const { error } = await getDb()
        .from('retro_columns')
        .delete()
        .eq('id', columnId);

      if (error) throw error;

      setColumns(prevColumns => prevColumns.filter(c => c.id !== columnId));

    } catch (error) {
      console.error('Error deleting column:', error);
      toast({
        title: "Error deleting column",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const reorderColumns = async (newColumns: RetroColumn[]) => {
    setColumns(newColumns);

    const updates = newColumns.map((column, index) => ({
      id: column.id,
      position: index + 1,
      sort_order: index + 1
    }));

    for (const update of updates) {
      await getDb()
        .from('retro_columns')
        .update({ position: update.position, sort_order: update.sort_order })
        .eq('id', update.id);
    }
  };

  const upvoteItem = async (itemId: string) => {
    if (!board || !boardConfig) return;

    const userId = profile?.id ?? null;
    const voteSessionId = !userId ? sessionId : null;
    const existingVote = votes.find(vote =>
      vote.item_id === itemId &&
      (userId ? vote.user_id === userId : vote.session_id === sessionId)
    );
    const hasVoted = !!existingVote;

    // Prevent self-votes when disallowed
    if (!hasVoted && boardConfig.allow_self_votes === false) {
      const targetItem = items.find(i => i.id === itemId);
      const isSelfItem = !!targetItem && (
        (userId && targetItem.author_id === userId) ||
        (!userId && targetItem.session_id && targetItem.session_id === sessionId)
      );
      if (isSelfItem) {
        toast({ title: 'Self-voting disabled', description: 'You cannot vote on your own item.', variant: 'destructive' });
        return;
      }
    }

    // Prevent adding a new vote if the limit is reached
    const currentUserVoteCount = votes.filter(vote =>
      userId ? vote.user_id === userId : vote.session_id === sessionId
    ).length;
    if (!hasVoted && boardConfig.max_votes_per_user && currentUserVoteCount >= boardConfig.max_votes_per_user) {
      toast({
        title: 'Vote limit reached',
        description: `You can only vote ${boardConfig.max_votes_per_user} times.`,
        variant: 'destructive'
      });
      return;
    }

    const tempVoteId = `temp-${Date.now()}-${itemId}`;

    // Optimistic UI updates
    if (hasVoted && existingVote) {
      setVotes(prev => prev.filter(vote => vote.id !== existingVote.id));
    } else {
      setVotes(prev => [
        ...prev,
        {
          id: tempVoteId,
          item_id: itemId,
          user_id: userId,
          session_id: voteSessionId,
        },
      ]);
    }
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId
          ? { ...item, votes: hasVoted ? item.votes - 1 : item.votes + 1 }
          : item
      )
    );

    if (hasVoted) {
      // Remove vote from server
      let deleteQuery = getDb()
        .from('retro_votes')
        .delete()
        .eq('item_id', itemId)
        .eq('board_id', board.id);

      if (userId) {
        deleteQuery = deleteQuery.eq('user_id', userId);
      } else {
        deleteQuery = deleteQuery.eq('session_id', sessionId);
      }

      const { error } = await deleteQuery;

      if (error) {
        toast({ title: 'Error removing vote', variant: 'destructive' });
        // Revert UI changes on error
        setVotes(prev => [...prev, existingVote]);
        setItems(prevItems =>
          prevItems.map(item =>
            item.id === itemId ? { ...item, votes: item.votes + 1 } : item
          )
        );
      }
    } else {
      // Add vote to server
      const { data: insertedVote, error } = await getDb()
        .from('retro_votes')
        .insert({
          item_id: itemId,
          board_id: board.id,
          user_id: userId,
          session_id: voteSessionId,
        })
        .select('id, item_id, user_id, session_id')
        .single();

      if (error) {
        toast({ title: 'Error adding vote', variant: 'destructive' });
        // Revert UI changes on error
        setVotes(prev => prev.filter(vote => vote.id !== tempVoteId));
        setItems(prevItems =>
          prevItems.map(item =>
            item.id === itemId ? { ...item, votes: item.votes - 1 } : item
          )
        );
      } else if (insertedVote?.item_id) {
        setVotes(prev => {
          const withoutTemp = prev.filter(vote => vote.id !== tempVoteId);
          if (withoutTemp.some(vote => vote.id === insertedVote.id)) return withoutTemp;
          return [...withoutTemp, insertedVote as RetroVote];
        });
      }
    }
  };

  const updateItem = async (itemId: string, text: string) => {
    const oldItems = [...items];
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId ? { ...item, text } : item
      )
    );

    // Optimistically update team action item text if linked
    const linkedAction = teamActionItems.find(a => a.source_item_id === itemId);
    if (linkedAction) {
      setTeamActionItems(prev => prev.map(a => a.id === linkedAction.id ? { ...a, text } as TeamActionItem : a));
    }

    const { error } = await getDb()
      .from('retro_items')
      .update({ text })
      .eq('id', itemId);

    if (error) {
      console.error('Error updating item:', error);
      setItems(oldItems);
      toast({
        title: "Error updating item",
        description: "Please try again.",
        variant: "destructive",
      });
      // Revert team action item optimistic update
      if (linkedAction) {
        const original = oldItems.find(i => i.id === itemId)?.text;
        if (original !== undefined) {
          setTeamActionItems(prev => prev.map(a => a.id === linkedAction.id ? { ...a, text: original } as TeamActionItem : a));
        }
      }
      return;
    }

    // Persist update to linked team action item if this item is in action items column
    try {
      const updatedItem = items.find(i => i.id === itemId);
      const actionColumn = updatedItem ? columns.find(c => c.id === updatedItem.column_id)?.is_action_items : false;
      if (board?.team_id && actionColumn) {
        await getDb()
          .from('team_action_items')
          .update({ text })
          .eq('source_item_id', itemId);
      }
    } catch (e) {
      console.error('Error updating linked team action item text:', e);
    }
  };

  const deleteItem = async (itemId: string) => {
    const oldItems = [...items];
    setItems(currentItems =>
      currentItems.filter(item => item.id !== itemId)
    );

    const { error } = await getDb()
      .from('retro_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('Error deleting item:', error);
      setItems(oldItems);
      toast({
        title: "Error deleting item",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const addComment = async (itemId: string, text: string, author: string, isAnonymous: boolean) => {
    const authorId = profile?.id || null;

    const { data: newComment, error } = await getDb()
      .from('retro_comments')
      .insert([{
        item_id: itemId,
        text,
        author,
        author_id: authorId,
        session_id: isAnonymous ? sessionId : null
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error adding comment",
        description: "Please try again.",
        variant: "destructive",
      });
    } else if (newComment) {
      setComments(prevComments => [...prevComments, newComment]);
    }
  };

  const deleteComment = async (commentId: string) => {
    const oldComments = [...comments];
    setComments(prevComments => prevComments.filter(c => c.id !== commentId));

    const { error } = await getDb()
      .from('retro_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Error deleting comment:', error);
      setComments(oldComments);
      toast({
        title: "Error deleting comment",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const getCommentsForItem = (itemId: string) => {
    return comments.filter(c => c.item_id === itemId);
  };

  const updateAudioSummaryState = (state: AudioSummaryState | null) => {
    setAudioSummaryState(state);
  };

  const updateRetroStage = async (newStage: RetroStage) => {
    if (!board) return;

    // Optimistically update the local state
    const oldBoard = { ...board };
    setBoard(prev => prev ? { ...prev, retro_stage: newStage } : null);

    const { error } = await getDb()
      .from('retro_boards')
      .update({ retro_stage: newStage })
      .eq('id', board.id);

    if (error) {
      console.error('Error updating retro stage:', error);
      // Revert on error
      setBoard(oldBoard);
      toast({
        title: "Error updating retro stage",
        description: "Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: `Retro stage updated`,
        description: `Board is now in ${newStage} stage`,
      });
      // Emit notifications when a session effectively starts (first transition from thinking to voting/discussing)
      try {
        if (newStage === 'voting' || newStage === 'discussing') {
          // Find relevant user ids: team members or presence cache user ids
          const userIds: string[] = activeUsers
            .map(u => u.id)
            .filter(Boolean);
          if (userIds.length > 0) {
            await getDb().functions.invoke('notify-retro-start', {
              body: {
                roomId: board.room_id,
                title: board.title || 'Retrospective',
                userIds
              }
            });
          }
        }
      } catch (e) {
        console.warn('Failed to emit retro start notifications', e);
      }
    }
  };

  const userVotes = useMemo(() => {
    const currentUserId = profile?.id || null;
    return votes
      .filter(vote =>
        currentUserId ? vote.user_id === currentUserId : vote.session_id === sessionId
      )
      .map(vote => vote.item_id);
  }, [votes, profile?.id, sessionId]);

  const votersByItemId = useMemo(() => {
    const map: Record<string, ItemVoter[]> = {};

    const resolvePresence = (identity: string) =>
      activeUsers.find(user => user.user_id === identity || user.id === identity);

    for (const vote of votes) {
      if (!vote.item_id) continue;
      const key = vote.user_id || vote.session_id;
      if (!key) continue;

      let name = 'Anonymous';
      let avatarUrl: string | null | undefined;

      if (vote.user_id) {
        const cached = profileCache[vote.user_id];
        if (cached) {
          name = cached.full_name || 'Anonymous';
          avatarUrl = cached.avatar_url;
        } else {
          const presence = resolvePresence(vote.user_id);
          if (presence) {
            name = presence.user_name || 'Anonymous';
            avatarUrl = presence.avatar_url;
          }
        }
      } else if (vote.session_id) {
        const presence = resolvePresence(vote.session_id);
        if (presence) {
          name = presence.user_name || 'Anonymous';
          avatarUrl = presence.avatar_url;
        }
      }

      if (!map[vote.item_id]) {
        map[vote.item_id] = [];
      }
      if (!map[vote.item_id].some(voter => voter.key === key)) {
        map[vote.item_id].push({ key, name, avatarUrl });
      }
    }

    return map;
  }, [votes, profileCache, activeUsers]);

  return {
    board,
    columns,
    items,
    comments,
    boardConfig,
    activeUsers,
    userVotes,
    votersByItemId,
    teamActionItems,
    boardActionStatus,
    loading,
    sessionId,
    presenceChannel,
    audioSummaryState,
    updateAudioSummaryState,
    audioUrlToPlay,
    clearAudioUrlToPlay,
    focusedItemId,
    focusItem,
    updatePresence,
    broadcastReadinessChange,
    updateBoardTitle,
    updateBoardConfig,
    updateRetroStage,
    addItem,
    addColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
    upvoteItem,
    updateItem,
    deleteItem,
    addComment,
    deleteComment,
    getCommentsForItem,
    markTeamActionItemDone,
    toggleBoardActionItemDone,
    assignTeamActionItem,
    assignBoardActionItem,
  };
};
