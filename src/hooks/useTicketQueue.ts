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
      .from('poker_ticket_queue' as any)
      .select('*')
      .eq('team_id', teamId)
      .order('position', { ascending: true });
    
    if (!error && data) {
      setQueue(data as unknown as TicketQueueItem[]);
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
    
    await supabase
      .from('poker_ticket_queue' as any)
      .insert({
        team_id: teamId,
        ticket_key: ticketKey,
        ticket_summary: ticketSummary,
        position: maxPosition,
        added_by: userData.user?.id || null,
      } as any);
  }, [teamId, queue]);

  const removeTicket = useCallback(async (id: string) => {
    await supabase
      .from('poker_ticket_queue' as any)
      .delete()
      .eq('id', id);
  }, []);

  const reorderQueue = useCallback(async (reorderedItems: TicketQueueItem[]) => {
    // Optimistic update
    setQueue(reorderedItems);
    
    // Batch update positions
    const updates = reorderedItems.map((item, index) =>
      supabase
        .from('poker_ticket_queue' as any)
        .update({ position: index } as any)
        .eq('id', item.id)
    );
    await Promise.all(updates);
  }, []);

  const popNext = useCallback(async (): Promise<TicketQueueItem | null> => {
    if (queue.length === 0) return null;
    const next = queue[0];
    await removeTicket(next.id);
    return next;
  }, [queue, removeTicket]);

  const clearQueue = useCallback(async () => {
    if (!teamId) return;
    await supabase
      .from('poker_ticket_queue' as any)
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
