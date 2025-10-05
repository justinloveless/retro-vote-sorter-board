import { supabase } from '@/integrations/supabase/client';
import { shouldUseCSharpApi } from '@/config/environment';
import { TeamRecord, TeamMemberRecord } from './types';
import { getAuthUser } from '@/lib/data/auth';
import { fetchProfilesByIds } from './profiles';

export async function fetchTeams(): Promise<TeamRecord[]> {
    if (shouldUseCSharpApi()) {
        const { items } = await (await import('@/lib/data/csharpApi/apiClient')).apiGetTeams();
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
        const { apiCreateTeam } = await import('@/lib/data/csharpApi/apiClient');
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
        const { apiUpdateTeam } = await import('@/lib/data/csharpApi/apiClient');
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
        const { apiDeleteTeam } = await import('@/lib/data/csharpApi/apiClient');
        await apiDeleteTeam(teamId);
        return;
    }
    const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);
    if (error) throw error;
}

export async function fetchTeamMembers(teamId: string): Promise<TeamMemberRecord[]> {
    if (shouldUseCSharpApi()) {
        const { apiGetTeamMembers } = await import('@/lib/data/csharpApi/apiClient');
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

    // Use the new fetchProfilesByIds function
    const profilesData = await fetchProfilesByIds(userIds);

    return (membersData || []).map(member => ({
        ...member,
        role: member.role as 'owner' | 'admin' | 'member',
        profiles: profilesData?.find(profile => profile.id === member.user_id) || null
    })) as TeamMemberRecord[];
}

export async function removeTeamMember(teamId: string, memberId: string): Promise<void> {
    if (shouldUseCSharpApi()) {
        const { apiRemoveMember } = await import('@/lib/data/csharpApi/apiClient');
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
        const { apiUpdateMemberRole } = await import('@/lib/data/csharpApi/apiClient');
        await apiUpdateMemberRole(teamId, memberId, role);
        return;
    }
    const { error } = await supabase
        .from('team_members')
        .update({ role })
        .eq('id', memberId);
    if (error) throw error;
}
