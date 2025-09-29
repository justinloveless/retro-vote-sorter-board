
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserMinus, Crown, Shield, User, Mail, X, Clock, Link, UserPlus } from 'lucide-react';
import { useTeamData } from '@/contexts/TeamDataContext';
import { InviteMemberDialog } from './InviteMemberDialog';
import { InviteLinkDialog } from './InviteLinkDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { cancelTeamInvitation as dcCancelInvitation, removeTeamMember as dcRemoveTeamMember, updateTeamMemberRole as dcUpdateTeamMemberRole, inviteMemberByEmail } from '@/lib/dataClient';
import { useToast } from '@/hooks/use-toast';

interface TeamMembersListProps {
  teamId: string;
  teamName: string;
  currentUserRole?: string;
}

export const TeamMembersList: React.FC<TeamMembersListProps> = ({ teamId, teamName, currentUserRole }) => {
  const teamData = useTeamData();
  const { data: members, loading, refetch: refetchMembers } = teamData.getMembers(teamId);
  const { data: invitations, refetch: refetchInvitations } = teamData.getInvitations(teamId);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const inviteMember = async (email: string) => {
    try {
      const { emailSent, notifOk } = await inviteMemberByEmail(teamId, email);

      if (!emailSent) {
        console.error('Error sending email');
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
      if (!notifOk) {
        console.warn('notify-team-invite failed or user not found for email:', email);
      }

      refetchInvitations();
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
      await dcRemoveTeamMember(teamId, memberId);

      toast({
        title: "Member removed",
        description: "Team member has been removed.",
      });

      refetchMembers();
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
      await dcUpdateTeamMemberRole(teamId, memberId, newRole);

      toast({
        title: "Role updated",
        description: "Member role has been updated.",
      });

      refetchMembers();
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
      await dcCancelInvitation(invitationId);

      toast({
        title: "Invitation cancelled",
        description: "The invitation has been cancelled.",
      });

      refetchInvitations();
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast({
        title: "Error cancelling invitation",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-600" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-600" />;
      default:
        return <User className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canChangeRoles = currentUserRole === 'owner';

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Loading team members...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className={`flex items-center justify-between ${isMobile ? 'flex-col gap-4' : ''}`}>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members ({members.length})
            </CardTitle>
            {canManageMembers && (
              <div className={`flex gap-2 ${isMobile ? 'w-full flex-col' : ''}`}>
                <Button
                  variant="outline"
                  onClick={() => setShowLinkDialog(true)}
                  className={isMobile ? 'w-full' : ''}
                >
                  <Link className="h-4 w-4 mr-2" />
                  Invite Link
                </Button>
                <Button
                  onClick={() => setShowInviteDialog(true)}
                  className={isMobile ? 'w-full' : ''}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {members.map((member) => (
            <div key={member.id} className={`${isMobile ? 'border rounded-lg p-4 space-y-3' : 'flex items-center justify-between p-3 border rounded-lg'}`}>
              <div className={`flex items-center gap-3 ${isMobile ? 'justify-between' : ''}`}>
                <div className="flex items-center gap-2">
                  {getRoleIcon(member.role)}
                  <div>
                    <div className="font-medium">
                      {member.profiles?.full_name || 'Unknown User'}
                    </div>
                    <div className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Badge variant={getRoleBadgeVariant(member.role)}>
                  {member.role}
                </Badge>
              </div>

              <div className={`flex items-center gap-2 ${isMobile ? 'justify-end' : ''}`}>
                {canChangeRoles && member.role !== 'owner' && (
                  <Select
                    value={member.role}
                    onValueChange={(newRole) => updateMemberRole(member.id, newRole as any)}
                  >
                    <SelectTrigger className={isMobile ? 'w-28 h-8 text-xs' : 'w-24'}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {canManageMembers && member.role !== 'owner' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size={isMobile ? "sm" : "sm"}
                        className={isMobile ? 'h-8 px-2' : ''}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove {member.profiles?.full_name || 'this user'} from the team?
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => removeMember(member.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Remove Member
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {invitations.length > 0 && canManageMembers && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Invitations ({invitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invitations.map((invitation) => (
              <div key={invitation.id} className={`${isMobile ? 'border rounded-lg p-4 bg-yellow-50 space-y-3' : 'flex items-center justify-between p-3 border rounded-lg bg-yellow-50'}`}>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <div>
                    <div className="font-medium">{invitation.email}</div>
                    <div className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      Invited {new Date(invitation.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {!isMobile && <Badge variant="outline">Pending</Badge>}
                </div>

                <div className={`flex items-center ${isMobile ? 'justify-between' : 'gap-2'}`}>
                  {isMobile && <Badge variant="outline">Pending</Badge>}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cancelInvitation(invitation.id)}
                    className={isMobile ? 'h-8 px-2' : ''}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <InviteMemberDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        onInvite={inviteMember}
      />

      <InviteLinkDialog
        open={showLinkDialog}
        onOpenChange={setShowLinkDialog}
        teamId={teamId}
        teamName={teamName}
      />
    </div>
  );
};
