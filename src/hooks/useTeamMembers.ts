
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  profiles?: {
    full_name: string | null;
  };
}

interface TeamInvitation {
  id: string;
  team_id: string;
  email: string;
  invited_by: string;
  token: string;
  status: 'pending' | 'accepted' | 'declined';
  expires_at: string;
  created_at: string;
}

export const useTeamMembers = (teamId: string | null) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadMembers = async () => {
    if (!teamId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          *,
          profiles(full_name)
        `)
        .eq('team_id', teamId)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      
      // Type cast the data to ensure proper typing
      const typedMembers = (data || []).map(member => ({
        ...member,
        role: member.role as 'owner' | 'admin' | 'member'
      }));
      
      setMembers(typedMembers);
    } catch (error) {
      console.error('Error loading team members:', error);
      toast({
        title: "Error loading team members",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadInvitations = async () => {
    if (!teamId) {
      setInvitations([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('team_id', teamId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Type cast the data to ensure proper typing
      const typedInvitations = (data || []).map(invitation => ({
        ...invitation,
        status: invitation.status as 'pending' | 'accepted' | 'declined'
      }));
      
      setInvitations(typedInvitations);
    } catch (error) {
      console.error('Error loading invitations:', error);
    }
  };

  useEffect(() => {
    loadMembers();
    loadInvitations();
  }, [teamId]);

  const inviteMember = async (email: string) => {
    if (!teamId) return;

    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('team_invitations')
        .insert([{
          team_id: teamId,
          email,
          invited_by: currentUser.id
        }]);

      if (error) throw error;

      toast({
        title: "Invitation sent",
        description: `Invitation sent to ${email}`,
      });

      loadInvitations();
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast({
        title: "Error sending invitation",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Member removed",
        description: "Team member has been removed.",
      });

      loadMembers();
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: "Error removing member",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateMemberRole = async (memberId: string, newRole: 'owner' | 'admin' | 'member') => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Role updated",
        description: "Member role has been updated.",
      });

      loadMembers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error updating role",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: "Invitation cancelled",
        description: "The invitation has been cancelled.",
      });

      loadInvitations();
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast({
        title: "Error cancelling invitation",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  return {
    members,
    invitations,
    loading,
    inviteMember,
    removeMember,
    updateMemberRole,
    cancelInvitation,
    refetch: () => {
      loadMembers();
      loadInvitations();
    }
  };
};
