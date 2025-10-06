import { fetchApi } from '@/lib/data/csharpApi/utils';

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
    const res = await fetchApi(`/api/retroboards/team/${teamId}`, {
        params: { includeDeleted: includeDeleted.toString() }
    });
    return res.json();
}

export async function apiGetRetroBoardSummary(roomId: string): Promise<RetroBoardSummaryResponse> {
    const res = await fetchApi(`/api/retroboards/room/${roomId}/summary`);
    return res.json();
}

export async function apiGetRetroBoardTitlesByIds(
    boardIds: string[]
): Promise<BoardTitlesResponse> {
    const res = await fetchApi(`/api/retroboards/by-ids`, {
        params: { boardIds: boardIds.join(',') }
    });
    return res.json();
}

export async function apiCreateRetroBoard(
    roomId: string,
    title: string,
    isPrivate: boolean = false,
    passwordHash?: string | null,
    teamId?: string | null
): Promise<RetroBoardItem> {
    const res = await fetchApi(`/api/retroboards`, {
        method: 'POST',
        body: JSON.stringify({ roomId, title, isPrivate, passwordHash, teamId })
    });
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
    await fetchApi(`/api/retroboards/${boardId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
    });
}

export async function apiDeleteRetroBoard(boardId: string): Promise<void> {
    await fetchApi(`/api/retroboards/${boardId}`, {
        method: 'DELETE'
    });
}
