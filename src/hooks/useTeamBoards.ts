
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TeamBoard {
  id: string;
  room_id: string;
  title: string;
  is_private: boolean;
  password_hash: string | null;
  created_at: string;
  updated_at: string;
}

export const useTeamBoards = (teamId: string | null) => {
  const [boards, setBoards] = useState<TeamBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadBoards = async () => {
    if (!teamId) {
      setBoards([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('retro_boards')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBoards(data || []);
    } catch (error) {
      console.error('Error loading team boards:', error);
      toast({
        title: "Error loading boards",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoards();
  }, [teamId]);

  const createBoardForTeam = async (title: string, isPrivate: boolean = false, password: string | null = null) => {
    if (!teamId) return null;

    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser) throw new Error('User not authenticated');

      // Generate a room ID
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

      // The board creation will automatically use the team's default template
      // thanks to the database trigger we created
      const { data: board, error } = await supabase
        .from('retro_boards')
        .insert([{
          room_id: roomId,
          title,
          team_id: teamId,
          creator_id: currentUser.id,
          is_private: isPrivate,
          password_hash: password
        }])
        .select()
        .single();

      if (error) throw error;

      // Get team default settings and apply them to the board config
      const { data: defaultSettings } = await supabase
        .from('team_default_settings')
        .select('*')
        .eq('team_id', teamId)
        .single();

      if (defaultSettings && board) {
        await supabase
          .from('retro_board_config')
          .insert([{
            board_id: board.id,
            allow_anonymous: defaultSettings.allow_anonymous,
            voting_enabled: defaultSettings.voting_enabled,
            max_votes_per_user: defaultSettings.max_votes_per_user,
            show_author_names: defaultSettings.show_author_names
          }]);
      }

      const boardType = isPrivate ? 'private' : 'public';
      toast({
        title: "Board created",
        description: `New ${boardType} retro board created with your team's template.`,
      });

      loadBoards();
      return board;
    } catch (error) {
      console.error('Error creating team board:', error);
      toast({
        title: "Error creating board",
        description: "Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  return {
    boards,
    loading,
    createBoardForTeam,
    refetch: loadBoards
  };
};
