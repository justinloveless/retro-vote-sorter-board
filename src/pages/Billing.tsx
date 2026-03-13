import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription, SUBSCRIPTION_TIERS, FREE_TIER_FEATURES, SubscriptionTier } from '@/hooks/useSubscription';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check, Crown, Zap, Building2, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const Billing = () => {
  const { user } = useAuth();
  const { tier, subscribed, subscriptionEnd, cancelAtPeriodEnd, loading, startCheckout, openCustomerPortal, checkSubscription } = useSubscription();
  const [yearly, setYearly] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Subscription activated! Refreshing your plan...');
      checkSubscription();
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Checkout canceled.');
    }
  }, [searchParams, checkSubscription]);

  const handleCheckout = async (planTier: 'pro' | 'business') => {
    if (!user) {
      toast.error('Please sign in to subscribe.');
      return;
    }
    setCheckoutLoading(planTier);
    try {
      const tierConfig = SUBSCRIPTION_TIERS[planTier];
      const priceId = yearly ? tierConfig.yearlyPriceId : tierConfig.monthlyPriceId;
      await startCheckout(priceId);
    } catch {
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      await openCustomerPortal();
    } catch {
      toast.error('Failed to open billing portal.');
    }
  };

  const tierOrder: SubscriptionTier[] = ['free', 'pro', 'business'];

  const plans = [
    {
      id: 'free' as const,
      name: 'Free',
      description: 'Get started with the basics',
      icon: Zap,
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: FREE_TIER_FEATURES,
      accent: 'border-border',
    },
    {
      id: 'pro' as const,
      name: 'Pro',
      description: 'For growing teams',
      icon: Crown,
      monthlyPrice: SUBSCRIPTION_TIERS.pro.monthlyPrice,
      yearlyPrice: SUBSCRIPTION_TIERS.pro.yearlyPrice,
      features: SUBSCRIPTION_TIERS.pro.features,
      accent: 'border-primary',
      popular: true,
    },
    {
      id: 'business' as const,
      name: 'Business',
      description: 'For organizations at scale',
      icon: Building2,
      monthlyPrice: SUBSCRIPTION_TIERS.business.monthlyPrice,
      yearlyPrice: SUBSCRIPTION_TIERS.business.yearlyPrice,
      features: SUBSCRIPTION_TIERS.business.features,
      accent: 'border-accent',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Choose your plan
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Start free and scale as your team grows. Upgrade anytime.
          </p>

          <div className="flex items-center justify-center gap-3 mt-6">
            <Label htmlFor="billing-toggle" className={`text-sm ${!yearly ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              Monthly
            </Label>
            <Switch id="billing-toggle" checked={yearly} onCheckedChange={setYearly} />
            <Label htmlFor="billing-toggle" className={`text-sm ${yearly ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              Yearly
            </Label>
            {yearly && (
              <Badge variant="secondary" className="ml-1 text-xs">
                Save 20%
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = tier === plan.id;
            const isUpgrade = tierOrder.indexOf(plan.id) > tierOrder.indexOf(tier);
            const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
            const interval = yearly ? '/year' : '/month';

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col border-2 ${isCurrent ? 'border-primary ring-2 ring-primary/20' : plan.accent} transition-all hover:shadow-lg`}
              >
                {plan.popular && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground shadow-sm">
                      Most Popular
                    </Badge>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="outline" className="bg-background border-primary text-primary shadow-sm">
                      Your Plan
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <plan.icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-foreground">
                      ${price === 0 ? '0' : price}
                    </span>
                    {price > 0 && (
                      <span className="text-muted-foreground ml-1">{interval}</span>
                    )}
                    {yearly && price > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ${(price / 12).toFixed(0)}/month billed annually
                      </p>
                    )}
                  </div>

                  <ul className="space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pt-4">
                  {isCurrent && subscribed ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleManageSubscription}
                    >
                      Manage Subscription <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  ) : isCurrent && plan.id === 'free' ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : plan.id === 'free' ? (
                    <Button variant="ghost" className="w-full" disabled>
                      {subscribed ? 'Downgrade via portal' : 'Current Plan'}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => handleCheckout(plan.id as 'pro' | 'business')}
                      disabled={!!checkoutLoading}
                    >
                      {checkoutLoading === plan.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {isUpgrade ? 'Upgrade' : 'Subscribe'}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {subscribed && subscriptionEnd && (
          <p className={`text-center text-sm mt-8 ${cancelAtPeriodEnd ? 'text-destructive' : 'text-muted-foreground'}`}>
            {cancelAtPeriodEnd ? (
              <>
                Your {tier.charAt(0).toUpperCase() + tier.slice(1)} plan has been canceled and will expire on{' '}
                <span className="font-medium">
                  {new Date(subscriptionEnd).toLocaleDateString()}
                </span>
              </>
            ) : (
              <>
                Your current subscription renews on{' '}
                <span className="font-medium text-foreground">
                  {new Date(subscriptionEnd).toLocaleDateString()}
                </span>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
};

export default Billing;
