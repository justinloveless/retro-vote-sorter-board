import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { shouldUseCSharpApi } from '@/config/environment';
import { apiGetNotifications } from '@/lib/apiClient';

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

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const targetUserId = isImpersonating && profile ? profile.id : user.id;
    setLoading(true);
    setError(null);

    try {
      if (shouldUseCSharpApi()) {
        // Use C# API passthrough
        const response = await apiGetNotifications(50);
        setNotifications(response.items as AppNotification[]);
      } else {
        // Use direct Supabase
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) {
          setError(error.message);
        } else {
          setNotifications((data as AppNotification[]) || []);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    }
    
    setLoading(false);
  }, [user, isImpersonating, profile?.id]);

  const markAsRead = useCallback(async (id: string) => {
    // TODO: Migrate to C# API when mark-as-read endpoint is implemented (Phase 2)
    // For now, always use direct Supabase for mark-as-read operations
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (!error) {
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
    }
  }, []);

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

  return { notifications, unreadCount, loading, error, fetchNotifications, markAsRead };
};


