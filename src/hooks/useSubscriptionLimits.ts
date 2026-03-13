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

export function useSubscriptionLimits() {
  const { tier, loading } = useSubscription();
  const limits = LIMITS[tier];

  const checkTeamLimit = useCallback(async (userId: string): Promise<{ allowed: boolean; current: number; max: number }> => {
    const max = LIMITS[tier].maxTeams;
    if (max === Infinity) return { allowed: true, current: 0, max };

    const { count, error } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'owner');

    const current = error ? 0 : (count ?? 0);
    return { allowed: current < max, current, max };
  }, [tier]);

  const checkBoardLimit = useCallback(async (teamId: string): Promise<{ allowed: boolean; current: number; max: number }> => {
    const max = LIMITS[tier].maxActiveBoards;
    if (max === Infinity) return { allowed: true, current: 0, max };

    const { count, error } = await supabase
      .from('retro_boards')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .neq('deleted', true)
      .neq('archived', true);

    const current = error ? 0 : (count ?? 0);
    return { allowed: current < max, current, max };
  }, [tier]);

  const checkMemberLimit = useCallback(async (teamId: string): Promise<{ allowed: boolean; current: number; max: number }> => {
    const max = LIMITS[tier].maxMembersPerTeam;
    if (max === Infinity) return { allowed: true, current: 0, max };

    const { count, error } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);

    const current = error ? 0 : (count ?? 0);
    return { allowed: current < max, current, max };
  }, [tier]);

  return {
    tier,
    limits,
    loading,
    checkTeamLimit,
    checkBoardLimit,
    checkMemberLimit,
  };
}
