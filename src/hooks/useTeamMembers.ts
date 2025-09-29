
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchTeamMembers as dcFetchTeamMembers, updateTeamMemberRole as dcUpdateMemberRole, removeTeamMember as dcRemoveTeamMember, TeamMemberRecord, getAuthUser } from '@/lib/dataClient';
import { useToast } from '@/hooks/use-toast';

type TeamMember = TeamMemberRecord;

interface TeamInvitation {
  id: string;
  team_id: string;
  email: string;
  invited_by: string;
  token: string;
  status: 'pending' | 'accepted' | 'declined';
  invite_type: 'email' | 'link';
  is_active: boolean;
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
      const typedMembers = await dcFetchTeamMembers(teamId);
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
        .eq('invite_type', 'email')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Type cast the data to ensure proper typing
      const typedInvitations = (data || []).map(invitation => ({
        ...invitation,
        status: invitation.status as 'pending' | 'accepted' | 'declined',
        invite_type: invitation.invite_type as 'email' | 'link'
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
      // Invitations still rely on Supabase direct flow (not yet implemented in C# API)
      const currentUser = (await getAuthUser()).data.user;
      if (!currentUser) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', currentUser.id)
        .single();

      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .single();

      const { data: invitation, error } = await supabase
        .from('team_invitations')
        .insert([{
          team_id: teamId,
          email,
          invited_by: currentUser.id,
          invite_type: 'email'
        }])
        .select()
        .single();

      if (error) throw error;

      const { error: emailError } = await supabase.functions.invoke('send-invitation-email', {
        body: {
          invitationId: invitation.id,
          email: email,
          teamName: team?.name || 'Team',
          inviterName: profile?.full_name || 'Someone',
          token: invitation.token
        }
      });

      await supabase.functions.invoke('notify-team-invite', {
        body: { invitationId: invitation.id }
      });

      if (emailError) {
        console.error('Error sending email:', emailError);
        toast({
          title: "Invitation created",
          description: `Invitation created for ${email}, but email may not have been sent. They can still use the invite link.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Invitation sent",
          description: `Invitation email sent to ${email}`,
        });
      }

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
      if (!teamId) throw new Error('Team not selected');
      await dcRemoveTeamMember(teamId, memberId);

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
      if (!teamId) throw new Error('Team not selected');
      await dcUpdateMemberRole(teamId, memberId, newRole);

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
