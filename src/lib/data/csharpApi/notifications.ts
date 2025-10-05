import { getApiBaseUrl } from '@/config/environment';
import { getSupabaseAccessToken } from '@/lib/data/csharpApi/utils';

export async function apiGetNotifications(limit = 50): Promise<{ items: Array<any> }> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const url = `${base}/api/notifications?limit=${limit}`;

    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API error ${res.status}: ${errorText}`);
    }

    return res.json();
}

export async function apiMarkNotificationRead(notificationId: string): Promise<{ success: boolean; message: string }> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const url = `${base}/api/notifications/${notificationId}`;

    const res = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true })
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API error ${res.status}: ${errorText}`);
    }

    return res.json();
}

export async function apiMarkAllNotificationsRead(): Promise<{ success: boolean; updated_count: number; message: string }> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/notifications/mark-all-read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true })
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

export async function apiAdminSendNotification(payload: {
    recipients: Array<{ userId?: string; email?: string }>;
    type: string;
    title: string;
    message?: string;
    url?: string;
}): Promise<{ success: boolean; count?: number; info?: string }> {
    const base = getApiBaseUrl();
    const token = await getSupabaseAccessToken();
    const res = await fetch(`${base}/api/admin/notifications`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}
