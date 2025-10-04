import { supabase } from '@/integrations/supabase/client';
import { shouldUseCSharpApi, getApiBaseUrl, currentEnvironment } from '@/config/environment';
import {
    apiGetFeatureFlags,
    apiUpdateFeatureFlag,
    apiGetNotifications,
    apiMarkNotificationRead,
    apiMarkAllNotificationsRead,
    apiAdminSendNotification
} from '@/lib/apiClient';
import { get } from 'http';

// Centralized data client that abstracts choosing between Supabase vs C# API.
// Start by implementing feature flags. Expand gradually to other domains.

export type FeatureFlagRecord = {
    flag_name: string;
    description: string | null;
    is_enabled: boolean;
};

export async function fetchFeatureFlags(): Promise<FeatureFlagRecord[]> {
    if (shouldUseCSharpApi()) {
        const response = await apiGetFeatureFlags();
        return (response.items || []).map(item => ({
            flag_name: item.flagName,
            description: item.description ?? null,
            is_enabled: item.isEnabled
        }));
    }

    const { data, error } = await supabase
        .from('feature_flags')
        .select('*');
    if (error) throw error;
    return data || [];
}

export async function updateFeatureFlag(flagName: string, isEnabled: boolean): Promise<void> {
    if (shouldUseCSharpApi()) {
        await apiUpdateFeatureFlag(flagName, isEnabled);
        return;
    }

    const { error } = await supabase
        .from('feature_flags')
        .update({ is_enabled: isEnabled })
        .eq('flag_name', flagName);
    if (error) throw error;
}

// ====================
// Notifications
// ====================

export type AppNotification = {
    id: string;
    user_id: string;
    type: string;
    title: string;
    message: string | null;
    url: string | null;
    is_read: boolean;
    created_at: string;
};

export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
    if (shouldUseCSharpApi()) {
        const response = await apiGetNotifications(limit);
        return (response.items || []) as AppNotification[];
    }
    const currentUser = (await getAuthUser()).data.user;
    if (!currentUser) return [];
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return (data as AppNotification[]) || [];
}

export async function markNotificationRead(id: string): Promise<void> {
    if (shouldUseCSharpApi()) {
        await apiMarkNotificationRead(id);
        return;
    }
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
    if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
    if (shouldUseCSharpApi()) {
        await apiMarkAllNotificationsRead();
        return;
    }
    const currentUser = (await getAuthUser()).data.user;
    if (!currentUser) return;
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false);
    if (error) throw error;
}

// ====================
// Profiles
// ====================

export type ProfileRecord = {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    role: 'user' | 'admin' | null;
    theme_preference: string | null;
    background_preference: any | null;
};

export async function fetchProfile(userId: string): Promise<ProfileRecord | null> {
    if (shouldUseCSharpApi()) {
        const { apiGetProfile } = await import('@/lib/apiClient');
        try {
            const response = await apiGetProfile(userId);
            return {
                id: response.profile.id,
                full_name: response.profile.fullName,
                avatar_url: response.profile.avatarUrl,
                role: (response.profile.role as 'user' | 'admin') || null,
                theme_preference: response.profile.themePreference,
                background_preference: response.profile.backgroundPreference
            };
        } catch (error) {
            console.error('Error fetching profile from API:', error);
            return null;
        }
    }

    try {
        const { data: profileData, error } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, role, theme_preference, background_preference')
            .eq('id', userId)
            .single();

        if (error) {
            throw error;
        }

        return profileData;
    } catch (error) {
        console.error('Error fetching profile from Supabase:', error);
        return null;
    }
}

// ====================
// Admin
// ====================

export async function adminSendNotification(payload: {
    recipients: Array<{ userId?: string; email?: string }>;
    type: string;
    title: string;
    message?: string;
    url?: string;
}): Promise<{ success: boolean; count?: number; info?: string }> {
    if (shouldUseCSharpApi()) {
        return apiAdminSendNotification(payload);
    }
    const { error } = await supabase.functions.invoke('admin-send-notification', { body: payload });
    if (error) throw error;
    return { success: true };
}

