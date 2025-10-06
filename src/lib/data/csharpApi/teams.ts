import { fetchApi } from '@/lib/data/csharpApi/utils';
import { TeamRecord } from '@/lib/data/types';

export type TeamsResponse = {
    items: Array<TeamRecord>;
};

export async function apiGetTeams(): Promise<TeamsResponse> {
    const res = await fetchApi(`/api/teams`);
    return res.json();
}

export async function apiCreateTeam(name: string): Promise<{ id: string; name: string }> {
    const res = await fetchApi(`/api/teams`, { method: 'POST', body: JSON.stringify({ name }) });
    return res.json();
}

export async function apiUpdateTeam(teamId: string, updates: { name?: string }): Promise<{ id: string; name: string }> {
    const res = await fetchApi(`/api/teams/${teamId}`, { method: 'PATCH', body: JSON.stringify(updates) });
    return res.json();
}

export async function apiDeleteTeam(teamId: string): Promise<void> {
    await fetchApi(`/api/teams/${teamId}`, { method: 'DELETE' });
}

export async function apiGetTeamMembers(teamId: string): Promise<{ items: Array<any> }> {
    const res = await fetchApi(`/api/teams/${teamId}/members`);
    return res.json();
}

export async function apiAddMember(teamId: string, userId: string, role: string = 'member'): Promise<void> {
    await fetchApi(`/api/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify({ userId, role }) });
}

export async function apiUpdateMemberRole(teamId: string, userId: string, role: string): Promise<void> {
    await fetchApi(`/api/teams/${teamId}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role })
    });
}

export async function apiRemoveMember(teamId: string, userId: string): Promise<void> {
    await fetchApi(`/api/teams/${teamId}/members/${userId}`, { method: 'DELETE' });
}

export async function apiGetTeamName(teamId: string): Promise<{ name: string }> {
    const res = await fetchApi(`/api/teams/${teamId}/name`);
    return res.json();
}
