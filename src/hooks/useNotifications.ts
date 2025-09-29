import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { shouldUseCSharpApi } from '@/config/environment';
import { fetchNotifications as dcFetchNotifications, markNotificationRead as dcMarkRead, markAllNotificationsRead as dcMarkAllRead } from '@/lib/dataClient';

export type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  url: string | null;
  is_read: boolean;
  created_at: string;
};

export const useNotifications = () => {
  const { user, profile, isImpersonating } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  const lastFetchRef = useRef<number>(0);

  const fetchNotifications = useCallback(async (force = false) => {
    if (!user) return;
    const targetUserId = isImpersonating && profile ? profile.id : user.id;

    // Avoid redundant refetches (e.g., tab refocus) unless forced or stale
    const now = Date.now();
    const STALE_MS = 30_000; // 30s freshness window
    if (!force && now - lastFetchRef.current < STALE_MS) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const list = await dcFetchNotifications(50);
      setNotifications(list);
    } catch (err) {
      console.error('🔔 fetchNotifications error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    }

    setLoading(false);
    lastFetchRef.current = Date.now();
  }, [user, isImpersonating, profile?.id]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await dcMarkRead(id);

      // Update local state on success
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark notification as read');
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await dcMarkAllRead();

      // Update local state on success - mark all unread notifications as read
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark all notifications as read');
    }
  }, [user, isImpersonating, profile?.id]);

  useEffect(() => {
    if (!user) return;
    const targetUserId = isImpersonating && profile ? profile.id : user.id;
    fetchNotifications();

    // Only set up realtime subscriptions when using direct Supabase
    // TODO: Implement realtime support in C# API (Phase 9)
    if (!shouldUseCSharpApi()) {
      const channel = supabase
        .channel('realtime:notifications')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${targetUserId}` }, payload => {
          if (payload.eventType === 'INSERT') {
            setNotifications(prev => [payload.new as AppNotification, ...prev].slice(0, 50));
          } else if (payload.eventType === 'UPDATE') {
            setNotifications(prev => prev.map(n => (n.id === (payload.new as any).id ? (payload.new as AppNotification) : n)));
          } else if (payload.eventType === 'DELETE') {
            setNotifications(prev => prev.filter(n => n.id !== (payload.old as any).id));
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, isImpersonating, profile?.id, fetchNotifications]);

  return { notifications, unreadCount, loading, error, fetchNotifications, markAsRead, markAllAsRead };
};


