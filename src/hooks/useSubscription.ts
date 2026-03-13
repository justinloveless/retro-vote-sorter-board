import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type SubscriptionTier = 'free' | 'pro' | 'business';

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
} as const;

export const FREE_TIER_FEATURES = [
  'Up to 5 team members',
  '1 team',
  '3 active boards',
  'Basic retro & poker',
  'Community support',
];

export function useSubscription() {
  const { user, session } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    tier: 'free',
    subscribed: false,
    subscriptionEnd: null,
    cancelAtPeriodEnd: false,
    loading: true,
  });

  const checkSubscription = useCallback(async () => {
    if (!session) {
      setState({ tier: 'free', subscribed: false, subscriptionEnd: null, cancelAtPeriodEnd: false, loading: false });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;

      setState({
        tier: data.tier || 'free',
        subscribed: data.subscribed || false,
        subscriptionEnd: data.subscription_end || null,
        loading: false,
      });
    } catch (err) {
      console.error('Error checking subscription:', err);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [session]);

  useEffect(() => {
    checkSubscription();

    // Auto-refresh every 60 seconds
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  const startCheckout = useCallback(async (priceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Error creating checkout:', err);
      throw err;
    }
  }, []);

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
