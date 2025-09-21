import { useCallback, useEffect, useMemo, useState } from 'react';
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

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      setError(error.message);
    } else {
      setNotifications((data as AppNotification[]) || []);
    }
    setLoading(false);
  }, [user]);

  const markAsRead = useCallback(async (id: string) => {
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
    fetchNotifications();

    const channel = supabase
      .channel('realtime:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, payload => {
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
  }, [user, fetchNotifications]);

  return { notifications, unreadCount, loading, error, fetchNotifications, markAsRead };
};


