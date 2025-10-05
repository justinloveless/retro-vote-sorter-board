import { getApiBaseUrl } from '@/config/environment';
import { getSupabaseAccessToken } from '@/lib/data/csharpApi/utils';

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
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/retroboards/${encodeURIComponent(boardId)}/config`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
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
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/retroboards/config`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, ...config })
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
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
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/retroboards/${encodeURIComponent(boardId)}/config`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
}
