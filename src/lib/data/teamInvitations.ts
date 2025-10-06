import { supabase } from '@/integrations/supabase/client';
import { shouldUseCSharpApi } from '@/config/environment';
import { TeamInvitationRecord } from './types';
import { fetchProfile } from './profiles';
import { getTeamName } from './teams';

export async function fetchTeamInvitations(
    teamId: string,
    inviteType?: 'email' | 'link',
    status?: 'pending' | 'accepted' | 'declined'
): Promise<TeamInvitationRecord[]> {
    if (shouldUseCSharpApi()) {
        const { apiGetTeamInvitations } = await import('@/lib/data/csharpApi/apiClient');
        const response = await apiGetTeamInvitations(teamId, inviteType, status);
        return response.items.map(item => ({
            id: item.id,
            team_id: item.teamId,
            email: item.email,
            invited_by: item.invitedBy,
            token: item.token,
            status: item.status as 'pending' | 'accepted' | 'declined',
            invite_type: item.inviteType as 'email' | 'link',
            is_active: item.isActive,
            expires_at: item.expiresAt,
            created_at: item.createdAt
        }));
    }

    const query = supabase
        .from('team_invitations')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

    if (inviteType) {
        query.eq('invite_type', inviteType);
    }
    if (status) {
        query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(invitation => ({
        ...invitation,
        status: invitation.status as 'pending' | 'accepted' | 'declined',
        invite_type: invitation.invite_type as 'email' | 'link'
    }));
}

export async function createTeamInvitation(
    teamId: string,
    email: string,
    inviteType: 'email' | 'link',
    userId: string
): Promise<TeamInvitationRecord> {
    if (shouldUseCSharpApi()) {
        const { apiCreateTeamInvitation } = await import('@/lib/data/csharpApi/apiClient');
        const item = await apiCreateTeamInvitation(teamId, email, inviteType);
        return {
            id: item.id,
            team_id: item.teamId,
            email: item.email,
            invited_by: item.invitedBy,
            token: item.token,
            status: item.status as 'pending' | 'accepted' | 'declined',
            invite_type: item.inviteType as 'email' | 'link',
            is_active: item.isActive,
            expires_at: item.expiresAt,
            created_at: item.createdAt
        };
    }

    const { data, error } = await supabase
        .from('team_invitations')
        .insert([{
            team_id: teamId,
            email,
            invited_by: userId,
            invite_type: inviteType
        }])
        .select()
        .single();

    if (error) throw error;

    return {
        ...data,
        status: data.status as 'pending' | 'accepted' | 'declined',
        invite_type: data.invite_type as 'email' | 'link'
    };
}

export async function updateTeamInvitation(
    teamId: string,
    invitationId: string,
    isActive: boolean
): Promise<void> {
    if (shouldUseCSharpApi()) {
        const { apiUpdateTeamInvitation } = await import('@/lib/data/csharpApi/apiClient');
        await apiUpdateTeamInvitation(teamId, invitationId, isActive);
        return;
    }

    const { error } = await supabase
        .from('team_invitations')
        .update({ is_active: isActive })
        .eq('id', invitationId);

    if (error) throw error;
}

export async function deleteTeamInvitation(
    teamId: string,
    invitationId: string
): Promise<void> {
    if (shouldUseCSharpApi()) {
        const { apiDeleteTeamInvitation } = await import('@/lib/data/csharpApi/apiClient');
        await apiDeleteTeamInvitation(teamId, invitationId);
        return;
    }

    const { error } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', invitationId);

    if (error) throw error;
}

// Legacy method for backward compatibility
export async function cancelTeamInvitation(invitationId: string): Promise<void> {
    // This method doesn't have team_id, so we can't use the C# API easily
    // Keep direct Supabase for now until we can refactor callers
    const { error } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', invitationId);
    if (error) throw error;
}

export async function inviteMemberByEmail(teamId: string, email: string): Promise<{ emailSent: boolean; notifOk: boolean; invitationId: string }> {
    // Exact behavior mirrored from components using direct Supabase
    const currentUser = (await supabase.auth.getUser()).data.user;
    if (!currentUser) throw new Error('User not authenticated');

    const profile = await fetchProfile(currentUser.id);

    const teamName = await getTeamName(teamId);

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
            teamName: teamName,
            inviterName: profile?.full_name || 'Someone',
            token: invitation.token
        }
    });

    const { error: notifError } = await supabase.functions.invoke('notify-team-invite', {
        body: { invitationId: invitation.id }
    });

    return {
        emailSent: !emailError,
        notifOk: !notifError,
        invitationId: invitation.id
    };
}
