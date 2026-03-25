import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Zap, Crown, Building2, Sparkles } from 'lucide-react';

interface TierConfig {
  maxTeams: number | null;
  maxMembersPerTeam: number | null;
  maxActiveBoards: number | null;
  features: string[];
  featureFlags?: Record<string, boolean>;
}

interface AllTierLimits {
  free: TierConfig;
  pro: TierConfig;
  business: TierConfig;
  enterprise: TierConfig;
}

interface FeatureFlag {
  flag_name: string;
  description: string | null;
  is_enabled: boolean;
}

const DEFAULT_LIMITS: AllTierLimits = {
  free: { maxTeams: 1, maxMembersPerTeam: 5, maxActiveBoards: 3, features: ['Up to 5 team members', '1 team', '3 active boards', 'Basic retro & poker', 'Community support'], featureFlags: {} },
  pro: { maxTeams: 5, maxMembersPerTeam: 25, maxActiveBoards: null, features: ['Up to 25 team members', 'Up to 5 teams', 'AI sentiment analysis', 'Audio summaries', 'Admin features', 'Unlimited boards'], featureFlags: {} },
  business: { maxTeams: null, maxMembersPerTeam: null, maxActiveBoards: null, features: ['Unlimited team members', 'Unlimited teams', 'All AI features', 'Advanced admin features', 'Priority support', 'Custom branding (coming soon)'], featureFlags: {} },
  enterprise: { maxTeams: null, maxMembersPerTeam: null, maxActiveBoards: null, features: ['All Business features', 'Organizations', 'Per-seat billing ($5/seat/month)', 'VIP support', 'Org-wide team management', 'Shared resources across org'], featureFlags: {} },
};

const TIER_ICONS = { free: Zap, pro: Crown, business: Building2, enterprise: Sparkles };
const TIER_LABELS = { free: 'Free', pro: 'Pro', business: 'Business', enterprise: 'Enterprise' };

export const TierLimitsManager: React.FC = () => {
  const [limits, setLimits] = useState<AllTierLimits>(DEFAULT_LIMITS);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [activeTier, setActiveTier] = useState<keyof AllTierLimits>('free');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [limitsRes, flagsRes] = await Promise.all([
        supabase.from('app_config').select('value').eq('key', 'tier_limits').maybeSingle(),
        supabase.from('feature_flags').select('*'),
      ]);
      if (limitsRes.data?.value) {
        const parsed = JSON.parse(limitsRes.data.value);
        setLimits({
          free: { ...DEFAULT_LIMITS.free, ...parsed.free },
          pro: { ...DEFAULT_LIMITS.pro, ...parsed.pro },
          business: { ...DEFAULT_LIMITS.business, ...parsed.business },
          enterprise: { ...DEFAULT_LIMITS.enterprise, ...parsed.enterprise },
        });
      }
      if (flagsRes.data) {
        setFlags(flagsRes.data);
      }
    } catch (err) {
      console.error('Failed to load tier limits:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_config')
        .upsert({ key: 'tier_limits', value: JSON.stringify(limits) }, { onConflict: 'key' });
      if (error) throw error;
      toast.success('Tier limits saved successfully');
    } catch (err: any) {
      toast.error('Failed to save tier limits: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const updateLimit = (tier: keyof AllTierLimits, field: keyof Omit<TierConfig, 'features' | 'featureFlags'>, value: string) => {
    setLimits(prev => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        [field]: value === '' || value === '0' ? null : parseInt(value, 10) || null,
      },
    }));
  };

  const updateFeatures = (tier: keyof AllTierLimits, value: string) => {
    setLimits(prev => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        features: value.split('\n').filter(f => f.trim()),
      },
    }));
  };

  const toggleFeatureFlag = (tier: keyof AllTierLimits, flagName: string, checked: boolean) => {
    setLimits(prev => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        featureFlags: {
          ...(prev[tier].featureFlags || {}),
          [flagName]: checked,
        },
      },
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan Tier Limits</CardTitle>
        <CardDescription>Configure features, limits, and feature flag access for each subscription tier. Use blank or 0 for unlimited.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activeTier} onValueChange={(value) => setActiveTier(value as keyof AllTierLimits)}>
          <TabsList className="grid w-full grid-cols-4">
            {(['free', 'pro', 'business', 'enterprise'] as const).map((tier) => (
              <TabsTrigger key={tier} value={tier}>
                {TIER_LABELS[tier]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {(() => {
          const Icon = TIER_ICONS[activeTier];
          const config = limits[activeTier] || DEFAULT_LIMITS[activeTier];
          const tierFlags = config.featureFlags || {};
          return (
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">{TIER_LABELS[activeTier]}</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">Max Teams</Label>
                  <Input
                    type="number"
                    min="0"
                    value={config.maxTeams ?? ''}
                    onChange={(e) => updateLimit(activeTier, 'maxTeams', e.target.value)}
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <Label className="text-xs">Max Members/Team</Label>
                  <Input
                    type="number"
                    min="0"
                    value={config.maxMembersPerTeam ?? ''}
                    onChange={(e) => updateLimit(activeTier, 'maxMembersPerTeam', e.target.value)}
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <Label className="text-xs">Max Active Boards</Label>
                  <Input
                    type="number"
                    min="0"
                    value={config.maxActiveBoards ?? ''}
                    onChange={(e) => updateLimit(activeTier, 'maxActiveBoards', e.target.value)}
                    placeholder="Unlimited"
                  />
                </div>
              </div>
              {flags.length > 0 && (
                <div>
                  <Label className="text-xs mb-2 block">Feature Flags Access</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {flags.map(flag => (
                      <label
                        key={flag.flag_name}
                        className="flex items-center gap-2 p-2 rounded border border-border hover:bg-muted/50 cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={tierFlags[flag.flag_name] ?? false}
                          onCheckedChange={(checked) => toggleFeatureFlag(activeTier, flag.flag_name, !!checked)}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{flag.flag_name}</span>
                          {flag.description && <span className="text-xs text-muted-foreground">{flag.description}</span>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs">Features (one per line)</Label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
                  value={config.features.join('\n')}
                  onChange={(e) => updateFeatures(activeTier, e.target.value)}
                />
              </div>
            </div>
          );
        })()}
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Tier Configuration
        </Button>
      </CardContent>
    </Card>
  );
};
