import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type SubscriptionTier = 'free' | 'pro' | 'business' | 'enterprise';

interface SubscriptionState {
  tier: SubscriptionTier;
  subscribed: boolean;
  subscriptionEnd: string | null;
  cancelAtPeriodEnd: boolean;
  loading: boolean;
}

// Product and price mappings
export const SUBSCRIPTION_TIERS = {
  pro: {
    name: 'Pro',
    monthlyPrice: 10,
    yearlyPrice: 96,
    monthlyPriceId: 'price_1TAK4iCvGWploxZNv2EYFZgi',
    yearlyPriceId: 'price_1TAK58CvGWploxZNOXAZ2AMd',
    features: [
      'Up to 25 team members',
      'Up to 5 teams',
      'AI sentiment analysis',
      'Audio summaries',
      'Admin features',
      'Unlimited boards',
    ],
  },
  business: {
    name: 'Business',
    monthlyPrice: 25,
    yearlyPrice: 240,
    monthlyPriceId: 'price_1TAK5PCvGWploxZNWN5ZuJaS',
    yearlyPriceId: 'price_1TAK5fCvGWploxZNBbKLB2Ms',
    features: [
      'Unlimited team members',
      'Unlimited teams',
      'All AI features',
      'Advanced admin features',
      'Priority support',
      'Custom branding (coming soon)',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    monthlyPricePerSeat: 5,
    monthlyPriceId: 'price_1TAMVaCvGWploxZNB9FrdcHO',
    features: [
      'All Business features',
      'Organizations',
      'Per-seat billing ($5/seat/month)',
      'VIP support',
      'Org-wide team management',
      'Shared resources across org',
    ],
  },
} as const;

export const FREE_TIER_FEATURES = [
  'Up to 5 team members',
  '1 team',
  '3 active boards',
  'Basic retro & poker',
  'Community support',
];

export function useSubscription() {
  const { user, profile, isImpersonating, session } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    tier: 'free',
    subscribed: false,
    subscriptionEnd: null,
    cancelAtPeriodEnd: false,
    loading: true,
  });

  // When impersonating, check the impersonated user's subscription
  const targetUserId = isImpersonating && profile?.id ? profile.id : undefined;

  const checkSubscription = useCallback(async () => {
    if (!session) {
      setState({ tier: 'free', subscribed: false, subscriptionEnd: null, cancelAtPeriodEnd: false, loading: false });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        body: targetUserId ? { target_user_id: targetUserId } : {},
      });
      if (error) throw error;

      setState({
        tier: data.tier || 'free',
        subscribed: data.subscribed || false,
        subscriptionEnd: data.subscription_end || null,
        cancelAtPeriodEnd: data.cancel_at_period_end || false,
        loading: false,
      });
    } catch (err) {
      console.error('Error checking subscription:', err);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [session, targetUserId]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  const startCheckout = useCallback(async (priceId: string, quantity?: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId, quantity },
      });
      if (error) throw error;
      // If the subscription was updated inline (plan change with proration), refresh status
      if (data?.updated) {
        await checkSubscription();
        return { updated: true };
      }
      if (data?.url) {
        window.open(data.url, '_blank');
      }
      return { updated: false };
    } catch (err) {
      console.error('Error creating checkout:', err);
      throw err;
    }
  }, [checkSubscription]);

  const openCustomerPortal = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Error opening customer portal:', err);
      throw err;
    }
  }, []);

  return {
    ...state,
    checkSubscription,
    startCheckout,
    openCustomerPortal,
  };
}
