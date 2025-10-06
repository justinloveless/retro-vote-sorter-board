import { fetchApi } from '@/lib/data/csharpApi/utils';

export type RetroColumnItem = {
    id: string;
    boardId?: string | null;
    title: string;
    color: string;
    position: number;
    sortOrder?: number | null;
    isActionItems?: boolean | null;
    createdAt?: string;
};

export type RetroColumnsResponse = {
    items: RetroColumnItem[];
};

export async function apiGetRetroColumns(boardId: string): Promise<RetroColumnsResponse> {
    const res = await fetchApi(`/api/retroboards/${boardId}/columns`);
    return res.json();
}

export async function apiCreateRetroColumn(
    boardId: string,
    title: string,
    color: string,
    position: number,
    isActionItems?: boolean,
    sortOrder?: number
): Promise<RetroColumnItem> {
    const res = await fetchApi(`/api/retroboards/columns`, {
        method: 'POST',
        body: JSON.stringify({ boardId, title, color, position, isActionItems, sortOrder })
    });
    return res.json();
}

export async function apiUpdateRetroColumn(
    columnId: string,
    updates: {
        title?: string;
        color?: string;
        position?: number;
        sortOrder?: number;
        isActionItems?: boolean;
    }
): Promise<void> {
    await fetchApi(`/api/retroboards/columns/${columnId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
    });
}

export async function apiDeleteRetroColumn(columnId: string): Promise<void> {
    await fetchApi(`/api/retroboards/columns/${columnId}`, {
        method: 'DELETE'
    });
}

export async function apiUpdateRetroColumnsBatch(
    updates: Array<{
        id: string;
        title?: string;
        color?: string;
        position?: number;
        sortOrder?: number;
        isActionItems?: boolean;
    }>
): Promise<void> {
    await fetchApi(`/api/retroboards/columns/batch`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
    });
}
