import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RetroBoard {
  id: string;
  room_id: string;
  title: string;
  is_private: boolean;
  password_hash: string | null;
  created_at: string;
  archived: boolean;
}

interface RetroColumn {
  id: string;
  board_id: string;
  title: string;
  color: string;
  position: number;
  sort_order?: number;
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
}

interface ActiveUser {
  id: string;
  user_name: string;
  last_seen: string;
  avatar_url?: string;
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
  const [userVotes, setUserVotes] = useState<string[]>([]);
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
  const { toast } = useToast();

  // Update user presence using Supabase realtime presence
  const updatePresence = useCallback(async (userName: string, avatarUrl?: string) => {
    if (!presenceChannel || !userName.trim()) return;

    const currentUser = (await supabase.auth.getUser()).data.user;

    await presenceChannel.track({
      user_id: currentUser?.id || sessionId,
      user_name: userName,
      last_seen: new Date().toISOString(),
      avatar_url: avatarUrl
    });
  }, [presenceChannel, sessionId]);

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
        let { data: boardData, error: boardError } = await supabase
          .from('retro_boards')
          .select('*')
          .eq('room_id', roomId)
          .single();

        if (boardError && boardError.code === 'PGRST116') {
          // Board doesn't exist, create it
          const { data: newBoard, error: createError } = await supabase
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
        const { data: configData, error: configError } = await supabase
          .from('retro_board_config')
          .select('*')
          .eq('board_id', boardData.id)
          .single();

        if (configError && configError.code === 'PGRST116') {
          // Config doesn't exist, create it
          const { data: newConfig, error: createConfigError } = await supabase
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
        const { data: columnsData, error: columnsError } = await supabase
          .from('retro_columns')
          .select('*')
          .eq('board_id', boardData.id)
          .order('position');

        if (columnsError) throw columnsError;
        setColumns(columnsData || []);

        // Load items
        const { data: itemsData, error: itemsError } = await supabase
          .from('retro_items')
          .select('*, profiles(avatar_url, full_name)')
          .eq('board_id', boardData.id)
          .order('votes', { ascending: false });

        if (itemsError) throw itemsError;
        setItems(itemsData || []);

        // Load comments
        const { data: commentsData, error: commentsError } = await supabase
          .from('retro_comments')
          .select('*, profiles(avatar_url, full_name)')
          .in('item_id', (itemsData || []).map(item => item.id))
          .order('created_at');

        if (commentsError) throw commentsError;
        setComments(commentsData || []);

        // Load user's votes
        const currentUser = (await supabase.auth.getUser()).data.user;
        const voteQuery = supabase.from('retro_votes').select('item_id').eq('board_id', boardData.id);
        if (currentUser) {
          voteQuery.eq('user_id', currentUser.id);
        } else {
          voteQuery.eq('session_id', sessionId);
        }

        const { data: userVotesData, error: userVotesError } = await voteQuery;

        if (userVotesError) throw userVotesError;
        setUserVotes((userVotesData || []).map(v => v.item_id));

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

  const handleNewItem = useCallback((payload: any) => {
    const newItem = payload.new as RetroItem;
    // Check if item already exists to prevent duplicates from optimistic updates
    if (items.some(item => item.id === newItem.id)) {
      return;
    }
    supabase.from('profiles').select('avatar_url, full_name').eq('id', newItem.author_id).single().then(({ data }) => {
      newItem.profiles = data;
      setItems(prevItems => [...prevItems, newItem]);
    });
  }, [items]);

  const handleNewComment = useCallback((payload: any) => {
    const newComment = payload.new as RetroComment;
    if (items.some(item => item.id === newComment.item_id)) {
      // Check if comment already exists
      if (comments.some(comment => comment.id === newComment.id)) {
        return;
      }
      supabase.from('profiles').select('avatar_url, full_name').eq('id', newComment.author_id).single().then(({ data }) => {
        newComment.profiles = data;
        setComments(prevComments => [...prevComments, newComment]);
      });
    }
  }, [items, comments]);

  // Set up realtime presence channel
  useEffect(() => {
    if (!board) return;

    const channel = supabase.channel(`board_${board.id}`, {
      config: {
        presence: {
          key: 'users'
        }
      }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: ActiveUser[] = [];

        Object.keys(state).forEach(key => {
          const presences = state[key] as any[];
          presences.forEach(presence => {
            users.push({
              id: presence.user_id,
              user_name: presence.user_name,
              last_seen: presence.last_seen,
              avatar_url: presence.avatar_url,
            });
          });
        });

        setActiveUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      })
      .on('broadcast', { event: 'audio-summary-state' }, ({ payload }) => {
        setAudioSummaryState(payload);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setPresenceChannel(channel);
        }
      });

    return () => {
      channel.unsubscribe();
      setPresenceChannel(null);
    };
  }, [board]);

  // Set up real-time subscriptions for board data
  useEffect(() => {
    if (!board) return;

    const channel = supabase
      .channel('retro-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'retro_columns',
          filter: `board_id=eq.${board.id}`
        },
        (payload) => {
          const newColumn = payload.new as RetroColumn;
          setColumns(prevColumns => {
            if (prevColumns.find(c => c.id === newColumn.id)) return prevColumns;
            return [...prevColumns, newColumn].sort((a, b) => a.position - b.position)
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'retro_items',
          filter: `board_id=eq.${board.id}`
        },
        handleNewItem
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'retro_items',
          filter: `board_id=eq.${board.id}`
        },
        (payload) => {
          const updatedItem = payload.new as RetroItem;
          setItems(currentItems =>
            currentItems.map(item =>
              item.id === updatedItem.id ? { ...item, ...updatedItem } : item
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'retro_items',
          filter: `board_id=eq.${board.id}`
        },
        (payload) => {
          const deletedItem = payload.old as RetroItem;
          setItems(currentItems =>
            currentItems.filter(item => item.id !== deletedItem.id)
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'retro_comments'
        },
        handleNewComment
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'retro_comments'
        },
        (payload) => {
          const deletedComment = payload.old as RetroComment;
          setComments(currentComments =>
            currentComments.filter(comment => comment.id !== deletedComment.id)
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'retro_board_config',
          filter: `board_id=eq.${board.id}`
        },
        async () => {
          const { data } = await supabase
            .from('retro_board_config')
            .select('*')
            .eq('board_id', board.id)
            .single();
          setBoardConfig(data);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'retro_boards',
          filter: `id=eq.${board.id}`
        },
        (payload) => {
          setBoard(payload.new as RetroBoard);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [board, items, handleNewItem, handleNewComment]);

  const updateBoardTitle = async (title: string) => {
    if (!board) return;

    const oldTitle = board.title;
    setBoard(prev => prev ? { ...prev, title } : null); // Optimistic update

    const { error } = await supabase
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

    const { error } = await supabase
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

    const currentUser = (await supabase.auth.getUser()).data.user;

    const { data: newItem, error } = await supabase
      .from('retro_items')
      .insert([{
        board_id: board.id,
        column_id: columnId,
        text,
        author,
        author_id: currentUser?.id || null,
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
    updatePresence(author === 'Anonymous' ? (currentUser?.email || 'Anonymous User') : author);
  };

  const addColumn = async (title: string) => {
    if (!board) return;

    const colors = [
      'bg-purple-100 border-purple-300',
      'bg-orange-100 border-orange-300',
      'bg-pink-100 border-pink-300',
      'bg-indigo-100 border-indigo-300'
    ];

    const { data: newColumn, error } = await supabase
      .from('retro_columns')
      .insert([{
        board_id: board.id,
        title,
        color: colors[columns.length % colors.length],
        position: columns.length + 1
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

  const updateColumn = async (columnId: string, updates: { title: string }) => {
    const oldColumns = [...columns];
    setColumns(prevColumns =>
      prevColumns.map(column =>
        column.id === columnId ? { ...column, ...updates } : column
      )
    );

    const { error } = await supabase
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
    }
  };

  const deleteColumn = async (columnId: string) => {
    try {
      const { error } = await supabase
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
      await supabase
        .from('retro_columns')
        .update({ position: update.position, sort_order: update.sort_order })
        .eq('id', update.id);
    }
  };

  const upvoteItem = async (itemId: string) => {
    if (!board || !boardConfig) return;

    const currentUser = (await supabase.auth.getUser()).data.user;
    const userId = currentUser?.id;
    const voteSessionId = !currentUser ? sessionId : undefined;

    const hasVoted = userVotes.includes(itemId);

    // Prevent adding a new vote if the limit is reached
    if (!hasVoted && boardConfig.max_votes_per_user && userVotes.length >= boardConfig.max_votes_per_user) {
      toast({
        title: 'Vote limit reached',
        description: `You can only vote ${boardConfig.max_votes_per_user} times.`,
        variant: 'destructive'
      });
      return;
    }

    // Optimistic UI updates
    setUserVotes(prev => (hasVoted ? prev.filter(id => id !== itemId) : [...prev, itemId]));
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId
          ? { ...item, votes: hasVoted ? item.votes - 1 : item.votes + 1 }
          : item
      )
    );

    if (hasVoted) {
      // Remove vote from server
      const { error } = await supabase
        .from('retro_votes')
        .delete()
        .match({ item_id: itemId, board_id: board.id, user_id: userId, session_id: voteSessionId });

      if (error) {
        toast({ title: 'Error removing vote', variant: 'destructive' });
        // Revert UI changes on error
        setUserVotes(prev => [...prev, itemId]);
        setItems(prevItems =>
          prevItems.map(item =>
            item.id === itemId ? { ...item, votes: item.votes + 1 } : item
          )
        );
      }
    } else {
      // Add vote to server
      const { error } = await supabase.from('retro_votes').insert({
        item_id: itemId,
        board_id: board.id,
        user_id: userId,
        session_id: voteSessionId,
      });

      if (error) {
        toast({ title: 'Error adding vote', variant: 'destructive' });
        // Revert UI changes on error
        setUserVotes(prev => prev.filter(id => id !== itemId));
        setItems(prevItems =>
          prevItems.map(item =>
            item.id === itemId ? { ...item, votes: item.votes - 1 } : item
          )
        );
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

    const { error } = await supabase
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
    }
  };

  const deleteItem = async (itemId: string) => {
    const oldItems = [...items];
    setItems(currentItems =>
      currentItems.filter(item => item.id !== itemId)
    );

    const { error } = await supabase
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
    const currentUser = (await supabase.auth.getUser()).data.user;

    const { data: newComment, error } = await supabase
      .from('retro_comments')
      .insert([{
        item_id: itemId,
        text,
        author,
        author_id: currentUser?.id || null,
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

    const { error } = await supabase
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
    return comments.filter(comment => comment.item_id === itemId);
  };

  const updateAudioSummaryState = (state: AudioSummaryState | null) => {
    setAudioSummaryState(state);
    if (presenceChannel) {
      presenceChannel.send({
        type: 'broadcast',
        event: 'audio-summary-state',
        payload: state,
      });
    }
  };

  return {
    board,
    columns,
    items,
    comments,
    boardConfig,
    activeUsers,
    loading,
    addItem,
    addColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
    upvoteItem,
    updateItem,
    deleteItem,
    updateBoardTitle,
    updateBoardConfig,
    updatePresence,
    addComment,
    deleteComment,
    getCommentsForItem,
    sessionId,
    presenceChannel,
    audioSummaryState,
    updateAudioSummaryState,
    userVotes,
  };
};
