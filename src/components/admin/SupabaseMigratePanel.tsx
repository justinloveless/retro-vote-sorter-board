import React, { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
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
  getViteApiBaseUrl,
} from '@/lib/backend/config';
import { Loader2 } from 'lucide-react';

type MigrateCapability = {
  dataConfigured: boolean;
  storageConfigured: boolean;
  targetConfigured: boolean;
};

type MigrateMeta = {
  confirmationPhrase: string;
  capability: MigrateCapability;
  notes: string[];
};

type MigrateReport = {
  dryRun: boolean;
  includeAuth: boolean;
  includePublic: boolean;
  includeStorage: boolean;
  truncateFirst: boolean;
  tables: Array<{
    schema: string;
    table: string;
    rows: number;
    action: string;
    reason?: string;
  }>;
  storage: Array<{
    bucket: string;
    objects: number;
    errors: number;
    action: string;
    reason?: string;
  }>;
  urlRewrite?: { updated: number };
  warnings: string[];
  durationMs: number;
};

function CapabilityBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Badge variant={ok ? 'default' : 'secondary'}>
      {label}: {ok ? 'ready' : 'not set'}
    </Badge>
  );
}

function resolveAccessToken(session: ReturnType<typeof useAuth>['session']): string | null {
  if (!session) return null;
  const token = session.access_token;
  return typeof token === 'string' && token.trim() ? token.trim() : null;
}

