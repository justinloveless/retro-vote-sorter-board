import { getApiBaseUrl } from '@/config/environment';
import { getSupabaseAccessToken } from '@/lib/data/csharpApi/utils';

export type RetroItemItem = {
    id: string;
    boardId?: string | null;
    columnId?: string | null;
    text: string;
    author: string;
    authorId?: string | null;
    votes?: number | null;
    sessionId?: string | null;
    createdAt?: string;
    updatedAt?: string;
};

export type RetroItemsResponse = {
    items: RetroItemItem[];
};

export async function apiGetRetroItems(boardId: string): Promise<RetroItemsResponse> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/retroboards/${encodeURIComponent(boardId)}/items`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

export async function apiCreateRetroItem(
    boardId: string,
    columnId: string,
    text: string,
    author: string,
    authorId?: string,
    sessionId?: string
): Promise<RetroItemItem> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/retroboards/items`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, columnId, text, author, authorId, sessionId })
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

export async function apiUpdateRetroItem(
    itemId: string,
    updates: {
        columnId?: string;
        text?: string;
    }
): Promise<void> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/retroboards/items/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
}

export async function apiDeleteRetroItem(itemId: string): Promise<void> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/retroboards/items/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
}
