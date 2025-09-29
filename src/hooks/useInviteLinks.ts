
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getAuthUser } from '../lib/dataClient.ts';

interface InviteLink {
  id: string;
  token: string;
  team_id: string;
  invite_type: 'email' | 'link';
  is_active: boolean;
  expires_at: string;
  created_at: string;
}

export const useInviteLinks = (teamId: string | null) => {
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadInviteLinks = async () => {
    if (!teamId) {
      setInviteLinks([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('team_id', teamId)
        .eq('invite_type', 'link')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Type cast the data to ensure proper typing
      const typedInviteLinks = (data || []).map(link => ({
        ...link,
        invite_type: link.invite_type as 'email' | 'link'
      }));

      setInviteLinks(typedInviteLinks);
    } catch (error) {
      console.error('Error loading invite links:', error);
      toast({
        title: "Error loading invite links",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const createInviteLink = async () => {
    if (!teamId) return null;

    setLoading(true);
    try {
      const currentUser = (await getAuthUser()).data.user;
      if (!currentUser) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('team_invitations')
        .insert([{
          team_id: teamId,
          email: '', // Empty email for link invitations
          invited_by: currentUser.id,
          invite_type: 'link'
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Invite link created",
        description: "Share this link to invite people to your team",
      });

      await loadInviteLinks();
      return data;
    } catch (error) {
      console.error('Error creating invite link:', error);
      toast({
        title: "Error creating invite link",
        description: "Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const toggleInviteLink = async (linkId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('team_invitations')
        .update({ is_active: isActive })
        .eq('id', linkId);

      if (error) throw error;

      toast({
        title: isActive ? "Invite link activated" : "Invite link deactivated",
        description: isActive
          ? "The invite link is now active and can be used to join the team"
          : "The invite link has been deactivated and can no longer be used",
      });

      await loadInviteLinks();
    } catch (error) {
      console.error('Error toggling invite link:', error);
      toast({
        title: "Error updating invite link",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteInviteLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', linkId);

      if (error) throw error;

      toast({
        title: "Invite link deleted",
        description: "The invite link has been permanently deleted",
      });

      await loadInviteLinks();
    } catch (error) {
      console.error('Error deleting invite link:', error);
      toast({
        title: "Error deleting invite link",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  return {
    inviteLinks,
    loading,
    loadInviteLinks,
    createInviteLink,
    toggleInviteLink,
    deleteInviteLink
  };
};
