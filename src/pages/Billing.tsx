import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription, SUBSCRIPTION_TIERS, FREE_TIER_FEATURES, SubscriptionTier } from '@/hooks/useSubscription';
import { useOrganizations } from '@/hooks/useOrganizations';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Check, Crown, Zap, Building2, Loader2, ExternalLink, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useFeatureFlags } from '@/contexts/FeatureFlagContext';
import { FEATURE_SUBSCRIPTIONS_ENABLED } from '@/constants/featureFlags';

const Billing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tier, subscribed, subscriptionEnd, cancelAtPeriodEnd, loading, startCheckout, openCustomerPortal, checkSubscription } = useSubscription();
  const { isFeatureEnabled, loading: flagsLoading } = useFeatureFlags();
  const { organizations, createOrganization, refetch: refetchOrgs } = useOrganizations();
  const [yearly, setYearly] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [dynamicFeatures, setDynamicFeatures] = useState<Record<string, string[]> | null>(null);
  const [seatCount, setSeatCount] = useState(5);
  const [showOrgSetup, setShowOrgSetup] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  // Check if user already owns an org
  const ownsOrg = organizations.some(o => o.owner_id === user?.id);

  useEffect(() => {
    supabase
      .from('app_config')
      .select('value')
      .eq('key', 'tier_limits')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          try {
            const parsed = JSON.parse(data.value);
            setDynamicFeatures({
              free: parsed.free?.features,
              pro: parsed.pro?.features,
              business: parsed.business?.features,
              enterprise: parsed.enterprise?.features,
            });
          } catch { /* ignore */ }
        }
      });
  }, []);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Subscription activated! Refreshing your plan...');
      checkSubscription().then(async () => {
        // After refresh, check if this is an enterprise subscription and user has no org yet
        await refetchOrgs();
      });
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Checkout canceled.');
    }
  }, [searchParams, checkSubscription, refetchOrgs]);

  // Show org setup prompt when enterprise is active and user hasn't created an org
  useEffect(() => {
    if (tier === 'enterprise' && !ownsOrg && searchParams.get('success') === 'true') {
      setShowOrgSetup(true);
    }
  }, [tier, ownsOrg, searchParams]);

  const handleCreateOrg = async () => {
    if (!orgName.trim() || !orgSlug.trim()) return;
    setCreatingOrg(true);
    try {
      const org = await createOrganization(orgName.trim(), orgSlug.trim(), orgDescription.trim() || undefined);
      toast.success('Organization created!');
      setShowOrgSetup(false);
      navigate(`/org/${org.slug}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create organization');
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleCheckout = async (planTier: 'pro' | 'business') => {
    if (!user) {
      toast.error('Please sign in to subscribe.');
      return;
    }
    setCheckoutLoading(planTier);
    try {
      const tierConfig = SUBSCRIPTION_TIERS[planTier];
      const priceId = yearly ? (tierConfig as any).yearlyPriceId : tierConfig.monthlyPriceId;
      const result = await startCheckout(priceId);
      if (result?.updated) {
        toast.success('Plan updated successfully! Changes are prorated.');
      }
    } catch {
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleEnterpriseCheckout = async () => {
    if (!user) {
      toast.error('Please sign in to subscribe.');
      return;
    }
    if (seatCount < 1) {
      toast.error('You need at least 1 seat.');
      return;
    }
    setCheckoutLoading('enterprise');
    try {
      const result = await startCheckout(SUBSCRIPTION_TIERS.enterprise.monthlyPriceId, seatCount);
      if (result?.updated) {
        toast.success('Plan updated successfully!');
      }
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

  const tierOrder: SubscriptionTier[] = ['free', 'pro', 'business', 'enterprise'];

  const plans = [
    {
      id: 'free' as const,
      name: 'Free',
      description: 'Get started with the basics',
      icon: Zap,
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: dynamicFeatures?.free || FREE_TIER_FEATURES,
      accent: 'border-border',
    },
    {
      id: 'pro' as const,
      name: 'Pro',
      description: 'For growing teams',
      icon: Crown,
      monthlyPrice: SUBSCRIPTION_TIERS.pro.monthlyPrice,
      yearlyPrice: SUBSCRIPTION_TIERS.pro.yearlyPrice,
      features: dynamicFeatures?.pro || SUBSCRIPTION_TIERS.pro.features,
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
      features: dynamicFeatures?.business || SUBSCRIPTION_TIERS.business.features,
      accent: 'border-accent',
    },
  ];

  if (loading || flagsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isFeatureEnabled(FEATURE_SUBSCRIPTIONS_ENABLED)) {
    return <Navigate to="/account" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
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

        {/* Standard Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

        {/* Enterprise Plan */}
        <Card className={`border-2 ${tier === 'enterprise' ? 'border-primary ring-2 ring-primary/20' : 'border-accent'} max-w-2xl mx-auto`}>
          {tier === 'enterprise' && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge variant="outline" className="bg-background border-primary text-primary shadow-sm">
                Your Plan
              </Badge>
            </div>
          )}
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Enterprise</CardTitle>
            </div>
            <CardDescription>For organizations that need full control, VIP support, and per-seat pricing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-bold text-foreground">$5</span>
              <span className="text-muted-foreground">/seat/month</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
              {(dynamicFeatures?.enterprise || SUBSCRIPTION_TIERS.enterprise.features).map((feature) => (
                <div key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-foreground">{feature}</span>
                </div>
              ))}
            </div>

            {tier === 'enterprise' ? (
              <Button variant="outline" className="w-full" onClick={handleManageSubscription}>
                Manage Subscription <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Number of seats</Label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={seatCount}
                    onChange={(e) => setSeatCount(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Total: ${seatCount * 5}/month
                  </p>
                </div>
                <Button
                  onClick={handleEnterpriseCheckout}
                  disabled={!!checkoutLoading}
                  className="flex-1"
                >
                  {checkoutLoading === 'enterprise' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : <Sparkles className="h-4 w-4 mr-2" />}
                  Get Enterprise
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

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
        {/* Enterprise Org Setup Dialog */}
        <Dialog open={showOrgSetup} onOpenChange={setShowOrgSetup}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Up Your Organization</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Your Enterprise plan includes an organization. Set it up now to manage your teams under one umbrella.
            </p>
            <div className="space-y-4 mt-2">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Organization Name</label>
                <Input
                  value={orgName}
                  onChange={(e) => {
                    setOrgName(e.target.value);
                    if (!orgSlug || orgSlug === orgName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')) {
                      setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'));
                    }
                  }}
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">URL Slug</label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">/org/</span>
                  <Input
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    placeholder="acme-corp"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description (optional)</label>
                <Textarea
                  value={orgDescription}
                  onChange={(e) => setOrgDescription(e.target.value)}
                  placeholder="Brief description of your organization"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateOrg} className="flex-1" disabled={!orgName.trim() || !orgSlug.trim() || creatingOrg}>
                  {creatingOrg ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="h-4 w-4 mr-2" />}
                  Create Organization
                </Button>
                <Button variant="outline" onClick={() => setShowOrgSetup(false)}>
                  Later
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Prompt for enterprise users who haven't created their org yet */}
        {tier === 'enterprise' && !ownsOrg && !showOrgSetup && (
          <Card className="max-w-2xl mx-auto mt-6 border-primary/50">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary" />
                <p className="text-sm text-foreground">You haven't set up your organization yet.</p>
              </div>
              <Button size="sm" onClick={() => setShowOrgSetup(true)}>
                Set Up Organization
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Billing;
