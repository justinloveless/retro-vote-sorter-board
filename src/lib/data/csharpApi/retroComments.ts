import { fetchApi } from '@/lib/data/csharpApi/utils';

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
    const res = await fetchApi(`/api/retro-comments/by-items`, {
        method: 'GET',
        params: { itemIds: itemIds.join(',') }
    });
    return res.json();
}

export async function apiGetCommentsByItemId(
    itemId: string
): Promise<RetroCommentsResponse> {
    const res = await fetchApi(`/api/retro-comments/by-item/${itemId}`, {
        method: 'GET'
    });
    return res.json();
}

export async function apiCreateComment(
    itemId: string,
    text: string,
    author: string,
    authorId?: string | null,
    sessionId?: string | null
): Promise<RetroCommentItem> {
    const res = await fetchApi(`/api/retro-comments`, {
        method: 'POST',
        body: JSON.stringify({ itemId, text, author, authorId, sessionId })
    });
    return res.json();
}

export async function apiDeleteComment(
    commentId: string
): Promise<void> {
    await fetchApi(`/api/retro-comments/${commentId}`, {
        method: 'DELETE'
    });
}
