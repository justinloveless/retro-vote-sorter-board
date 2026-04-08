import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Sparkles, AlertTriangle, Info } from 'lucide-react';
import { useAuth, type Profile } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useFeatureFlags } from '@/contexts/FeatureFlagContext';
import { FEATURE_POKER_LOCAL_ADVISOR } from '@/constants/featureFlags';
import { combineAdvisorPrompts, normalizeAdviseUrl, normalizeHealthUrl } from '@/lib/pokerLocalAdvisor';
import { PokerLocalAdvisorDownload } from '@/components/account/PokerLocalAdvisorDownload';
import { PokerLocalAdvisorSelfUpdate } from '@/components/account/PokerLocalAdvisorSelfUpdate';
import { usePokerAdvisorPause } from '@/hooks/usePokerAdvisorPause';

export const PokerAdvisorSettings: React.FC = () => {
  const { profile, updateProfile, refreshProfile } = useAuth();
  const { paused, setPaused } = usePokerAdvisorPause();
  const { toast } = useToast();
  const { flags, isFeatureEnabled, loading: flagsLoading } = useFeatureFlags();
  const globalFlagOn = flags[FEATURE_POKER_LOCAL_ADVISOR] === true;
  const featureResolved = !flagsLoading && isFeatureEnabled(FEATURE_POKER_LOCAL_ADVISOR);
  const tierBlocks = !flagsLoading && globalFlagOn && !featureResolved;

  const [baseUrl, setBaseUrl] = useState('');
  const [personalPrompt, setPersonalPrompt] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [ack, setAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (!profile) return;
    setBaseUrl(profile.poker_advisor_base_url || '');
    setPersonalPrompt(profile.poker_advisor_personal_prompt || '');
    setEnabled(!!profile.poker_advisor_enabled);
    setAck(!!profile.poker_advisor_data_sharing_acknowledged_at);
  }, [
    profile?.poker_advisor_base_url,
    profile?.poker_advisor_personal_prompt,
    profile?.poker_advisor_enabled,
    profile?.poker_advisor_data_sharing_acknowledged_at,
  ]);

  const canEnable = ack && baseUrl.trim().length > 0;

  const handleSave = async () => {
    if (!profile) return;
    if (enabled && !canEnable) {
      toast({
        title: 'Cannot enable advisor',
        description: 'Confirm data sharing and enter a local server URL first.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const updates: Partial<Profile> = {
        poker_advisor_enabled: featureResolved ? enabled && canEnable : false,
        poker_advisor_base_url: baseUrl.trim() || null,
        poker_advisor_personal_prompt: personalPrompt.trim() || null,
        poker_advisor_data_sharing_acknowledged_at: ack
          ? profile.poker_advisor_data_sharing_acknowledged_at || new Date().toISOString()
          : null,
      };
      await updateProfile(updates);
      toast({ title: 'Saved', description: 'Poker advisor settings updated.' });
    } catch (e: unknown) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!baseUrl.trim()) {
      toast({ title: 'Enter a URL', variant: 'destructive' });
      return;
    }
    setTesting(true);
    try {
      const healthUrl = normalizeHealthUrl(baseUrl);
      let res = await fetch(healthUrl, { method: 'GET' });
      let usedLegacyAdvise = false;
      if (res.status === 404) {
        usedLegacyAdvise = true;
        const url = normalizeAdviseUrl(baseUrl);
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roundId: 'connection-test',
            ticketKey: 'TEST-1',
            ticketTitle: 'Connection test',
            parentKey: null,
            parentSummary: null,
            description: null,
            roundNumber: 1,
            gameState: 'Selection',
            teamPrompt: null,
            personalPrompt: personalPrompt.trim() || null,
            combinedPrompt: combineAdvisorPrompts(null, personalPrompt.trim() || null),
          }),
        });
      }
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `HTTP ${res.status}`);
      }
      if (text) JSON.parse(text);
      toast({
        title: 'Local server responded',
        description: usedLegacyAdvise
          ? 'Received JSON from your advisor endpoint.'
          : 'Reference server is reachable (GET /health).',
      });
    } catch (e: unknown) {
      toast({
        title: 'Connection failed',
        description: e instanceof Error ? e.message : 'Could not reach the local server.',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  if (flagsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Poker advisor (local CLI)
          </CardTitle>
          <CardDescription>Loading feature flags…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          Poker advisor (local CLI)
        </CardTitle>
        <CardDescription>
          Run a small HTTP server on your machine and connect it to Claude Code, Gemini CLI, or a custom script.
          Suggested points and reasoning appear only to you in the poker session—never to teammates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PokerLocalAdvisorDownload />

        {!globalFlagOn && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Feature not enabled globally</AlertTitle>
            <AlertDescription className="text-xs">
              An admin must turn on the <code className="text-[11px]">poker_local_advisor</code> flag in the database
              or Admin → Feature flags. You can still save your local URL below so you are ready when it is enabled.
            </AlertDescription>
          </Alert>
        )}

        {tierBlocks && (
          <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle>Not available on your current tier</AlertTitle>
            <AlertDescription className="text-xs">
              The global flag is on, but your subscription tier has <code className="text-[11px]">poker_local_advisor</code>{' '}
              disabled in tier limits. Ask an admin to enable it for your plan or upgrade.
            </AlertDescription>
          </Alert>
        )}

        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Data stays on your device</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed">
            When enabled, your browser sends ticket context (key, title, parent, optional Jira description) to{' '}
            <strong>your computer only</strong> (localhost)—not to Retroscope for estimation. Your configured CLI or
            script may process that data; you are responsible for those tools. No browser permission prompt is required
            for localhost from this site.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="poker-advisor-personal-prompt">Personal advisor instructions (optional)</Label>
          <Textarea
            id="poker-advisor-personal-prompt"
            value={personalPrompt}
            onChange={(e) => setPersonalPrompt(e.target.value)}
            placeholder="e.g. Mention skill X; prefer small stories as 3 or less."
            rows={4}
            className="font-mono text-sm min-h-[96px]"
          />
          <p className="text-xs text-muted-foreground">
            Combined with your team&apos;s prompt (if any) from Team settings and sent in each{' '}
            <code className="text-[11px]">/advise</code> request—useful for CLI-specific hints.
          </p>
        </div>

        <div className="flex items-start gap-3 space-y-0">
          <Switch
            id="poker-advisor-ack"
            checked={ack}
            onCheckedChange={setAck}
            disabled={!!profile?.poker_advisor_data_sharing_acknowledged_at}
          />
          <div className="space-y-1">
            <Label htmlFor="poker-advisor-ack" className="cursor-pointer">
              I understand ticket context may be sent to my local tools
            </Label>
            {profile?.poker_advisor_data_sharing_acknowledged_at && (
              <p className="text-xs text-muted-foreground">
                Acknowledged{' '}
                {new Date(profile.poker_advisor_data_sharing_acknowledged_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="poker-advisor-url">Local server base URL</Label>
          <Input
            id="poker-advisor-url"
            placeholder="http://127.0.0.1:17300"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Change the host or port if your server listens elsewhere (e.g. <code className="text-[11px]">http://127.0.0.1:3847</code>
            ). The app POSTs to <code className="text-[11px]">/advise</code> on this origin. See <strong>INSTALL.md</strong> in
            the zip for step-by-step setup.
          </p>
        </div>

        <PokerLocalAdvisorSelfUpdate baseUrl={baseUrl} />

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="poker-advisor-enabled">Enable private advisor in poker sessions</Label>
            <p className="text-xs text-muted-foreground">
              {featureResolved
                ? 'Requires acknowledgement and a valid URL.'
                : 'Turned on when the feature is available for your account.'}
            </p>
          </div>
          <Switch
            id="poker-advisor-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={(!canEnable && !enabled) || !featureResolved}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="poker-advisor-pause">Pause local advisor requests</Label>
            <p className="text-xs text-muted-foreground">
              While on, Retroscope does not call your local server during poker sessions. Stored in this browser only;
              use the same toggle in the session advisor panel.
            </p>
          </div>
          <Switch
            id="poker-advisor-pause"
            checked={paused}
            onCheckedChange={setPaused}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing || !baseUrl.trim()}
          >
            {testing ? 'Testing…' : 'Test connection'}
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
