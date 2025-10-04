
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getAuthUser, fetchRetroBoards, createRetroBoard } from '../lib/dataClient.ts';

interface TeamBoard {
  id: string;
  room_id: string;
  title: string;
  is_private: boolean;
  password_hash?: string | null;
  archived: boolean;
  archived_at?: string | null;
  archived_by?: string | null;
  deleted: boolean;
  team_id?: string | null;
  retro_stage?: string | null;
  creator_id?: string | null;
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
      const data = await fetchRetroBoards(teamId, false);
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
      const currentUser = (await getAuthUser()).data.user;
      if (!currentUser) throw new Error('User not authenticated');

      // Generate a room ID
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Hash the password if provided
      let passwordHash: string | null = null;
      if (isPrivate && password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }

      // Create the board via dataClient
      const board = await createRetroBoard({
        roomId,
        title,
        isPrivate,
        passwordHash,
        teamId,
      });

      // Apply template settings (still using Supabase directly as this isn't in the C# API yet)
      const { data: defaultTemplate } = await supabase
        .from('board_templates')
        .select('*')
        .eq('team_id', teamId)
        .eq('is_default', true)
        .single();

      if (defaultTemplate && board) {
        await supabase
          .from('retro_board_config')
          .insert([{
            board_id: board.id,
            allow_anonymous: defaultTemplate.allow_anonymous,
            voting_enabled: defaultTemplate.voting_enabled,
            max_votes_per_user: defaultTemplate.max_votes_per_user,
            show_author_names: defaultTemplate.show_author_names,
            retro_stages_enabled: defaultTemplate.retro_stages_enabled
          }]);
      } else {
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
              show_author_names: defaultSettings.show_author_names,
              retro_stages_enabled: defaultSettings.retro_stages_enabled || false
            }]);
        } else if (board) {
          await supabase
            .from('retro_board_config')
            .insert([{
              board_id: board.id,
              allow_anonymous: true,
              voting_enabled: true,
              max_votes_per_user: null,
              show_author_names: true,
              retro_stages_enabled: false
            }]);
        }
      }

      const boardType = isPrivate ? 'private' : 'public';
      toast({
        title: "Board created",
        description: `New ${boardType} retro board created with your team's template settings.`,
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
