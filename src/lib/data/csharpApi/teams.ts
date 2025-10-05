import { getApiBaseUrl } from '@/config/environment';
import { getSupabaseAccessToken } from '@/lib/data/csharpApi/utils';
import { TeamRecord } from '@/lib/data/types';

export type TeamsResponse = {
    items: Array<TeamRecord>;
};

export async function apiGetTeams(): Promise<TeamsResponse> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/teams`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

export async function apiCreateTeam(name: string): Promise<{ id: string; name: string }> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/teams`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

export async function apiUpdateTeam(teamId: string, updates: { name?: string }): Promise<{ id: string; name: string }> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/teams/${teamId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

export async function apiDeleteTeam(teamId: string): Promise<void> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/teams/${teamId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
}

export async function apiGetTeamMembers(teamId: string): Promise<{ items: Array<any> }> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/teams/${teamId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

export async function apiAddMember(teamId: string, userId: string, role: string = 'member'): Promise<void> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role })
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
}

export async function apiUpdateMemberRole(teamId: string, userId: string, role: string): Promise<void> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/teams/${teamId}/members/${userId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
}

export async function apiRemoveMember(teamId: string, userId: string): Promise<void> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/teams/${teamId}/members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
}
