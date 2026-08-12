import React, { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchBackendProviderConfig,
  getSessionBackendOverride,
  getViteApiBaseUrl,
  saveBackendProviderConfig,
  setSessionBackendOverride,
} from '@/lib/backend/config';
import type {
  BackendHealthChecks,
  BackendMode,
  BackendProviderConfig,
  BackendStatusResponse,
} from '@/lib/backend/types';
import { DEFAULT_BACKEND_PROVIDER } from '@/lib/backend/types';
import { Loader2 } from 'lucide-react';

type ApplyScope = 'all' | 'session';

function HealthChip({
  label,
  ok,
  detail,
}: {
  label: string;
  ok?: boolean;
  detail?: string;
}) {
  const variant = ok === true ? 'default' : ok === false ? 'destructive' : 'secondary';
  const text = ok === true ? 'OK' : ok === false ? 'Down' : 'n/a';
  return (
    <Badge variant={variant} title={detail || undefined} className="gap-1">
      {label}: {text}
    </Badge>
  );
}

export const BackendProviderToggle: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [probing, setProbing] = useState(false);
  const [persisted, setPersisted] = useState<BackendProviderConfig>({ ...DEFAULT_BACKEND_PROVIDER });
  const [draftMode, setDraftMode] = useState<BackendMode>('supabase');
  const [draftApiUrl, setDraftApiUrl] = useState('');
  const [sessionOverride, setSessionOverrideState] = useState<BackendMode | null>(null);
  const [checks, setChecks] = useState<BackendHealthChecks>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingScope, setPendingScope] = useState<ApplyScope>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const config = await fetchBackendProviderConfig();
      setPersisted(config);
      setDraftMode(config.mode);
      setDraftApiUrl(config.selfHostedApiBaseUrl || getViteApiBaseUrl());
      setSessionOverrideState(getSessionBackendOverride());
    } catch (error) {
      toast({
        title: 'Failed to load backend provider',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const probeHealth = useCallback(async () => {
    const base = (draftApiUrl || getViteApiBaseUrl()).replace(/\/$/, '');
    if (!base) {
      setChecks({});
      return;
    }

    setProbing(true);
    try {
      const [healthzRes, readyzRes, statusRes] = await Promise.all([
        fetch(`${base}/healthz`).catch(() => null),
        fetch(`${base}/readyz`).catch(() => null),
        session?.access_token
          ? fetch(`${base}/api/admin/backend-status`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            }).catch(() => null)
          : Promise.resolve(null),
      ]);

      const next: BackendHealthChecks = {
        api: { ok: Boolean(healthzRes?.ok), error: healthzRes?.ok ? undefined : 'healthz failed' },
      };

      if (readyzRes) {
        const body = (await readyzRes.json().catch(() => null)) as {
          checks?: BackendHealthChecks;
        } | null;
        next.postgres = body?.checks?.postgres ?? { ok: readyzRes.ok };
        next.postgrest = body?.checks?.postgrest ?? { ok: readyzRes.ok };
      }

      if (statusRes?.ok) {
        const status = (await statusRes.json()) as BackendStatusResponse;
        next.realtime = status.checks?.realtime;
        if (status.checks?.postgres) next.postgres = status.checks.postgres;
        if (status.checks?.postgrest) next.postgrest = status.checks.postgrest;
      } else {
        next.realtime = { ok: false, error: 'Not available' };
      }

      setChecks(next);
    } finally {
      setProbing(false);
    }
  }, [draftApiUrl, session?.access_token]);

  useEffect(() => {
    if (!loading) {
      void probeHealth();
    }
  }, [loading, probeHealth]);

  const requestApply = (scope: ApplyScope) => {
    setPendingScope(scope);
    setConfirmOpen(true);
  };

  const applyChange = async () => {
    setSaving(true);
    try {
      if (pendingScope === 'session') {
        setSessionBackendOverride(draftMode);
        setSessionOverrideState(draftMode);
        toast({
          title: 'Session preview updated',
          description: `This browser session will use "${draftMode}" until you clear the override. Other users are unchanged.`,
        });
      } else {
        const saved = await saveBackendProviderConfig({
          mode: draftMode,
          selfHostedApiBaseUrl: draftApiUrl.trim(),
        });
        setPersisted(saved);
        setSessionBackendOverride(null);
        setSessionOverrideState(null);
        toast({
          title: 'Backend provider saved',
          description: `Global mode is now "${saved.mode}". Phase 1 still routes both modes to hosted Supabase.`,
        });
      }
      setConfirmOpen(false);
    } catch (error) {
      toast({
        title: 'Failed to save backend provider',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const clearSessionOverride = () => {
    setSessionBackendOverride(null);
    setSessionOverrideState(null);
    setDraftMode(persisted.mode);
    toast({
      title: 'Session override cleared',
      description: 'This session now follows the global app_config mode.',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading backend provider…
        </CardContent>
      </Card>
    );
  }

  const effectiveMode = sessionOverride ?? persisted.mode;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Backend provider</CardTitle>
          <CardDescription>
            Choose hosted Supabase or the self-hosted Node stack. Phase 1 persists the toggle only —
            both modes still use hosted Supabase until auth/data cutover (Phase 2+).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Global: {persisted.mode}</Badge>
            <Badge variant="outline">Effective: {effectiveMode}</Badge>
            {sessionOverride ? <Badge>Session preview: {sessionOverride}</Badge> : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <HealthChip label="API" ok={checks.api?.ok} detail={checks.api?.error} />
            <HealthChip label="DB" ok={checks.postgres?.ok} detail={checks.postgres?.error} />
            <HealthChip
              label="PostgREST"
              ok={checks.postgrest?.ok}
              detail={checks.postgrest?.error}
            />
            <HealthChip label="Realtime" ok={checks.realtime?.ok} detail={checks.realtime?.error} />
            <Button type="button" variant="outline" size="sm" onClick={() => void probeHealth()} disabled={probing}>
              {probing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh health
            </Button>
          </div>

          <div className="space-y-3">
            <Label>Provider</Label>
            <RadioGroup
              value={draftMode}
              onValueChange={(value) => setDraftMode(value as BackendMode)}
              className="gap-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="supabase" id="backend-supabase" />
                <Label htmlFor="backend-supabase" className="font-normal">
                  Hosted Supabase (default)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="selfhosted" id="backend-selfhosted" />
                <Label htmlFor="backend-selfhosted" className="font-normal">
                  Self-hosted Node + Postgres
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="self-hosted-api-url">Self-hosted API base URL</Label>
            <Input
              id="self-hosted-api-url"
              value={draftApiUrl}
              onChange={(event) => setDraftApiUrl(event.target.value)}
              placeholder="https://retro-api.example.com"
            />
            <p className="text-sm text-muted-foreground">
              Used for health probes and (later) self-hosted auth/data clients.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" onClick={() => requestApply('all')} disabled={saving}>
              Apply for all users
            </Button>
            <Button type="button" variant="secondary" onClick={() => requestApply('session')} disabled={saving}>
              Preview for my session only
            </Button>
            {sessionOverride ? (
              <Button type="button" variant="outline" onClick={clearSessionOverride} disabled={saving}>
                Clear session override
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingScope === 'all' ? 'Apply backend mode for everyone?' : 'Preview backend mode for this session?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Switching between hosted Supabase and self-hosted backends can cause data divergence
              during dual-path cutover. Prefer a maintenance freeze before treating self-hosted as
              source of truth. Selected mode: {draftMode}
              {pendingScope === 'all'
                ? ' — persisted to app_config for all users.'
                : ' — sessionStorage override for this admin browser only.'}
              {' '}
              Phase 1 note: both modes still call hosted Supabase. The toggle prepares cutover only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void applyChange(); }} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
