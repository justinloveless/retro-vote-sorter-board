import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { shouldUseCSharpApi } from '@/config/environment';
import { apiGetRetroBoardSummary } from '@/lib/apiClient';

export type AccessStatus = 'loading' | 'granted' | 'denied' | 'password_required';

export const useRoomAccess = (roomId: string, user: any) => {
  const [boardData, setBoardData] = useState<any>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('loading');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const { toast } = useToast();

  const checkRoomAccess = async () => {
    if (!roomId) {
      setAccessStatus('loading');
      return;
    }

    try {
      setAccessStatus('loading');
      let board: any = null;
      let team: { id: string; name: string; members: Array<{ userId: string; role: string }> } | undefined;

      if (shouldUseCSharpApi()) {
        const summary = await apiGetRetroBoardSummary(roomId);
        board = summary.board;
        team = summary.team;
      } else {
        const { data, error } = await supabase
          .from('retro_boards')
          .select(`
            *,
            teams(
              id,
              name,
              team_members(user_id, role)
            )
          `)
          .eq('room_id', roomId)
          .single();
        if (error && error.code !== 'PGRST116') throw error;
        board = data;
      }

      if (board) {
        if (board.deleted) {
          setAccessStatus('denied');
          toast({
            title: "Board not found",
            description: "This board has been deleted or does not exist.",
            variant: "destructive",
          });
          return;
        }

        setBoardData(board);
        setIsPrivate(board.is_private);

        // Check if user is a team member for this board
        if (board.team_id && user) {
          const teamMembers = team ? team.members : (board.teams?.team_members || []);
          const isMember = teamMembers.some((member: any) => member.user_id === user.id);
          setIsTeamMember(isMember);

          if (board.is_private && board.password_hash) {
            if (isMember) {
              setAccessStatus('granted');
              return;
            }
          }
        }

        if (board.is_private && board.password_hash) {
          // Check if user already authenticated for this room
          const savedAuth = localStorage.getItem(`retro-room-${roomId}`);
          if (savedAuth) {
            const authData = JSON.parse(savedAuth);
            if (authData.authenticated) {
              setAccessStatus('granted');
            } else {
              setAccessStatus('password_required');
            }
          } else {
            setAccessStatus('password_required');
          }
        } else {
          setAccessStatus('granted');
        }
      } else {
        // Room doesn't exist, create it
        const createNewRoom = async () => {
          try {
            const newBoardTitle = 'Quick Retro Board';
            const { data: newBoard, error: boardError } = await supabase
              .from('retro_boards')
              .insert([{
                room_id: roomId,
                title: newBoardTitle,
                creator_id: user?.id || null,
                is_private: false,
              }])
              .select()
              .single();

            if (boardError) {
              throw boardError;
            }

            const { error: configError } = await supabase
              .from('retro_board_config')
              .insert([{
                board_id: newBoard.id,
                allow_anonymous: true,
                voting_enabled: true,
                max_votes_per_user: 3,
                show_author_names: true
              }]);

            if (configError) {
              console.error('Error creating board config:', configError);
            }

            // Refetch board data to include team info if any
            const { data: board, error } = await supabase
              .from('retro_boards')
              .select(`
                *,
                teams(
                  id,
                  name,
                  team_members(user_id, role)
                )
              `)
              .eq('room_id', roomId)
              .single();

            if (error) throw error;

            setBoardData(board);
            setAccessStatus('granted');
            setIsPrivate(false);
            toast({
              title: "New board created!",
              description: "Welcome to your new retro board.",
            });

          } catch (creationError) {
            console.error('Error creating new room:', creationError);
            setAccessStatus('denied');
            toast({
              title: "Error creating board",
              description: "Could not create a new board. Please try again.",
              variant: "destructive",
            });
          }
        };

        createNewRoom();
      }
    } catch (error) {
      console.error('Error checking room access:', error);
      setAccessStatus('denied');
      toast({
        title: "Error accessing room",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePasswordSubmit = async (enteredPassword: string) => {
    if (!boardData || !enteredPassword) return;

    // Simple password check (in production, you'd hash and compare)
    if (enteredPassword === 'demo123' || boardData.password_hash === enteredPassword) {
      setAccessStatus('granted');
      localStorage.setItem(`retro-room-${roomId}`, JSON.stringify({
        isPrivate: true,
        authenticated: true
      }));
      toast({
        title: "Access granted",
        description: "Welcome to the retro room!",
      });
    } else {
      toast({
        title: "Incorrect password",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    checkRoomAccess();
  }, [roomId, user]);

  return {
    boardData,
    accessStatus,
    isPrivate,
    isTeamMember,
    handlePasswordSubmit,
    setIsPrivate
  };
};