// ====================
// Teams
// ====================

export type TeamRecord = {
    id: string;
    name: string;
    description: string | null;
    creator_id: string | null;
    created_at: string;
    updated_at: string;
    role: 'owner' | 'admin' | 'member' | null;
};

export async function fetchTeams(): Promise<TeamRecord[]> {
    if (shouldUseCSharpApi()) {
        const { items } = await (await import('@/lib/apiClient')).apiGetTeams();
        const mapped = (items || []).map((team: any) => ({
            id: team.id,
            name: team.name,
            description: team.description ?? null,
            creator_id: team.creator_id ?? null,
            created_at: team.created_at ?? '',
            updated_at: team.created_at ?? '',
            role: team.role ?? null
        })) as TeamRecord[];
        return mapped;
    }
    const currentUser = (await getAuthUser()).data.user;
    if (!currentUser) return [];
    const { data, error } = await supabase
        .from('teams')
        .select(`*, team_members!inner( role, user_id )`)
        .eq('team_members.user_id', currentUser.id)
        .order('created_at', { ascending: false });
    if (error) throw error;
    const teamsWithRoles = (data || []).map((team: any) => {
        const currentUserMembership = team.team_members.find((m: any) => m.user_id === currentUser.id);
        return {
            id: team.id,
            name: team.name,
            description: team.description ?? null,
            creator_id: team.creator_id ?? null,
            created_at: team.created_at,
            updated_at: team.updated_at,
            role: currentUserMembership?.role || null
        } as TeamRecord;
    });
    return teamsWithRoles;
}

export async function createTeam(name: string, description?: string): Promise<void> {
    if (shouldUseCSharpApi()) {
        const { apiCreateTeam } = await import('@/lib/apiClient');
        await apiCreateTeam(name);
        return;
    }
    const currentUser = (await supabase.auth.getUser()).data.user;
    if (!currentUser) throw new Error('User not authenticated');
    const { error } = await supabase
        .from('teams')
        .insert([{ name, description, creator_id: currentUser.id }]);
    if (error) throw error;
}

export async function updateTeam(teamId: string, updates: { name?: string; description?: string }): Promise<void> {
    if (shouldUseCSharpApi()) {
        const { apiUpdateTeam } = await import('@/lib/apiClient');
        await apiUpdateTeam(teamId, { name: updates.name });
        return;
    }
    const { error } = await supabase
        .from('teams')
        .update(updates)
        .eq('id', teamId);
    if (error) throw error;
}

export async function deleteTeam(teamId: string): Promise<void> {
    if (shouldUseCSharpApi()) {
        const { apiDeleteTeam } = await import('@/lib/apiClient');
        await apiDeleteTeam(teamId);
        return;
    }
    const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);
    if (error) throw error;
}

export type TeamMemberRecord = {
    id: string;
    team_id: string;
    user_id: string;
    role: 'owner' | 'admin' | 'member';
    joined_at: string;
    profiles?: { full_name: string | null } | null;
};

export async function fetchTeamMembers(teamId: string): Promise<TeamMemberRecord[]> {
    if (shouldUseCSharpApi()) {
        const { apiGetTeamMembers } = await import('@/lib/apiClient');
        const { items } = await apiGetTeamMembers(teamId);
        return (items || []).map((m: any) => ({
            id: m.userId,
            team_id: m.teamId,
            user_id: m.userId,
            role: (m.role || 'member') as 'owner' | 'admin' | 'member',
            joined_at: '',
            profiles: { full_name: m.displayName ?? null }
        }));
    }
    const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .order('joined_at', { ascending: true });
    if (membersError) throw membersError;
    const userIds = membersData?.map(member => member.user_id) || [];
    const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
    if (profilesError) throw profilesError;
    return (membersData || []).map(member => ({
        ...member,
        role: member.role as 'owner' | 'admin' | 'member',
        profiles: profilesData?.find(profile => profile.id === member.user_id) || null
    })) as TeamMemberRecord[];
}

