import { supabase } from '@/integrations/supabase/client';
import { shouldUseCSharpApi } from '@/config/environment';
import { TeamRecord, TeamMemberRecord } from './types';
import { getAuthUser } from '@/lib/data/auth';
import { fetchProfilesByIds } from './profiles';
import { apiGetTeams } from '@/lib/data/csharpApi/apiClient';
import { client } from './dataClient.ts';

// Cache for teams list
interface TeamsCache {
    data: TeamRecord[];
    timestamp: number;
    loading: boolean;
    fetched: boolean;
}

let teamsCache: TeamsCache = {
    data: [],
    timestamp: 0,
    loading: false,
    fetched: false
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const isCacheStale = (timestamp: number) => Date.now() - timestamp > CACHE_DURATION;

// Cache management functions
export function invalidateTeamsCache(): void {
    teamsCache = {
        data: [],
        timestamp: 0,
        loading: false,
        fetched: false
    };
}

export function isTeamsCacheValid(): boolean {
    return teamsCache.fetched && !isCacheStale(teamsCache.timestamp);
}

export async function fetchTeams(): Promise<TeamRecord[]> {
    // Return cached data if valid
    if (isTeamsCacheValid()) {
        return teamsCache.data;
    }

    // Prevent concurrent requests
    if (teamsCache.loading) {
        // Wait for the ongoing request to complete
        while (teamsCache.loading) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return teamsCache.data;
    }

    // Set loading state
    teamsCache.loading = true;

    try {
        let teams: TeamRecord[];

        if (shouldUseCSharpApi()) {
            const { items } = await apiGetTeams();
            teams = items || [];
        } else {
            const currentUser = (await getAuthUser()).data.user;
            if (!currentUser) {
                teams = [];
            } else {
                const { data, error } = await supabase
                    .from('teams')
                    .select(`*, team_members!inner( role, user_id )`)
                    .eq('team_members.user_id', currentUser.id)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                teams = (data || []).map((team: any) => {
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
            }
        }

        // Update cache
        teamsCache = {
            data: teams,
            timestamp: Date.now(),
            loading: false,
            fetched: true
        };

        return teams;
    } catch (error) {
        // Reset loading state on error
        teamsCache.loading = false;
        throw error;
    }
}

export async function createTeam(name: string, description?: string): Promise<void> {
    if (shouldUseCSharpApi()) {
        const { apiCreateTeam } = await import('@/lib/data/csharpApi/apiClient');
        await apiCreateTeam(name);
    } else {
        const currentUser = (await supabase.auth.getUser()).data.user;
        if (!currentUser) throw new Error('User not authenticated');
        const { error } = await supabase
            .from('teams')
            .insert([{ name, description, creator_id: currentUser.id }]);
        if (error) throw error;
    }

    // Invalidate cache after creating a team
    invalidateTeamsCache();
}

export async function updateTeam(teamId: string, updates: { name?: string; description?: string }): Promise<void> {
    if (shouldUseCSharpApi()) {
        const { apiUpdateTeam } = await import('@/lib/data/csharpApi/apiClient');
        await apiUpdateTeam(teamId, { name: updates.name });
    } else {
        const { error } = await supabase
            .from('teams')
            .update(updates)
            .eq('id', teamId);
        if (error) throw error;
    }

    // Invalidate cache after updating a team
    invalidateTeamsCache();
}

export async function deleteTeam(teamId: string): Promise<void> {
    if (shouldUseCSharpApi()) {
        const { apiDeleteTeam } = await import('@/lib/data/csharpApi/apiClient');
        await apiDeleteTeam(teamId);
    } else {
        const { error } = await supabase
            .from('teams')
            .delete()
            .eq('id', teamId);
        if (error) throw error;
    }

    // Invalidate cache after deleting a team
    invalidateTeamsCache();
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

export async function getTeamName(teamId: string): Promise<string> {
    // if (shouldUseCSharpApi()) {
    //     const { apiGetTeamName } = await import('@/lib/data/csharpApi/apiClient');
    //     const { name } = await apiGetTeamName(teamId);
    //     return name || 'Team';
    // }
    const { data, error } = await client
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .single();

    if (error) throw error;
    return data?.name || 'Team';
}
