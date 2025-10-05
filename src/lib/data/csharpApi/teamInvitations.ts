import { getApiBaseUrl } from '@/config/environment';
import { getSupabaseAccessToken } from '@/lib/data/csharpApi/utils';

export type TeamInvitationItem = {
    id: string;
    teamId: string;
    email: string;
    invitedBy: string;
    token: string;
    status: string;
    inviteType: string;
    isActive: boolean;
    expiresAt: string;
    createdAt: string;
};

export type TeamInvitationsResponse = {
    items: TeamInvitationItem[];
};

export async function apiGetTeamInvitations(
    teamId: string,
    inviteType?: string,
    status?: string
): Promise<TeamInvitationsResponse> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();

    const params = new URLSearchParams();
    if (inviteType) params.append('inviteType', inviteType);
    if (status) params.append('status', status);

    const queryString = params.toString();
    const url = `${base}/api/teams/${encodeURIComponent(teamId)}/invitations${queryString ? `?${queryString}` : ''}`;

    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

export async function apiCreateTeamInvitation(
    teamId: string,
    email: string,
    inviteType: string
): Promise<TeamInvitationItem> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/teams/${encodeURIComponent(teamId)}/invitations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, inviteType })
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

export async function apiUpdateTeamInvitation(
    teamId: string,
    invitationId: string,
    isActive: boolean
): Promise<void> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/teams/${encodeURIComponent(teamId)}/invitations/${encodeURIComponent(invitationId)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
}

export async function apiDeleteTeamInvitation(
    teamId: string,
    invitationId: string
): Promise<void> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/teams/${encodeURIComponent(teamId)}/invitations/${encodeURIComponent(invitationId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
}
