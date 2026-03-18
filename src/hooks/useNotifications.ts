import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

export type UseNotificationsOptions = {
  page?: number;
  pageSize?: number;
};

export const useNotifications = (options?: UseNotificationsOptions) => {
  const { user, profile, isImpersonating } = useAuth();
  const page = options?.page && options.page > 0 ? options.page : 1;
  const pageSize = options?.pageSize && options.pageSize > 0 ? options.pageSize : 50;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const unreadCountRefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2));

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    const targetUserId = isImpersonating ? profile?.id ?? user.id : user.id;
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetUserId)
      .eq('is_read', false);

    if (!error && typeof count === 'number') {
      setUnreadCount(count);
    }
  }, [user, isImpersonating, profile?.id]);

  const scheduleUnreadCountRefetch = useCallback(() => {
    if (unreadCountRefetchTimer.current) {
      clearTimeout(unreadCountRefetchTimer.current);
    }
    unreadCountRefetchTimer.current = setTimeout(() => {
      void fetchUnreadCount();
    }, 200);
  }, [fetchUnreadCount]);

  const emitNotificationsChanged = useCallback((detail: {
    notificationId?: string;
    unreadDelta?: number;
    markAsRead?: boolean;
    deleted?: boolean;
  }) => {
    if (typeof window === 'undefined' || !user) return;
    const targetUserId = isImpersonating ? profile?.id ?? user.id : user.id;
    window.dispatchEvent(
      new CustomEvent('notifications:changed', {
        detail: {
          userId: targetUserId,
          source: instanceIdRef.current,
          ...detail,
        },
      }),
    );
  }, [user, isImpersonating, profile?.id]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const targetUserId = isImpersonating ? profile?.id ?? user.id : user.id;
    setLoading(true);
    setError(null);
    const rangeStart = (page - 1) * pageSize;
    const rangeEnd = rangeStart + pageSize - 1;
    const { data, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .range(rangeStart, rangeEnd);
    if (error) {
      setError(error.message);
    } else {
      setNotifications((data as AppNotification[]) || []);
      setTotalCount(typeof count === 'number' ? count : null);
    }
    setLoading(false);
  }, [user, isImpersonating, profile?.id, page, pageSize]);

  const totalPages = useMemo(() => {
    if (typeof totalCount !== 'number') return null;
    return Math.max(1, Math.ceil(totalCount / pageSize));
  }, [totalCount, pageSize]);

  const markAsRead = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (!error) {
      let unreadDelta = 0;
      setNotifications(prev => {
        const existing = prev.find((n) => n.id === id);
        if (existing && !existing.is_read) {
          unreadDelta = -1;
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.map(n => (n.id === id ? { ...n, is_read: true } : n));
      });
      emitNotificationsChanged({ notificationId: id, unreadDelta, markAsRead: true });
    }
  }, [emitNotificationsChanged]);

  const deleteNotification = useCallback(async (id: string) => {
    setError(null);
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      setError(error.message);
      return;
    }

    // Optimistic UI update; realtime subscription will also reconcile.
    let unreadDelta = 0;
    setNotifications(prev => {
      const existing = prev.find((n) => n.id === id);
      if (existing && !existing.is_read) {
        unreadDelta = -1;
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      return prev.filter(n => n.id !== id);
    });
    emitNotificationsChanged({ notificationId: id, unreadDelta, deleted: true });
  }, [emitNotificationsChanged]);

  useEffect(() => {
    if (!user) return;
    const targetUserId = isImpersonating && profile ? profile.id : user.id;

    const onNotificationsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{
        userId?: string;
        source?: string;
        notificationId?: string;
        unreadDelta?: number;
        markAsRead?: boolean;
        deleted?: boolean;
      }>).detail;

      if (!detail?.userId || detail.userId !== targetUserId) return;
      if (detail.source === instanceIdRef.current) return;

      if (typeof detail.unreadDelta === 'number' && detail.unreadDelta !== 0) {
        setUnreadCount((c) => Math.max(0, c + detail.unreadDelta));
      } else {
        scheduleUnreadCountRefetch();
      }

      if (detail.notificationId && detail.markAsRead) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === detail.notificationId ? { ...n, is_read: true } : n)),
        );
      }

      if (detail.notificationId && detail.deleted) {
        setNotifications((prev) => prev.filter((n) => n.id !== detail.notificationId));
      }
    };

    window.addEventListener('notifications:changed', onNotificationsChanged);

    void fetchNotifications();
    void fetchUnreadCount();

    const channel = supabase
      .channel('realtime:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${targetUserId}` }, payload => {
        const shouldUseInPlaceRealtimeUpdates = page === 1 && pageSize === 50;

        // For bell-style views (first 50), we can adjust unread count based on whether
        // the changed notification is currently present in the loaded slice.
        if (payload.eventType === 'UPDATE' && shouldUseInPlaceRealtimeUpdates) {
          const updated = payload.new as Partial<AppNotification> & { id?: string };
          const updatedId = updated?.id;
          const updatedIsRead = updated && typeof updated.is_read === 'boolean' ? updated.is_read : null;

          if (updatedId && updatedIsRead !== null) {
            setNotifications(prev => {
              const existing = prev.find((n) => n.id === updatedId);
              if (existing && existing.is_read === false && updatedIsRead === true) {
                setUnreadCount((c) => Math.max(0, c - 1));
              }
              return prev.map((n) => (n.id === updatedId ? (updated as AppNotification) : n));
            });
            return;
          }
          // Fallback if payload doesn't include is_read.
          void fetchUnreadCount();
        }

        if (payload.eventType === 'DELETE' && shouldUseInPlaceRealtimeUpdates) {
          const deleted = payload.old as Partial<AppNotification> & { id?: string };
          const deletedId = deleted?.id;

          if (deletedId) {
            setNotifications(prev => {
              const existing = prev.find((n) => n.id === deletedId);
              if (existing && existing.is_read === false) {
                setUnreadCount((c) => Math.max(0, c - 1));
              }
              return prev.filter((n) => n.id !== deletedId);
            });
            return;
          }
          void fetchUnreadCount();
        }

        // Keep unread count accurate for paginated views (or if we couldn't derive it optimistically).
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
          void fetchUnreadCount();
        }

        if (!shouldUseInPlaceRealtimeUpdates) {
          // For paginated views, in-place updates are error-prone. Refetch the current page.
          void fetchNotifications();
          return;
        }

        if (payload.eventType === 'INSERT') {
          setNotifications(prev => [payload.new as AppNotification, ...prev].slice(0, 50));
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Partial<AppNotification> & { id?: string };
          setNotifications(prev =>
            prev.map(n => (n.id === updated?.id ? (updated as AppNotification) : n)),
          );
        } else if (payload.eventType === 'DELETE') {
          const deleted = payload.old as Partial<AppNotification> & { id?: string };
          setNotifications(prev => prev.filter(n => n.id !== deleted?.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('notifications:changed', onNotificationsChanged);
    };
  }, [
    user,
    isImpersonating,
    profile?.id,
    fetchNotifications,
    fetchUnreadCount,
    scheduleUnreadCountRefetch,
    page,
    pageSize,
  ]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    deleteNotification,
    totalCount,
    totalPages,
    page,
    pageSize,
  };
};


