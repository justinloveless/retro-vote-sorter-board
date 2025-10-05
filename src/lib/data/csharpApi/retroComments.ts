import { getApiBaseUrl } from '@/config/environment';
import { getSupabaseAccessToken } from '@/lib/data/csharpApi/utils';

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
