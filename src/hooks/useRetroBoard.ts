
import { useState, useEffect } from 'react';
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

interface ActiveUser {
  id: string;
  user_name: string;
  last_seen: string;
}

export const useRetroBoard = (roomId: string) => {
  const [board, setBoard] = useState<RetroBoard | null>(null);
  const [columns, setColumns] = useState<RetroColumn[]>([]);
  const [items, setItems] = useState<RetroItem[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15));
  const { toast } = useToast();

  // Update user presence with cleanup
  const updatePresence = async (userName: string) => {
    if (!board) return;

    const currentUser = (await supabase.auth.getUser()).data.user;
    
    // First, clean up any old presence records for this user/session
    if (currentUser) {
      await supabase
        .from('board_presence')
        .delete()
        .eq('board_id', board.id)
        .eq('user_id', currentUser.id);
    }
    
    // Then insert the new presence record
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
  };

  // Clean up presence when component unmounts or user leaves
  const cleanupPresence = async () => {
    if (!board) return;
    
    const currentUser = (await supabase.auth.getUser()).data.user;
    if (currentUser) {
      await supabase
        .from('board_presence')
        .delete()
        .eq('board_id', board.id)
        .eq('user_id', currentUser.id);
    }
  };

  // Load board data
  useEffect(() => {
    if (!roomId) return;
    
    const loadBoardData = async () => {
      try {
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

        // Load active users (only recent ones)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
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

  // Clean up presence on unmount
  useEffect(() => {
    return () => {
      cleanupPresence();
    };
  }, [board]);

  // Set up real-time subscriptions
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
              // Check if user already exists by user_id or user_name
              const userExists = currentUsers.some(user => 
                user.id === newUser.id || 
                (user.user_id === newUser.user_id && newUser.user_id)
              );
              
              if (userExists) {
                // Update existing user
                return currentUsers.map(user => 
                  (user.id === newUser.id || (user.user_id === newUser.user_id && newUser.user_id))
                    ? newUser 
                    : user
                );
              } else {
                // Add new user only if they don't exist
                return [...currentUsers, newUser];
              }
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
                user.id === updatedUser.id || 
                (user.user_id === updatedUser.user_id && updatedUser.user_id)
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
                user.id !== updatedUser.id && 
                !(user.user_id === updatedUser.user_id && updatedUser.user_id)
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
              user.id !== deletedUser.id && 
              !(user.user_id === deletedUser.user_id && deletedUser.user_id)
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

  return {
    board,
    columns,
    items,
    activeUsers,
    loading,
    addItem,
    addColumn,
    reorderColumns,
    upvoteItem,
    updateItem,
    deleteItem,
    updateBoardTitle,
    updatePresence
  };
};
