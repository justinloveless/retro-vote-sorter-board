import { supabase } from '@/integrations/supabase/client';
import { getApiBaseUrl } from '@/config/environment';
import { getAuthSession } from './dataClient.ts';

/**
 * Gets the current Supabase access token from the session
 * @returns Promise<string> - The access token
 * @throws Error if no valid session is found
 */
async function getSupabaseAccessToken(): Promise<string> {
  const { data: { session }, error } = await getAuthSession();

  if (error) {
    throw new Error(`Failed to get session: ${error.message}`);
  }

  if (!session?.access_token) {
    throw new Error('No valid session found');
  }

  return session.access_token;
}

/**
 * API client for calling the C# passthrough API
 */

export async function apiGetNotifications(limit = 50): Promise<{ items: Array<any> }> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const url = `${base}/api/notifications?limit=${limit}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API error ${res.status}: ${errorText}`);
  }

  return res.json();
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

export async function apiAdminSendNotification(payload: {
  recipients: Array<{ userId?: string; email?: string }>;
  type: string;
  title: string;
  message?: string;
  url?: string;
}): Promise<{ success: boolean; count?: number; info?: string }> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/admin/notifications`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ===============
// Teams API (Phase 3)
// ===============

export async function apiGetTeams(): Promise<{ items: Array<any> }> {
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

export async function apiMarkNotificationRead(notificationId: string): Promise<{ success: boolean; message: string }> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const url = `${base}/api/notifications/${notificationId}`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_read: true })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API error ${res.status}: ${errorText}`);
  }

  return res.json();
}

export async function apiMarkAllNotificationsRead(): Promise<{ success: boolean; updated_count: number; message: string }> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/notifications/mark-all-read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_read: true })
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ===============
// Feature Flags API
// ===============

export async function apiGetFeatureFlags(): Promise<{ items: Array<{ flagName: string; description?: string | null; isEnabled: boolean }> }> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/featureflags`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ===============
// Retro Boards API
// ===============

export type RetroBoardItem = {
  id: string;
  roomId: string;
  title: string;
  isPrivate: boolean;
  passwordHash?: string | null;
  archived: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  deleted: boolean;
  teamId?: string | null;
  retroStage?: string | null;
  creatorId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RetroBoardsResponse = {
  items: RetroBoardItem[];
};

export type RetroBoardSummaryResponse = {
  board: RetroBoardItem;
  team?: {
    id: string;
    name: string;
    members: Array<{ userId: string; role: string }>;
  };
};

export type BoardTitleItem = {
  id: string;
  title: string;
};

export type BoardTitlesResponse = {
  items: BoardTitleItem[];
};

export async function apiGetRetroBoards(
  teamId: string,
  includeDeleted: boolean = false
): Promise<RetroBoardsResponse> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const url = `${base}/api/retroboards/team/${encodeURIComponent(teamId)}?includeDeleted=${includeDeleted}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiGetRetroBoardSummary(roomId: string): Promise<RetroBoardSummaryResponse> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/retroboards/room/${encodeURIComponent(roomId)}/summary`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiGetRetroBoardTitlesByIds(
  boardIds: string[]
): Promise<BoardTitlesResponse> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();

  const params = new URLSearchParams();
  boardIds.forEach(id => params.append('boardIds', id));

  const url = `${base}/api/retroboards/by-ids?${params.toString()}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiCreateRetroBoard(
  roomId: string,
  title: string,
  isPrivate: boolean = false,
  passwordHash?: string | null,
  teamId?: string | null
): Promise<RetroBoardItem> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/retroboards`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, title, isPrivate, passwordHash, teamId })
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiUpdateRetroBoard(
  boardId: string,
  updates: {
    title?: string;
    isPrivate?: boolean;
    passwordHash?: string | null;
    archived?: boolean;
    archivedAt?: string | null;
    archivedBy?: string | null;
    deleted?: boolean;
    retroStage?: string | null;
  }
): Promise<void> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/retroboards/${encodeURIComponent(boardId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
}

export async function apiDeleteRetroBoard(boardId: string): Promise<void> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/retroboards/${encodeURIComponent(boardId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
}

export async function apiUpdateFeatureFlag(flagName: string, isEnabled: boolean): Promise<void> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/featureflags/${encodeURIComponent(flagName)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(isEnabled)
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
}

// ===============
// Profiles API
// ===============

export type ProfileItem = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: string | null;
  themePreference: string | null;
  backgroundPreference: any | null;
};

export type ProfileResponse = {
  profile: ProfileItem;
};

export async function apiGetProfile(userId: string): Promise<ProfileResponse> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/profiles/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ===============
// Team Invitations API
// ===============

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

// ===============
// Retro Comments API
// ===============

export type RetroCommentItem = {
  id: string;
  itemId: string;
  text: string;
  author: string;
  authorId?: string | null;
  sessionId?: string | null;
  createdAt: string;
  profile?: {
    avatarUrl?: string | null;
    fullName?: string | null;
  } | null;
};

export type RetroCommentsResponse = {
  items: RetroCommentItem[];
};

export async function apiGetCommentsByItemIds(
  itemIds: string[]
): Promise<RetroCommentsResponse> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();

  const params = new URLSearchParams();
  itemIds.forEach(id => params.append('itemIds', id));

  const url = `${base}/api/retro-comments/by-items?${params.toString()}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiGetCommentsByItemId(
  itemId: string
): Promise<RetroCommentsResponse> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/retro-comments/by-item/${encodeURIComponent(itemId)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiCreateComment(
  itemId: string,
  text: string,
  author: string,
  authorId?: string | null,
  sessionId?: string | null
): Promise<RetroCommentItem> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/retro-comments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, text, author, authorId, sessionId })
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function apiDeleteComment(
  commentId: string
): Promise<void> {
  const base = getApiBaseUrl();
  const token = await getSupabaseAccessToken();
  const res = await fetch(`${base}/api/retro-comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
}