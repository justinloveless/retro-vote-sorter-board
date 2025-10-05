import { getApiBaseUrl } from '@/config/environment';
import { getSupabaseAccessToken } from '@/lib/data/csharpApi/utils';

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
