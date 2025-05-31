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
  const { toast } = useToast();

  // Debounced presence update to avoid creating presence on every keystroke
  const debouncedUpdatePresence = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (userName: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        if (!board || !userName.trim()) return;

        try {
          const currentUser = (await supabase.auth.getUser()).data.user;
          
          // Clean up any old presence records for this user/session first
          if (currentUser) {
            await supabase
              .from('board_presence')
              .delete()
              .eq('board_id', board.id)
              .eq('user_id', currentUser.id);
          }
          
          // Insert new presence record
          await supabase
            .from('board_presence')
            .upsert({
              board_id: board.id,
              user_id: currentUser?.id || null,
              user_name: userName,
              last_seen: new Date().toISOString()
            }, {
              onConflict: currentUser ? 'board_id,user_id' : undefined
            });
        } catch (error) {
          console.error('Error updating presence:', error);
        }
      }, 1000); // 1 second debounce
    };
  }, [board]);

  // Memoized cleanup function to avoid dependency issues
  const cleanupPresence = useCallback(async (boardId?: string) => {
    if (!boardId) return;
    
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (currentUser) {
        await supabase
          .from('board_presence')
          .delete()
          .eq('board_id', boardId)
          .eq('user_id', currentUser.id);
      }
    } catch (error) {
      console.error('Error cleaning up presence:', error);
    }
  }, []);

  // Update user presence with debouncing
  const updatePresence = useCallback((userName: string) => {
    debouncedUpdatePresence(userName);
  }, [debouncedUpdatePresence]);

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
            .insert([{ room_id: roomId, title: 'Team Retrospective' }])
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

        // Load active users (only recent ones and clean up stale data)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        
        // First, clean up old presence records
        await supabase
          .from('board_presence')
          .delete()
          .eq('board_id', boardData.id)
          .lt('last_seen', new Date(Date.now() - 10 * 60 * 1000).toISOString());

        const { data: usersData, error: usersError } = await supabase
          .from('board_presence')
          .select('*')
          .eq('board_id', boardData.id)
          .gte('last_seen', fiveMinutesAgo);

        if (usersError) throw usersError;
        setActiveUsers(usersData || []);

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

  // Clean up presence on unmount and handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (board?.id) {
        // Use navigator.sendBeacon for reliable cleanup on page unload
        const currentUser = supabase.auth.getUser();
        currentUser.then(({ data }) => {
          if (data.user) {
            // Create a simple request to delete presence
            const url = `${supabase.supabaseUrl}/rest/v1/board_presence?board_id=eq.${board.id}&user_id=eq.${data.user.id}`;
            navigator.sendBeacon(url, JSON.stringify({}));
          }
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && board?.id) {
        cleanupPresence(board.id);
      }
    };

    // Add event listeners for cleanup
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (board?.id) {
        cleanupPresence(board.id);
      }
    };
  }, [board?.id, cleanupPresence]);

  // Set up real-time subscriptions - updated to better handle presence
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
          event: 'INSERT',
          schema: 'public',
          table: 'board_presence',
          filter: `board_id=eq.${board.id}`
        },
        (payload) => {
          const newUser = payload.new as ActiveUser;
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          
          if (newUser.last_seen >= fiveMinutesAgo) {
            setActiveUsers(currentUsers => {
              // Check if user already exists by id or user_name
              const userExists = currentUsers.some(user => 
                user.id === newUser.id || user.user_name === newUser.user_name
              );
              
              if (!userExists) {
                return [...currentUsers, newUser];
              }
              
              // Update existing user
              return currentUsers.map(user => 
                (user.id === newUser.id || user.user_name === newUser.user_name)
                  ? newUser 
                  : user
              );
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'board_presence',
          filter: `board_id=eq.${board.id}`
        },
        (payload) => {
          const updatedUser = payload.new as ActiveUser;
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          
          setActiveUsers(currentUsers => {
            if (updatedUser.last_seen >= fiveMinutesAgo) {
              // Find and update existing user
              const existingUserIndex = currentUsers.findIndex(user => 
                user.id === updatedUser.id || user.user_name === updatedUser.user_name
              );
              
              if (existingUserIndex >= 0) {
                const updatedUsers = [...currentUsers];
                updatedUsers[existingUserIndex] = updatedUser;
                return updatedUsers;
              } else {
                // Only add if user doesn't exist
                return [...currentUsers, updatedUser];
              }
            } else {
              // Remove user if they're too old
              return currentUsers.filter(user => 
                user.id !== updatedUser.id && user.user_name !== updatedUser.user_name
              );
            }
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'board_presence',
          filter: `board_id=eq.${board.id}`
        },
        (payload) => {
          const deletedUser = payload.old as ActiveUser;
          setActiveUsers(currentUsers => 
            currentUsers.filter(user => 
              user.id !== deletedUser.id && user.user_name !== deletedUser.user_name
            )
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'board_presence',
          filter: `board_id=eq.${board.id}`
        },
        async () => {
          // Reload all active users to get clean state
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const { data: usersData } = await supabase
            .from('board_presence')
            .select('*')
            .eq('board_id', board.id)
            .gte('last_seen', fiveMinutesAgo);
          
          setActiveUsers(usersData || []);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [board]);

  // Set up periodic presence cleanup
  useEffect(() => {
    if (!board) return;

    const cleanupInterval = setInterval(async () => {
      // Remove presence records older than 10 minutes
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      await supabase
        .from('board_presence')
        .delete()
        .eq('board_id', board.id)
        .lt('last_seen', tenMinutesAgo);

      // Also clean up local state
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      setActiveUsers(currentUsers => 
        currentUsers.filter(user => user.last_seen >= fiveMinutesAgo)
      );
    }, 60000); // Run every minute

    return () => clearInterval(cleanupInterval);
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
