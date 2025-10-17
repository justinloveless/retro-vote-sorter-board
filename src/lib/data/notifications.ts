import { AppNotification } from './types';
import { getAuthUser } from '@/lib/data/auth';
import { client } from './dataClient.ts';

export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
    const currentUser = (await getAuthUser()).data.user;
    if (!currentUser) return [];
    const { data, error } = await client
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return (data as AppNotification[]) || [];
}

export async function markNotificationRead(id: string): Promise<void> {
    // if (shouldUseCSharpApi()) {
    //     await apiMarkNotificationRead(id);
    //     return;
    // }
    const { error } = await client
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
    if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
    // if (shouldUseCSharpApi()) {
    //     await apiMarkAllNotificationsRead();
    //     return;
    // }
    const currentUser = (await getAuthUser()).data.user;
    if (!currentUser) return;
    const { error } = await client
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false);
    if (error) throw error;
}

export async function adminSendNotification(payload: {
    recipients: Array<{ userId?: string; email?: string }>;
    type: string;
    title: string;
    message?: string;
    url?: string;
}): Promise<{ success: boolean; count?: number; info?: string }> {
    // if (shouldUseCSharpApi()) {
    //     return apiAdminSendNotification(payload);
    // }
    const { error } = await client.functions.invoke('admin-send-notification', { body: payload });
    if (error) throw error;
    return { success: true };
}