export const SupabaseMigratePanel: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [apiBase, setApiBase] = useState('');
  const [meta, setMeta] = useState<MigrateMeta | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [includeAuth, setIncludeAuth] = useState(true);
  const [includePublic, setIncludePublic] = useState(true);
  const [includeStorage, setIncludeStorage] = useState(false);
  const [truncateFirst, setTruncateFirst] = useState(false);
  const [rewriteStorageUrls, setRewriteStorageUrls] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [report, setReport] = useState<MigrateReport | null>(null);

  const loadMeta = useCallback(async () => {
    setLoading(true);
    try {
      const config = await fetchBackendProviderConfig().catch(() => null);
      const base = (
        config?.selfHostedApiBaseUrl ||
        getViteApiBaseUrl() ||
        ''
      ).replace(/\/$/, '');
      setApiBase(base);

      const token = resolveAccessToken(session);
      if (!base) {
        setMeta(null);
        return;
      }
      if (!token) {
        setMeta(null);
        toast({
          title: 'Sign in required',
          description: 'Admin session token missing — sign in again, then refresh this panel.',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(`${base}/api/admin/migrate-from-supabase`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const errBody = body as { error?: string; hint?: string };
        throw new Error(
          [errBody.error || `Failed to load migrate tool (${response.status})`, errBody.hint]
            .filter(Boolean)
            .join(' — ')
        );
      }
      const json = (await response.json()) as MigrateMeta;
      setMeta(json);
    } catch (error) {
      toast({
        title: 'Migrate tool unavailable',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [session, toast]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const runMigrate = async () => {
    const token = resolveAccessToken(session);
    if (!apiBase) {
      toast({
        title: 'Missing API base URL',
        description:
          'Set Self-hosted API base URL on this page (and save), or bake VITE_API_BASE_URL into the web build.',
        variant: 'destructive',
      });
      return;
    }
    if (!token) {
      toast({
        title: 'Not signed in',
        description: 'No access token available. Sign in as an admin and try again.',
        variant: 'destructive',
      });
      return;
    }

    setRunning(true);
    try {
      const response = await fetch(`${apiBase}/api/admin/migrate-from-supabase`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmation,
          dryRun,
          includeAuth,
          includePublic,
          includeStorage,
          truncateFirst,
          rewriteStorageUrls,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errBody = body as { error?: string; hint?: string };
        throw new Error(
          [errBody.error || `Migrate failed (${response.status})`, errBody.hint]
            .filter(Boolean)
            .join(' — ')
        );
      }
      const next = body as MigrateReport;
      setReport(next);
      toast({
        title: next.dryRun ? 'Dry run complete' : 'Migration complete',
        description: `${next.tables.length} table(s), ${next.storage.length} bucket(s), ${next.durationMs}ms`,
      });
      setConfirmOpen(false);
    } catch (error) {
      toast({
        title: 'Migration failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading Supabase → self-host migrate tool…
        </CardContent>
      </Card>
    );
  }

  if (!apiBase) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Copy from Supabase</CardTitle>
          <CardDescription>
            Set the <strong>Self-hosted API base URL</strong> above and apply it, or rebuild the web
            image with <code className="text-xs">VITE_API_BASE_URL</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={() => void loadMeta()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const phrase = meta?.confirmationPhrase || 'COPY FROM SUPABASE';
  const canSubmit =
    confirmation.trim() === phrase &&
    (includeAuth || includePublic || includeStorage) &&
    !running;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Copy from Supabase</CardTitle>
          <CardDescription>
            Admin-only. Pulls hosted Supabase Postgres data (and optionally Storage objects) into
            this self-hosted stack via <code className="text-xs">{apiBase}</code>. Requires Coolify
            env <code className="text-xs">MIGRATE_SOURCE_DATABASE_URL</code>
            {includeStorage ? (
              <>
                {' '}
                plus <code className="text-xs">SUPABASE_URL</code> /{' '}
                <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code>
              </>
            ) : null}
            . Schema must already exist on the target.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <CapabilityBadge label="Source DB" ok={Boolean(meta?.capability.dataConfigured)} />
            <CapabilityBadge label="Target DB" ok={Boolean(meta?.capability.targetConfigured)} />
            <CapabilityBadge
              label="Storage API"
              ok={Boolean(meta?.capability.storageConfigured)}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => void loadMeta()}>
              Refresh
            </Button>
          </div>

          {meta?.notes?.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {meta.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Capability metadata could not be loaded (you can still try a copy if the API is
              reachable). Use Refresh after fixing auth/CORS/env.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={dryRun} onCheckedChange={(v) => setDryRun(v === true)} />
              Dry run (count only, no writes)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includeAuth}
                onCheckedChange={(v) => setIncludeAuth(v === true)}
              />
              Copy auth.users + auth.identities
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includePublic}
                onCheckedChange={(v) => setIncludePublic(v === true)}
              />
              Copy public schema tables
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includeStorage}
                onCheckedChange={(v) => setIncludeStorage(v === true)}
              />
              Copy storage objects into volume
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={truncateFirst}
                onCheckedChange={(v) => setTruncateFirst(v === true)}
                disabled={dryRun}
              />
              Truncate target tables first (destructive)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={rewriteStorageUrls}
                onCheckedChange={(v) => setRewriteStorageUrls(v === true)}
                disabled={dryRun}
              />
              Rewrite profile avatar URLs to self-hosted API
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="migrate-confirm">
              Type <span className="font-mono">{phrase}</span> to enable
            </Label>
            <Input
              id="migrate-confirm"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={phrase}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setConfirmOpen(true)} disabled={!canSubmit}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {dryRun ? 'Run dry-run' : 'Start copy'}
            </Button>
            {/* Bypass dialog if Confirm ever fails to fire (debugging / accessibility). */}
            <Button
              type="button"
              variant="secondary"
              disabled={!canSubmit}
              onClick={() => void runMigrate()}
            >
              {dryRun ? 'Run dry-run now' : 'Copy now'}
            </Button>
          </div>

          {report ? (
            <div className="space-y-3 rounded-md border p-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{report.dryRun ? 'dry-run' : 'applied'}</Badge>
                <Badge variant="outline">{report.durationMs}ms</Badge>
                {report.urlRewrite ? (
                  <Badge variant="outline">
                    avatar URLs rewritten: {report.urlRewrite.updated}
                  </Badge>
                ) : null}
              </div>
              <div>
                <p className="mb-1 font-medium">Tables</p>
                <div className="max-h-48 overflow-auto font-mono text-xs">
                  {report.tables.map((row) => (
                    <div key={`${row.schema}.${row.table}`}>
                      {row.schema}.{row.table}: {row.action} ({row.rows}
                      {row.reason ? ` — ${row.reason}` : ''})
                    </div>
                  ))}
                </div>
              </div>
              {report.storage.length > 0 ? (
                <div>
                  <p className="mb-1 font-medium">Storage</p>
                  <div className="font-mono text-xs">
                    {report.storage.map((row) => (
                      <div key={row.bucket}>
                        {row.bucket}: {row.action} ({row.objects} objects
                        {row.errors ? `, ${row.errors} errors` : ''}
                        {row.reason ? ` — ${row.reason}` : ''})
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {report.warnings.length > 0 ? (
                <div>
                  <p className="mb-1 font-medium text-destructive">Warnings</p>
                  <ul className="max-h-32 list-disc overflow-auto pl-5 text-xs text-muted-foreground">
                    {report.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !running && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dryRun ? 'Run migration dry-run?' : 'Copy data from Supabase now?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dryRun
                ? 'No rows will be written. This only counts what would be copied.'
                : truncateFirst
                  ? 'This will TRUNCATE selected target tables, then insert from Supabase. Irreversible without a backup.'
                  : 'This will insert rows from Supabase (ON CONFLICT DO NOTHING). Existing rows are kept.'}
              {' '}
              Auth: {includeAuth ? 'yes' : 'no'}; public: {includePublic ? 'yes' : 'no'}; storage:{' '}
              {includeStorage ? 'yes' : 'no'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
            {/* Use a normal Button — AlertDialogAction + preventDefault was swallowing the click. */}
            <Button type="button" disabled={running} onClick={() => void runMigrate()}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
