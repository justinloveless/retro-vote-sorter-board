export interface TierConfig {
  maxTeams: number | null;
  maxMembersPerTeam: number | null;
  maxActiveBoards: number | null;
  features: string[];
  featureFlags?: Record<string, boolean>;
}

export interface AllTierLimits {
  free: TierConfig;
  pro: TierConfig;
  business: TierConfig;
  enterprise: TierConfig;
}

export const DEFAULT_ALL_TIER_LIMITS: AllTierLimits = {
  free: {
    maxTeams: 1,
    maxMembersPerTeam: 5,
    maxActiveBoards: 3,
    features: ['Up to 5 team members', '1 team', '3 active boards', 'Basic retro & poker', 'Community support'],
    featureFlags: {},
  },
  pro: {
    maxTeams: 5,
    maxMembersPerTeam: 25,
    maxActiveBoards: null,
    features: ['Up to 25 team members', 'Up to 5 teams', 'AI sentiment analysis', 'Audio summaries', 'Admin features', 'Unlimited boards'],
    featureFlags: {},
  },
  business: {
    maxTeams: null,
    maxMembersPerTeam: null,
    maxActiveBoards: null,
    features: ['Unlimited team members', 'Unlimited teams', 'All AI features', 'Advanced admin features', 'Priority support', 'Custom branding (coming soon)'],
    featureFlags: {},
  },
  enterprise: {
    maxTeams: null,
    maxMembersPerTeam: null,
    maxActiveBoards: null,
    features: ['All Business features', 'Organizations', 'Per-seat billing ($5/seat/month)', 'VIP support', 'Org-wide team management', 'Shared resources across org'],
    featureFlags: {},
  },
};

export const ADMIN_TIER_KEYS = ['free', 'pro', 'business', 'enterprise'] as const;
export type AdminTierKey = (typeof ADMIN_TIER_KEYS)[number];

export const ADMIN_TIER_LABELS: Record<AdminTierKey, string> = {
  free: 'Free',
  pro: 'Pro',
  business: 'Business',
  enterprise: 'Enterprise',
};

export function mergeStoredTierLimits(parsed: unknown): AllTierLimits {
  if (!parsed || typeof parsed !== 'object') {
    return DEFAULT_ALL_TIER_LIMITS;
  }
  const p = parsed as Partial<AllTierLimits>;
  return {
    free: { ...DEFAULT_ALL_TIER_LIMITS.free, ...p.free },
    pro: { ...DEFAULT_ALL_TIER_LIMITS.pro, ...p.pro },
    business: { ...DEFAULT_ALL_TIER_LIMITS.business, ...p.business },
    enterprise: { ...DEFAULT_ALL_TIER_LIMITS.enterprise, ...p.enterprise },
  };
}
