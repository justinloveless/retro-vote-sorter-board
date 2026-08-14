import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Zap, Crown, Building2, Sparkles } from 'lucide-react';
import {
  type AllTierLimits,
  DEFAULT_ALL_TIER_LIMITS,
  mergeStoredTierLimits,
} from '@/constants/adminTierLimits';

interface FeatureFlag {
  flag_name: string;
  description: string | null;
  is_enabled: boolean;
}

function effectiveFlagForTier(
  flag: FeatureFlag,
  tierFeatureFlags: Record<string, boolean> | undefined
): { label: string; variant: 'default' | 'secondary' | 'outline' } {
  if (!flag.is_enabled) {
    return { label: 'Globally off', variant: 'secondary' };
  }
  const map = tierFeatureFlags || {};
  if (flag.flag_name in map && map[flag.flag_name] === false) {
    return { label: 'Blocked for tier', variant: 'outline' };
  }
  return { label: 'On for tier', variant: 'default' };
}

const TIER_ICONS = { free: Zap, pro: Crown, business: Building2, enterprise: Sparkles };
const TIER_LABELS = { free: 'Free', pro: 'Pro', business: 'Business', enterprise: 'Enterprise' };

export const TierLimitsManager: React.FC = () => {
  const [limits, setLimits] = useState<AllTierLimits>(DEFAULT_ALL_TIER_LIMITS);
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
        setLimits(mergeStoredTierLimits(JSON.parse(limitsRes.data.value)));
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

  const updateLimit = (tier: keyof AllTierLimits, field: 'maxTeams' | 'maxMembersPerTeam' | 'maxActiveBoards', value: string) => {
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
        <CardDescription>
          Configure numeric limits and marketing feature bullets per tier. Feature flag access per tier is read-only here; edit it on the Feature Flags admin page for each flag.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activeTier} onValueChange={(value) => setActiveTier(value as keyof AllTierLimits)}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
            {(['free', 'pro', 'business', 'enterprise'] as const).map((tier) => (
              <TabsTrigger key={tier} value={tier} className="text-xs sm:text-sm">
                {TIER_LABELS[tier]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {(() => {
          const Icon = TIER_ICONS[activeTier];
          const config = limits[activeTier] || DEFAULT_ALL_TIER_LIMITS[activeTier];
          const tierFlags = config.featureFlags || {};
          return (
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">{TIER_LABELS[activeTier]}</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                  <Label className="text-xs mb-2 block">Feature flags (read-only)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Effective access when overrides do not apply: globally on, not explicitly blocked for this tier. Manage tier access under Admin → Feature Flags.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {flags.map((flag) => {
                      const { label, variant } = effectiveFlagForTier(flag, tierFlags);
                      return (
                        <div
                          key={flag.flag_name}
                          className="flex items-start justify-between gap-2 p-2 rounded border border-border text-sm"
                        >
                          <div className="min-w-0 flex flex-col">
                            <span className="font-medium text-foreground">{flag.flag_name}</span>
                            {flag.description && (
                              <span className="text-xs text-muted-foreground">{flag.description}</span>
                            )}
                          </div>
                          <Badge variant={variant} className="shrink-0">
                            {label}
                          </Badge>
                        </div>
                      );
                    })}
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