export async function removeTeamMember(teamId: string, memberId: string): Promise<void> {
    if (shouldUseCSharpApi()) {
        const { apiRemoveMember } = await import('@/lib/apiClient');
        await apiRemoveMember(teamId, memberId);
        return;
    }
    const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);
    if (error) throw error;
}

export async function updateTeamMemberRole(teamId: string, memberId: string, role: 'owner' | 'admin' | 'member'): Promise<void> {
    if (shouldUseCSharpApi()) {
        const { apiUpdateMemberRole } = await import('@/lib/apiClient');
        await apiUpdateMemberRole(teamId, memberId, role);
        return;
    }
    const { error } = await supabase
        .from('team_members')
        .update({ role })
        .eq('id', memberId);
    if (error) throw error;
}

// ====================
// Team Invitations
// ====================

export type TeamInvitationRecord = {
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
};

export async function fetchTeamInvitations(
    teamId: string,
    inviteType?: 'email' | 'link',
    status?: 'pending' | 'accepted' | 'declined'
): Promise<TeamInvitationRecord[]> {
    if (shouldUseCSharpApi()) {
        const { apiGetTeamInvitations } = await import('@/lib/apiClient');
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
        const { apiCreateTeamInvitation } = await import('@/lib/apiClient');
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
        const { apiUpdateTeamInvitation } = await import('@/lib/apiClient');
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
        const { apiDeleteTeamInvitation } = await import('@/lib/apiClient');
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

    const { error: notifError } = await supabase.functions.invoke('notify-team-invite', {
        body: { invitationId: invitation.id }
    });

    return {
        emailSent: !emailError,
        notifOk: !notifError,
        invitationId: invitation.id
    };
}

// ====================
// Admin Team Management (Edge functions proxy)
// ====================

export async function adminListTeams(query: string): Promise<Array<{ id: string; name: string }>> {
    const { data, error } = await supabase.functions.invoke('admin-team-members', { body: { action: 'list_teams', query } });
    if (error) throw error;
    return ((data as any)?.teams || []) as Array<{ id: string; name: string }>;
}

// ====================
// Retro Boards
// ====================

export async function fetchRetroBoardSummary(roomId: string): Promise<{ board: any; team?: { id: string; name: string; members: Array<{ userId: string; role: string }> } }> {
    if (shouldUseCSharpApi()) {
        const { apiGetRetroBoardSummary } = await import('@/lib/apiClient');
        return apiGetRetroBoardSummary(roomId);
    }
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
    if (error && (error as any).code !== 'PGRST116') throw error;
    return { board: data } as any;
}

export async function createRetroBoardWithDefaults(params: { roomId: string; title: string; creatorId?: string | null }): Promise<any> {
    // Direct Supabase path only (no C# API implementation yet)
    const { data: newBoard, error: boardError } = await supabase
        .from('retro_boards')
        .insert([{ room_id: params.roomId, title: params.title, creator_id: params.creatorId || null, is_private: false }])
        .select()
        .single();
    if (boardError) throw boardError;

    const { error: configError } = await supabase
        .from('retro_board_config')
        .insert([{ board_id: newBoard.id, allow_anonymous: true, voting_enabled: true, max_votes_per_user: 3, show_author_names: true }]);
    if (configError) {
        // non-fatal, log and continue
        console.error('Error creating board config:', configError);
    }

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
        .eq('room_id', params.roomId)
        .single();
    if (error) throw error;
    return board;
}

export async function updateRetroBoardPrivacyByRoom(roomId: string, payload: { is_private: boolean; password_hash: string | null }): Promise<void> {
    const { error } = await supabase
        .from('retro_boards')
        .update(payload)
        .eq('room_id', roomId);
    if (error) throw error;
}

export async function getUserVotes(boardId: string, userId?: string | null, sessionId?: string): Promise<string[]> {
    // Direct Supabase for now
    const query = supabase.from('retro_votes').select('item_id').eq('board_id', boardId);
    if (userId) {
        query.eq('user_id', userId);
    } else if (sessionId) {
        query.eq('session_id', sessionId);
    }
    const { data, error } = await query as any;
    if (error) throw error;
    return (data || []).map((v: any) => v.item_id);
}

export async function addVote(params: { boardId: string; itemId: string; userId?: string | null; sessionId?: string }): Promise<void> {
    const { error } = await supabase.from('retro_votes').insert({
        item_id: params.itemId,
        board_id: params.boardId,
        user_id: params.userId,
        session_id: params.sessionId,
    });
    if (error) throw error;
}

export async function removeVote(params: { boardId: string; itemId: string; userId?: string | null; sessionId?: string }): Promise<void> {
    const { error } = await supabase
        .from('retro_votes')
        .delete()
        .match({ item_id: params.itemId, board_id: params.boardId, user_id: params.userId, session_id: params.sessionId });
    if (error) throw error;
}

export async function fetchCommentsForItems(itemIds: string[]): Promise<any[]> {
    if (itemIds.length === 0) return [];
    const { data, error } = await supabase
        .from('retro_comments')
        .select('*, profiles(avatar_url, full_name)')
        .in('item_id', itemIds)
        .order('created_at');
    if (error) throw error;
    return data || [];
}

export async function addRetroComment(params: { itemId: string; text: string; author: string; authorId?: string | null; sessionId?: string | null }): Promise<any> {
    const { data, error } = await supabase
        .from('retro_comments')
        .insert([{ item_id: params.itemId, text: params.text, author: params.author, author_id: params.authorId || null, session_id: params.sessionId || null }])
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteRetroComment(commentId: string): Promise<void> {
    const { error } = await supabase
        .from('retro_comments')
        .delete()
        .eq('id', commentId);
    if (error) throw error;
}

// ====================
// Account / Profile
// ====================

export async function getImpersonatedEmailIfAdmin(targetUserId: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_user_email_if_admin', { target_user: targetUserId });
    if (error) return null;
    return (data as any) || null;
}

export async function adminSetAvatar(userId: string, blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer();
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch(`${currentEnvironment.supabaseUrl}/functions/v1/admin-set-avatar?user_id=${userId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'image/png',
            'Authorization': `Bearer ${session?.access_token ?? ''}`
        },
        body: arrayBuffer
    });
    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(err || 'Failed to set avatar as admin');
    }
    const json = await resp.json();
    return json.publicUrl || json.PublicUrl || '';
}

export async function uploadAvatarForUser(userId: string, blob: Blob): Promise<string> {
    if (shouldUseCSharpApi()) {
        const base = getApiBaseUrl();
        const { data: { session } } = await supabase.auth.getSession();
        const form = new FormData();
        form.append('file', blob, `${userId}.png`);
        const resp = await fetch(`${base}/api/avatars/${userId}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
            body: form
        });
        if (!resp.ok) throw new Error(`Upload failed ${resp.status}`);
        const json = await resp.json();
        return json.publicUrl || json.PublicUrl || '';
    }
    const fileName = `${userId}.png`;
    await supabase.storage.from('avatars').upload(fileName, blob, { upsert: true, contentType: 'image/png' });
    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    return data.publicUrl;
}

