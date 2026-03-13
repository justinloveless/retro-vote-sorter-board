import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription, SubscriptionTier } from './useSubscription';

export interface TierLimits {
  maxTeams: number;
  maxMembersPerTeam: number;
  maxActiveBoards: number;
}

const LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: { maxTeams: 1, maxMembersPerTeam: 5, maxActiveBoards: 3 },
  pro: { maxTeams: 5, maxMembersPerTeam: 25, maxActiveBoards: Infinity },
  business: { maxTeams: Infinity, maxMembersPerTeam: Infinity, maxActiveBoards: Infinity },
};

/** Fetch the current subscription tier directly from the edge function */
async function fetchCurrentTier(): Promise<SubscriptionTier> {
  try {
    const { data, error } = await supabase.functions.invoke('check-subscription');
    if (error) {
      console.error('Error fetching subscription tier for limit check:', error);
      return 'free';
    }
    return (data?.tier as SubscriptionTier) || 'free';
  } catch {
    return 'free';
  }
}

export function useSubscriptionLimits() {
  const { tier, loading } = useSubscription();
  const limits = LIMITS[tier];

  const checkTeamLimit = useCallback(async (userId: string): Promise<{ allowed: boolean; current: number; max: number; tier: SubscriptionTier }> => {
    const currentTier = await fetchCurrentTier();
    const max = LIMITS[currentTier].maxTeams;
    if (max === Infinity) return { allowed: true, current: 0, max, tier: currentTier };

    const { count, error } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'owner');

    const current = error ? 0 : (count ?? 0);
    return { allowed: current < max, current, max, tier: currentTier };
  }, []);

  const checkBoardLimit = useCallback(async (teamId: string): Promise<{ allowed: boolean; current: number; max: number; tier: SubscriptionTier }> => {
    const currentTier = await fetchCurrentTier();
    const max = LIMITS[currentTier].maxActiveBoards;
    if (max === Infinity) return { allowed: true, current: 0, max, tier: currentTier };

    const { data, error } = await supabase
      .from('retro_boards')
      .select('id, archived, deleted')
      .eq('team_id', teamId);

    const current = error
      ? 0
      : (data ?? []).filter((board) => board.deleted !== true && board.archived !== true).length;

    return { allowed: current < max, current, max, tier: currentTier };
  }, []);

  const checkMemberLimit = useCallback(async (teamId: string): Promise<{ allowed: boolean; current: number; max: number; tier: SubscriptionTier }> => {
    const currentTier = await fetchCurrentTier();
    const max = LIMITS[currentTier].maxMembersPerTeam;
    if (max === Infinity) return { allowed: true, current: 0, max, tier: currentTier };

    const [membersResult, pendingInvitesResult] = await Promise.all([
      supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId),
      supabase
        .from('team_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('invite_type', 'email')
        .eq('status', 'pending')
        .eq('is_active', true),
    ]);

    const memberCount = membersResult.error ? 0 : (membersResult.count ?? 0);
    const pendingInviteCount = pendingInvitesResult.error ? 0 : (pendingInvitesResult.count ?? 0);
    const current = memberCount + pendingInviteCount;

    return { allowed: current < max, current, max, tier: currentTier };
  }, []);

  return {
    tier,
    limits,
    loading,
    checkTeamLimit,
    checkBoardLimit,
    checkMemberLimit,
  };
}
