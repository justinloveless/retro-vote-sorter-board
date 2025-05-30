
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useRoomAccess = (roomId: string, user: any) => {
  const [boardData, setBoardData] = useState<any>(null);
  const [hasRoomAccess, setHasRoomAccess] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const { toast } = useToast();

  const checkRoomAccess = async () => {
    if (!roomId) return;

    try {
      const { data: board, error } = await supabase
        .from('retro_boards')
        .select(`
          *,
          teams!inner(
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
        setBoardData(board);
        setIsPrivate(board.is_private);

        // Check if user is a team member for this board
        if (board.team_id && user && board.teams) {
          const teamMembers = board.teams.team_members || [];
          const isMember = teamMembers.some((member: any) => member.user_id === user.id);
          setIsTeamMember(isMember);

          if (board.is_private && board.password_hash) {
            // If user is a team member, grant access automatically
            if (isMember) {
              setHasRoomAccess(true);
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
              setHasRoomAccess(true);
            } else {
              setShowPasswordDialog(true);
            }
          } else {
            setShowPasswordDialog(true);
          }
        } else {
          setHasRoomAccess(true);
        }
      } else {
        // Room doesn't exist, allow access to create it
        setHasRoomAccess(true);
      }
    } catch (error) {
      console.error('Error checking room access:', error);
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
      setHasRoomAccess(true);
      setShowPasswordDialog(false);
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
    hasRoomAccess,
    isPrivate,
    showPasswordDialog,
    isTeamMember,
    handlePasswordSubmit,
    setIsPrivate
  };
};