// ====================
// Auth Helpers (centralized wrappers around Supabase auth)
// ====================

export async function getAuthSession() {
    return supabase.auth.getSession();
}

export async function getAuthUser() {
    return supabase.auth.getUser();
}

export function onAuthStateChange(callback: (event: any, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
}

export async function signInWithOAuth(provider: 'github' | 'google', redirectTo?: string) {
    return supabase.auth.signInWithOAuth({ provider, options: redirectTo ? { redirectTo } : undefined as any });
}

export async function resetPasswordForEmail(email: string, redirectTo: string) {
    return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

export async function signUpWithEmail(email: string, password: string, fullName: string, redirectURL: string) {
    return supabase.auth.signUp(
        {
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
                emailRedirectTo: redirectURL,
            }
        }
    );
}

export async function signInWithPassword(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password });
}

export async function setAuthSession(accessToken: string, refreshToken: string) {
    return supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
}

export async function updateAuthUser(payload: { password?: string }) {
    return supabase.auth.updateUser(payload);
}

export async function signOut() {
    return supabase.auth.signOut();
}

// ====================
// Poker Sessions
// ====================

export async function getPokerSessionByRoom(roomId: string): Promise<any | null> {
    const { data, error } = await supabase
        .from('poker_sessions')
        .select('*')
        .eq('room_id', roomId)
        .single();
    if (error && (error as any).code === 'PGRST116') return null;
    if (error) throw error;
    return data;
}

