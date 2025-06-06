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
}

interface RetroComment {
  id: string;
  item_id: string;
  author: string;
  author_id?: string;
  text: string;
  created_at: string;
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
}

export const useRetroBoard = (roomId: string) => {
  const [board, setBoard] = useState<RetroBoard | null>(null);
  const [columns, setColumns] = useState<RetroColumn[]>([]);
  const [items, setItems] = useState<RetroItem[]>([]);
  const [comments, setComments] = useState<RetroComment[]>([]);
  const [boardConfig, setBoardConfig] = useState<RetroBoardConfig | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15));
  const [presenceChannel, setPresenceChannel] = useState<any>(null);
  const { toast } = useToast();

  // Update user presence using Supabase realtime presence
  const updatePresence = useCallback(async (userName: string) => {
    if (!presenceChannel || !userName.trim()) return;

    const currentUser = (await supabase.auth.getUser()).data.user;
    
    await presenceChannel.track({
      user_id: currentUser?.id || sessionId,
      user_name: userName,
      last_seen: new Date().toISOString()
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
          .select('*')
          .eq('board_id', boardData.id)
          .order('votes', { ascending: false });

        if (itemsError) throw itemsError;
        setItems(itemsData || []);

        // Load comments
        const { data: commentsData, error: commentsError } = await supabase
          .from('retro_comments')
          .select('*')
          .in('item_id', (itemsData || []).map(item => item.id))
          .order('created_at');

        if (commentsError) throw commentsError;
        setComments(commentsData || []);

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
              last_seen: presence.last_seen
            });
          });
        });
        
        setActiveUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', leftPresences);
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
          event: '*',
          schema: 'public',
          table: 'retro_columns',
          filter: `board_id=eq.${board.id}`
        },
        async () => {
          const { data } = await supabase
            .from('retro_columns')
            .select('*')
            .eq('board_id', board.id)
            .order('position');
          setColumns(data || []);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'retro_items',
          filter: `board_id=eq.${board.id}`
        },
        async () => {
          const { data } = await supabase
            .from('retro_items')
            .select('*')
            .eq('board_id', board.id)
            .order('votes', { ascending: false });
          setItems(data || []);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'retro_comments'
        },
        async () => {
          const { data: itemsData } = await supabase
            .from('retro_items')
            .select('id')
            .eq('board_id', board.id);
          
          if (itemsData) {
            const { data: commentsData } = await supabase
              .from('retro_comments')
              .select('*')
              .in('item_id', itemsData.map(item => item.id))
              .order('created_at');
            setComments(commentsData || []);
          }
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
          event: 'INSERT',
          schema: 'public',
          table: 'retro_items',
          filter: `board_id=eq.${board.id}`
        },
        (payload) => {
          const newItem = payload.new as RetroItem;
          setItems(currentItems => [...currentItems, newItem]);
        }
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
              item.id === updatedItem.id ? updatedItem : item
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
          console.log('Real-time delete event received for item:', deletedItem.id);
          setItems(currentItems => 
            currentItems.filter(item => item.id !== deletedItem.id)
          );
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
  }, [board]);

  const updateBoardTitle = async (title: string) => {
    if (!board) return;

    const { error } = await supabase
      .from('retro_boards')
      .update({ title })
      .eq('id', board.id);

    if (error) {
      console.error('Error updating board title:', error);
      toast({
        title: "Error updating title",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateBoardConfig = async (config: Partial<RetroBoardConfig>) => {
    if (!board) return;

    const { error } = await supabase
      .from('retro_board_config')
      .update(config)
      .eq('board_id', board.id);

    if (error) {
      console.error('Error updating board config:', error);
      toast({
        title: "Error updating configuration",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const addItem = async (text: string, columnId: string, author: string) => {
    if (!board) return;

    const currentUser = (await supabase.auth.getUser()).data.user;

    const { error } = await supabase
      .from('retro_items')
      .insert([{
        board_id: board.id,
        column_id: columnId,
        text,
        author,
        author_id: currentUser?.id || null
      }]);

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

    const { error } = await supabase
      .from('retro_columns')
      .insert([{
        board_id: board.id,
        title,
        color: colors[columns.length % colors.length],
        position: columns.length + 1
      }]);

    if (error) {
      console.error('Error adding column:', error);
      toast({
        title: "Error adding column",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateColumn = async (columnId: string, title: string) => {
    const { error } = await supabase
      .from('retro_columns')
      .update({ title })
      .eq('id', columnId);

    if (error) {
      console.error('Error updating column:', error);
      toast({
        title: "Error updating column",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteColumn = async (columnId: string) => {
    const { error } = await supabase
      .from('retro_columns')
      .delete()
      .eq('id', columnId);

    if (error) {
      console.error('Error deleting column:', error);
      toast({
        title: "Error deleting column",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const reorderColumns = async (newColumns: RetroColumn[]) => {
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
    const currentUser = (await supabase.auth.getUser()).data.user;
    
    const { error } = await supabase
      .from('retro_votes')
      .insert([{
        item_id: itemId,
        user_id: currentUser?.id || null,
        session_id: currentUser ? null : sessionId
      }]);

    if (error && error.code === '23505') {
      // Already voted, remove vote
      await supabase
        .from('retro_votes')
        .delete()
        .match({
          item_id: itemId,
          ...(currentUser ? { user_id: currentUser.id } : { session_id: sessionId })
        });
    } else if (error) {
      console.error('Error voting:', error);
      toast({
        title: "Error voting",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateItem = async (itemId: string, text: string) => {
    const { error } = await supabase
      .from('retro_items')
      .update({ text })
      .eq('id', itemId);

    if (error) {
      console.error('Error updating item:', error);
      toast({
        title: "Error updating item",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteItem = async (itemId: string) => {
    console.log('item deleted: ', itemId);
    setItems(currentItems => 
            currentItems.filter(item => item.id !== itemId)
          );

    const { error } = await supabase
      .from('retro_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Error deleting item",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const addComment = async (itemId: string, text: string, author: string) => {
    const currentUser = (await supabase.auth.getUser()).data.user;

    const { error } = await supabase
      .from('retro_comments')
      .insert([{
        item_id: itemId,
        text,
        author,
        author_id: currentUser?.id || null
      }]);

    if (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error adding comment",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase
      .from('retro_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Error deleting comment:', error);
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
    getCommentsForItem
  };
};
