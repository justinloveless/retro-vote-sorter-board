
import { useState } from 'react';
import { supabase } from '../integrations/supabase/client.ts';
import { useToast } from '../hooks/use-toast.ts';

interface InvitationResponse {
  success: boolean;
  team_id?: string;
  team_name?: string;
  error?: string;
}

export const useInvitationAccept = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const acceptInvitation = async (token: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('accept_team_invitation', {
        invitation_token: token
      });

      if (error) throw error;

      const result = data as unknown as InvitationResponse;

      if (result.success) {
        toast({
          title: "Invitation accepted!",
          description: `You've successfully joined ${result.team_name}`,
        });
        return { success: true, teamId: result.team_id };
      } else {
        toast({
          title: "Failed to accept invitation",
          description: result.error,
          variant: "destructive",
        });
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      toast({
        title: "Error accepting invitation",
        description: "Please try again.",
        variant: "destructive",
      });
      return { success: false, error: 'Unknown error' };
    } finally {
      setLoading(false);
    }
  };

  return {
    acceptInvitation,
    loading
  };
};