export async function createPokerSession(roomId: string): Promise<any> {
    const { data, error } = await supabase
        .from('poker_sessions')
        .insert({ room_id: roomId, current_round_number: 1 })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function getPokerRound(sessionId: string, roundNumber: number): Promise<any | null> {
    const { data, error } = await supabase
        .from('poker_session_rounds')
        .select('*')
        .eq('session_id', sessionId)
        .eq('round_number', roundNumber)
        .single();
    if (error && (error as any).code === 'PGRST116') return null;
    if (error) throw error;
    return data;
}

export async function createPokerRound(sessionId: string, roundNumber: number, selections: any, ticketNumber?: string): Promise<any> {
    const { data, error } = await supabase
        .from('poker_session_rounds')
        .insert({ session_id: sessionId, round_number: roundNumber, selections, ticket_number: ticketNumber || '' })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updatePokerRoundById(roundId: string, fields: any): Promise<any> {
    const { data, error } = await supabase
        .from('poker_session_rounds')
        .update(fields)
        .eq('id', roundId)
        .select()
        .single();
    return { data, error };
}

export async function updatePokerSessionById(sessionId: string, fields: any): Promise<void> {
    const { error } = await supabase
        .from('poker_sessions')
        .update(fields)
        .eq('id', sessionId);
    if (error) throw error;
}

export async function deletePokerSessionData(sessionId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('delete-session-data', { body: { session_id: sessionId } });
    if (error) throw new Error(`Function invocation failed: ${error.message}`);
}

export async function fetchPokerRounds(sessionId: string): Promise<any[]> {
    const { data, error } = await supabase
        .from('poker_session_rounds')
        .select('*')
        .eq('session_id', sessionId)
        .order('round_number', { ascending: true });
    if (error) throw error;
    return data || [];
}

// ====================
// Poker Session Chat
// ====================

export async function fetchPokerChatMessages(sessionId: string, roundNumber: number): Promise<any[]> {
    const { data, error } = await supabase
        .from('poker_session_chat_with_details')
        .select('*')
        .eq('session_id', sessionId)
        .eq('round_number', roundNumber)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function sendPokerChatMessage(params: { sessionId: string; roundNumber: number; userId: string; userName: string; messageText: string; replyToMessageId?: string }): Promise<void> {
    const { error } = await supabase
        .from('poker_session_chat')
        .insert({
            session_id: params.sessionId,
            round_number: params.roundNumber,
            user_id: params.userId,
            user_name: params.userName,
            message: params.messageText,
            reply_to_message_id: params.replyToMessageId,
        });
    if (error) throw error;
}

export async function addPokerChatReaction(params: { sessionId: string; messageId: string; userId: string; userName: string; emoji: string }): Promise<void> {
    const { error } = await supabase.from('poker_session_chat_message_reactions').insert({
        message_id: params.messageId,
        user_id: params.userId,
        user_name: params.userName,
        emoji: params.emoji,
        session_id: params.sessionId
    });
    if (error) throw error;
}

export async function removePokerChatReaction(params: { messageId: string; userId: string; emoji: string }): Promise<void> {
    const { error } = await supabase
        .from('poker_session_chat_message_reactions')
        .delete()
        .eq('message_id', params.messageId)
        .eq('user_id', params.userId)
        .eq('emoji', params.emoji);
    if (error) throw error;
}

export async function uploadPokerChatImage(sessionId: string, roundNumber: number, file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${sessionId}/${roundNumber}/${fileName}`;
    const bucketName = 'poker-session-chat-images';

    const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
        });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    if (!data.publicUrl) throw new Error('Failed to get public URL');
    return data.publicUrl;
}

// ====================
// Retro Timer Audio Storage
// ====================

export function getRetroAudioPublicUrl(fileName: string): string {
    return supabase.storage.from('retro-audio').getPublicUrl(fileName).data.publicUrl;
}

export async function uploadRetroAudio(userId: string, file: File): Promise<{ fileName: string; publicUrl: string }> {
    const fileExt = file.name.split('.').pop();
    const fileName = `retro-music-${userId}-${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('retro-audio').upload(fileName, file);
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from('retro-audio').getPublicUrl(fileName);
    if (!publicUrl) throw new Error('Failed to get public URL');
    return { fileName, publicUrl };
}

export async function deleteRetroAudio(fileName: string): Promise<void> {
    const { error } = await supabase.storage.from('retro-audio').remove([fileName]);
    if (error) throw error;
}

// ====================
// Team Action Items (non-realtime helpers)
// ====================

export async function fetchOpenTeamActionItems(teamId: string): Promise<Array<{ id: string; text: string; assigned_to?: string | null }>> {
    const { data, error } = await supabase
        .from('team_action_items')
        .select('id, text, assigned_to')
        .eq('team_id', teamId)
        .eq('done', false)
        .order('created_at');
    if (error) throw error;
    return data || [];
}

export async function markTeamActionItemDoneById(id: string): Promise<void> {
    const { error } = await supabase
        .from('team_action_items')
        .update({ done: true, done_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
}

// ====================
// App Config & Feedback Reports
// ====================

export async function getAppConfigValue(key: string): Promise<string | ''> {
    const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', key)
        .single();
    if (error && (error as any).code !== 'PGRST116') throw error;
    return (data?.value as string) || '';
}

export async function upsertAppConfig(entries: Array<{ key: string; value: string }>): Promise<void> {
    const { error } = await supabase
        .from('app_config')
        .upsert(entries, { onConflict: 'key' });
    if (error) throw error;
}

export async function insertFeedbackReport(params: {
    userId?: string | null;
    email?: string | null;
    type: string;
    title: string;
    description: string;
    pageUrl: string;
}): Promise<{ id: string }> {
    const { data, error } = await supabase
        .from('feedback_reports')
        .insert({
            user_id: params.userId ?? null,
            email: params.email ?? null,
            type: params.type,
            title: params.title,
            description: params.description,
            page_url: params.pageUrl,
        })
        .select('id')
        .single();
    if (error) throw error;
    return { id: data.id };
}

export async function updateFeedbackReport(id: string, fields: { github_issue_url?: string }): Promise<void> {
    const { error } = await supabase
        .from('feedback_reports')
        .update(fields)
        .eq('id', id);
    if (error) throw error;
}

export async function assignTeamActionItemById(id: string, userId: string | null): Promise<void> {
    const { error } = await supabase
        .from('team_action_items')
        .update({ assigned_to: userId })
        .eq('id', id);
    if (error) throw error;
}

export async function adminListTeamMembers(teamId: string): Promise<Array<{ id: string; user_id: string; full_name: string | null; avatar_url: string | null; email: string | null; role: 'owner' | 'admin' | 'member' }>> {
    const { data, error } = await supabase.functions.invoke('admin-team-members', { body: { action: 'list_team_members', team_id: teamId } });
    if (error) throw error;
    return ((data as any)?.members || []) as Array<{ id: string; user_id: string; full_name: string | null; avatar_url: string | null; email: string | null; role: 'owner' | 'admin' | 'member' }>;
}

export async function adminAddMember(teamId: string, input: { userIdOrEmail: string; role: 'owner' | 'admin' | 'member' }): Promise<void> {
    const body: any = { action: 'add_member', team_id: teamId, role: input.role };
    if (/^[0-9a-fA-F-]{36}$/.test(input.userIdOrEmail.trim())) body.user_id = input.userIdOrEmail.trim(); else body.email = input.userIdOrEmail.trim();
    const { error } = await supabase.functions.invoke('admin-team-members', { body });
    if (error) throw error;
}

export async function adminRemoveMember(memberId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('admin-team-members', { body: { action: 'remove_member', member_id: memberId } });
    if (error) throw error;
}


