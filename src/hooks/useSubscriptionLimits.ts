import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useSubscription, SubscriptionTier } from './useSubscription';

export interface TierLimits {
  maxTeams: number;
  maxMembersPerTeam: number;
  maxActiveBoards: number;
}

const DEFAULT_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: { maxTeams: 1, maxMembersPerTeam: 5, maxActiveBoards: 3 },
  pro: { maxTeams: 5, maxMembersPerTeam: 25, maxActiveBoards: Infinity },
  business: { maxTeams: Infinity, maxMembersPerTeam: Infinity, maxActiveBoards: Infinity },
};

/** Fetch the current subscription tier directly from the edge function */
async function fetchCurrentTier(targetUserId?: string): Promise<SubscriptionTier> {
  try {
    const { data, error } = await supabase.functions.invoke('check-subscription', {
      body: targetUserId ? { target_user_id: targetUserId } : {},
    });
    if (error) {
      console.error('Error fetching subscription tier for limit check:', error);
      return 'free';
    }
    return (data?.tier as SubscriptionTier) || 'free';
  } catch {
    return 'free';
  }
}

/** Load dynamic tier limits from app_config, falling back to defaults */
async function loadDynamicLimits(): Promise<Record<SubscriptionTier, TierLimits>> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'tier_limits')
      .maybeSingle();
    if (error || !data?.value) return DEFAULT_LIMITS;
    const parsed = JSON.parse(data.value);
    return {
      free: {
        maxTeams: parsed.free?.maxTeams ?? DEFAULT_LIMITS.free.maxTeams,
        maxMembersPerTeam: parsed.free?.maxMembersPerTeam ?? DEFAULT_LIMITS.free.maxMembersPerTeam,
        maxActiveBoards: parsed.free?.maxActiveBoards ?? DEFAULT_LIMITS.free.maxActiveBoards,
      },
      pro: {
        maxTeams: parsed.pro?.maxTeams ?? Infinity,
        maxMembersPerTeam: parsed.pro?.maxMembersPerTeam ?? Infinity,
        maxActiveBoards: parsed.pro?.maxActiveBoards ?? Infinity,
      },
      business: {
        maxTeams: parsed.business?.maxTeams ?? Infinity,
        maxMembersPerTeam: parsed.business?.maxMembersPerTeam ?? Infinity,
        maxActiveBoards: parsed.business?.maxActiveBoards ?? Infinity,
      },
    };
  } catch {
    return DEFAULT_LIMITS;
  }
}

// Convert null (unlimited in DB) to Infinity for runtime checks
function normalizeLimit(val: number | null | undefined, fallback: number): number {
  if (val === null || val === undefined || val === 0) return Infinity;
  return val;
}

export function useSubscriptionLimits() {
  const { tier, loading } = useSubscription();
  const { profile, isImpersonating } = useAuth();
  const targetUserId = isImpersonating && profile?.id ? profile.id : undefined;
  const [allLimits, setAllLimits] = useState<Record<SubscriptionTier, TierLimits>>(DEFAULT_LIMITS);

  useEffect(() => {
    loadDynamicLimits().then(setAllLimits);
  }, []);

  const limits = allLimits[tier];

  const checkTeamLimit = useCallback(async (userId: string): Promise<{ allowed: boolean; current: number; max: number; tier: SubscriptionTier }> => {
    const [currentTier, dynamicLimits] = await Promise.all([fetchCurrentTier(targetUserId), loadDynamicLimits()]);
    const max = normalizeLimit(dynamicLimits[currentTier]?.maxTeams, DEFAULT_LIMITS[currentTier].maxTeams);
    if (max === Infinity) return { allowed: true, current: 0, max, tier: currentTier };

    const { count, error } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'owner');

    const current = error ? 0 : (count ?? 0);
    return { allowed: current < max, current, max, tier: currentTier };
  }, [targetUserId]);

  const checkBoardLimit = useCallback(async (teamId: string): Promise<{ allowed: boolean; current: number; max: number; tier: SubscriptionTier }> => {
    const [currentTier, dynamicLimits] = await Promise.all([fetchCurrentTier(targetUserId), loadDynamicLimits()]);
    const max = normalizeLimit(dynamicLimits[currentTier]?.maxActiveBoards, DEFAULT_LIMITS[currentTier].maxActiveBoards);
    if (max === Infinity) return { allowed: true, current: 0, max, tier: currentTier };

    const { data, error } = await supabase
      .from('retro_boards')
      .select('id, archived, deleted')
      .eq('team_id', teamId);

    const current = error
      ? 0
      : (data ?? []).filter((board) => board.deleted !== true && board.archived !== true).length;

    return { allowed: current < max, current, max, tier: currentTier };
  }, [targetUserId]);

  const checkMemberLimit = useCallback(async (teamId: string): Promise<{ allowed: boolean; current: number; max: number; tier: SubscriptionTier }> => {
    const [currentTier, dynamicLimits] = await Promise.all([fetchCurrentTier(targetUserId), loadDynamicLimits()]);
    const max = normalizeLimit(dynamicLimits[currentTier]?.maxMembersPerTeam, DEFAULT_LIMITS[currentTier].maxMembersPerTeam);
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
  }, [targetUserId]);

  return {
    tier,
    limits,
    loading,
    checkTeamLimit,
    checkBoardLimit,
    checkMemberLimit,
  };
}
