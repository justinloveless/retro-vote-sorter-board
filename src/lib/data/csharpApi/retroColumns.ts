import { getApiBaseUrl } from '@/config/environment';
import { getSupabaseAccessToken } from '@/lib/data/csharpApi/utils';

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
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/retroboards/${encodeURIComponent(boardId)}/columns`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
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
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/retroboards/columns`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, title, color, position, isActionItems, sortOrder })
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
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
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/retroboards/columns/${encodeURIComponent(columnId)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
}

export async function apiDeleteRetroColumn(columnId: string): Promise<void> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/retroboards/columns/${encodeURIComponent(columnId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
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
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/retroboards/columns/batch`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
}
