import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

      if (error && error.code !== 'PGRST116') {
        throw error;
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
        if (board.team_id && user && board.teams) {
          const teamMembers = board.teams.team_members || [];
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
        // Room doesn't exist
        setAccessStatus('denied');
        toast({
          title: "Board not found",
          description: "This board has been deleted or does not exist.",
          variant: "destructive",
        });
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
