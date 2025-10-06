
import { fetchApi } from '@/lib/data/csharpApi/utils';

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
    const res = await fetchApi(`/api/teams/${teamId}/invitations`, {
        method: 'GET',
        params: { inviteType, status }
    });
    return res.json();
}

export async function apiCreateTeamInvitation(
    teamId: string,
    email: string,
    inviteType: string
): Promise<TeamInvitationItem> {
    const res = await fetchApi(`/api/teams/${teamId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email, inviteType })
    });
    return res.json();
}

export async function apiUpdateTeamInvitation(
    teamId: string,
    invitationId: string,
    isActive: boolean
): Promise<void> {
    await fetchApi(`/api/teams/${teamId}/invitations/${invitationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive })
    });
}

export async function apiDeleteTeamInvitation(
    teamId: string,
    invitationId: string
): Promise<void> {
    await fetchApi(`/api/teams/${teamId}/invitations/${invitationId}`, {
        method: 'DELETE'
    });
}

