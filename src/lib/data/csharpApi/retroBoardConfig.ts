import { fetchApi } from '@/lib/data/csharpApi/utils';

export type RetroBoardConfigItem = {
    id: string;
    boardId: string;
    allowAnonymous?: boolean | null;
    votingEnabled?: boolean | null;
    maxVotesPerUser?: number | null;
    showAuthorNames?: boolean | null;
    retroStagesEnabled?: boolean | null;
    enforceStageReadiness?: boolean | null;
    allowSelfVotes?: boolean | null;
    voteEmoji?: string | null;
    createdAt: string;
    updatedAt: string;
};

export type RetroBoardConfigResponse = {
    config: RetroBoardConfigItem;
};

export async function apiGetRetroBoardConfig(boardId: string): Promise<RetroBoardConfigResponse> {
    const res = await fetchApi(`/api/retroboards/${boardId}/config`);
    return res.json();
}

export async function apiCreateRetroBoardConfig(
    boardId: string,
    config: {
        allowAnonymous?: boolean;
        votingEnabled?: boolean;
        maxVotesPerUser?: number;
        showAuthorNames?: boolean;
        retroStagesEnabled?: boolean;
        enforceStageReadiness?: boolean;
        allowSelfVotes?: boolean;
        voteEmoji?: string;
    }
): Promise<RetroBoardConfigItem> {
    const res = await fetchApi(`/api/retroboards/config`, {
        method: 'POST',
        body: JSON.stringify({ boardId, ...config })
    });
    return res.json();
}

export async function apiUpdateRetroBoardConfig(
    boardId: string,
    updates: {
        allowAnonymous?: boolean;
        votingEnabled?: boolean;
        maxVotesPerUser?: number;
        showAuthorNames?: boolean;
        retroStagesEnabled?: boolean;
        enforceStageReadiness?: boolean;
        allowSelfVotes?: boolean;
        voteEmoji?: string;
    }
): Promise<void> {
    await fetchApi(`/api/retroboards/${boardId}/config`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
    });
}
