import { fetchApi } from '@/lib/data/csharpApi/utils';

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
    const res = await fetchApi(`/api/retroboards/${boardId}/items`);
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
    const res = await fetchApi(`/api/retroboards/items`, {
        method: 'POST',
        body: JSON.stringify({ boardId, columnId, text, author, authorId, sessionId })
    });
    return res.json();
}

export async function apiUpdateRetroItem(
    itemId: string,
    updates: {
        columnId?: string;
        text?: string;
    }
): Promise<void> {
    await fetchApi(`/api/retroboards/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
    });
}

export async function apiDeleteRetroItem(itemId: string): Promise<void> {
    await fetchApi(`/api/retroboards/items/${itemId}`, {
        method: 'DELETE'
    });
}
