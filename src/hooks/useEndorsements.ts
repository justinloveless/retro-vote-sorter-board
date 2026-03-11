import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Endorsement {
  id: string;
  board_id: string;
  team_id: string;
  endorsement_type_id: string;
  from_user_id: string;
  to_user_id: string;
  created_at: string;
}

export function useEndorsements(boardId: string | null, teamId: string | null) {
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [pendingCelebration, setPendingCelebration] = useState<Endorsement | null>(null);

  // Use impersonated profile id when impersonating, otherwise real user id
  const effectiveUserId = profile?.id || user?.id;

  const fetchEndorsements = useCallback(async () => {
    if (!boardId || !teamId) return;
    try {
      const { data, error } = await supabase
        .from('endorsements')
        .select('*')
        .eq('board_id', boardId)
        .eq('team_id', teamId);
      if (error) throw error;
      setEndorsements((data as unknown as Endorsement[]) || []);
    } catch (e) {
      console.error('Error fetching endorsements:', e);
    } finally {
      setLoading(false);
    }
  }, [boardId, teamId]);

  useEffect(() => {
    fetchEndorsements();
  }, [fetchEndorsements]);

  // Realtime subscription for new endorsements
  useEffect(() => {
    if (!boardId || !teamId || !effectiveUserId) return;

    const channel = supabase
      .channel(`endorsements-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'endorsements',
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          const newEndorsement = payload.new as Endorsement;
          setEndorsements(prev => [...prev, newEndorsement]);
          // Trigger celebration if the effective user received the endorsement
          if (newEndorsement.to_user_id === effectiveUserId) {
            setPendingCelebration(newEndorsement);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'endorsements',
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          const deleted = payload.old as Endorsement;
          setEndorsements(prev => prev.filter(e => e.id !== deleted.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, teamId, effectiveUserId]);

  const giveEndorsement = useCallback(async (toUserId: string, endorsementTypeId: string) => {
    if (!boardId || !teamId || !effectiveUserId) return;
    const { error } = await supabase
      .from('endorsements')
      .insert({
        board_id: boardId,
        team_id: teamId,
        endorsement_type_id: endorsementTypeId,
        from_user_id: effectiveUserId,
        to_user_id: toUserId,
      } as any);
    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Already endorsed', description: 'You already gave this endorsement to this person.', variant: 'destructive' });
      } else {
        toast({ title: 'Error giving endorsement', variant: 'destructive' });
      }
      return;
    }
    // Realtime will update the list
  }, [boardId, teamId, user, toast]);

  const revokeEndorsement = useCallback(async (endorsementId: string) => {
    // Optimistic update
    setEndorsements(prev => prev.filter(e => e.id !== endorsementId));
    const { error } = await supabase
      .from('endorsements')
      .delete()
      .eq('id', endorsementId);
    if (error) {
      toast({ title: 'Error revoking endorsement', variant: 'destructive' });
      // Revert on error
      fetchEndorsements();
    }
  }, [toast, fetchEndorsements]);

  const clearCelebration = useCallback(() => {
    setPendingCelebration(null);
  }, []);

  const getMyEndorsementCount = useCallback(() => {
    if (!user) return 0;
    return endorsements.filter(e => e.from_user_id === user.id).length;
  }, [endorsements, user]);

  return {
    endorsements,
    loading,
    giveEndorsement,
    revokeEndorsement,
    pendingCelebration,
    clearCelebration,
    getMyEndorsementCount,
    refetch: fetchEndorsements,
  };
}
