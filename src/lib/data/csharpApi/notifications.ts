import { fetchApi } from '@/lib/data/csharpApi/utils';

export async function apiGetNotifications(limit = 50): Promise<{ items: Array<any> }> {
    const res = await fetchApi(`/api/notifications?limit=${limit}`);
    return res.json();
}

export async function apiMarkNotificationRead(notificationId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchApi(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_read: true })
    });
    return res.json();
}

export async function apiMarkAllNotificationsRead(): Promise<{ success: boolean; updated_count: number; message: string }> {
    const res = await fetchApi(`/api/notifications/mark-all-read`, {
        method: 'POST',
        body: JSON.stringify({ is_read: true })
    });
    return res.json();
}

export async function apiAdminSendNotification(payload: {
    recipients: Array<{ userId?: string; email?: string }>;
    type: string;
    title: string;
    message?: string;
    url?: string;
}): Promise<{ success: boolean; count?: number; info?: string }> {
    const res = await fetchApi(`/api/admin/notifications`, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    return res.json();
}
