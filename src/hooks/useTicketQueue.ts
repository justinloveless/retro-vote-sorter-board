import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TicketQueueItem {
  id: string;
  team_id: string;
  ticket_key: string;
  ticket_summary: string | null;
  position: number;
  added_by: string | null;
  created_at: string;
}

export function useTicketQueue(teamId: string | undefined) {
  const [queue, setQueue] = useState<TicketQueueItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchQueue = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('poker_ticket_queue')
      .select('*')
      .eq('team_id', teamId)
      .order('position', { ascending: true });
    
    if (!error && data) {
      setQueue(data as TicketQueueItem[]);
    }
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Realtime subscription
  useEffect(() => {
    if (!teamId) return;

    const channel = supabase
      .channel(`ticket-queue-${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poker_ticket_queue',
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, fetchQueue]);

  const addTicket = useCallback(async (ticketKey: string, ticketSummary: string | null) => {
    if (!teamId) return;
    const maxPosition = queue.length > 0 ? Math.max(...queue.map(q => q.position)) + 1 : 0;
    const { data: userData } = await supabase.auth.getUser();
    
    // Optimistic update
    const optimisticItem: TicketQueueItem = {
      id: crypto.randomUUID(),
      team_id: teamId,
      ticket_key: ticketKey,
      ticket_summary: ticketSummary,
      position: maxPosition,
      added_by: userData.user?.id || null,
      created_at: new Date().toISOString(),
    };
    setQueue(prev => [...prev, optimisticItem]);

    await supabase
      .from('poker_ticket_queue')
      .insert({
        team_id: teamId,
        ticket_key: ticketKey,
        ticket_summary: ticketSummary,
        position: maxPosition,
        added_by: userData.user?.id || null,
      });
  }, [teamId, queue]);

  const removeTicket = useCallback(async (id: string) => {
    // Optimistic update
    setQueue(prev => prev.filter(item => item.id !== id));
    
    await supabase
      .from('poker_ticket_queue')
      .delete()
      .eq('id', id);
  }, []);

  const reorderQueue = useCallback(async (reorderedItems: TicketQueueItem[]) => {
    // Optimistic update
    setQueue(reorderedItems);
    
    // Batch update positions
    const updates = reorderedItems.map((item, index) =>
      supabase
        .from('poker_ticket_queue')
        .update({ position: index })
        .eq('id', item.id)
    );
    await Promise.all(updates);
  }, []);

  const popNext = useCallback(async (): Promise<TicketQueueItem | null> => {
    if (queue.length === 0) return null;
    const next = queue[0];
    // Optimistic update
    setQueue(prev => prev.slice(1));
    await supabase
      .from('poker_ticket_queue')
      .delete()
      .eq('id', next.id);
    return next;
  }, [queue]);

  const clearQueue = useCallback(async () => {
    if (!teamId) return;
    // Optimistic update
    setQueue([]);
    await supabase
      .from('poker_ticket_queue')
      .delete()
      .eq('team_id', teamId);
  }, [teamId]);

  return {
    queue,
    loading,
    addTicket,
    removeTicket,
    reorderQueue,
    popNext,
    clearQueue,
    refetch: fetchQueue,
  };
}
