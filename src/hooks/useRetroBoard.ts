
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RetroBoard {
  id: string;
  room_id: string;
  title: string;
  is_private: boolean;
  created_at: string;
}

interface RetroColumn {
  id: string;
  board_id: string;
  title: string;
  color: string;
  position: number;
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

export const useRetroBoard = (roomId: string) => {
  const [board, setBoard] = useState<RetroBoard | null>(null);
  const [columns, setColumns] = useState<RetroColumn[]>([]);
  const [items, setItems] = useState<RetroItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15));
  const { toast } = useToast();

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [board]);

  const addItem = async (text: string, columnId: string, author: string) => {
    if (!board) return;

    const { error } = await supabase
      .from('retro_items')
      .insert([{
        board_id: board.id,
        column_id: columnId,
        text,
        author,
        author_id: (await supabase.auth.getUser()).data.user?.id || null
      }]);

    if (error) {
      console.error('Error adding item:', error);
      toast({
        title: "Error adding item",
        description: "Please try again.",
        variant: "destructive",
      });
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
    loading,
    addItem,
    addColumn,
    upvoteItem,
    updateItem,
    deleteItem
  };
};
