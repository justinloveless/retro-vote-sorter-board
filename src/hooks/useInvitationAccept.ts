
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

      if (data.success) {
        toast({
          title: "Invitation accepted!",
          description: `You've successfully joined ${data.team_name}`,
        });
        return { success: true, teamId: data.team_id };
      } else {
        toast({
          title: "Failed to accept invitation",
          description: data.error,
          variant: "destructive",
        });
        return { success: false, error: data.error };
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
