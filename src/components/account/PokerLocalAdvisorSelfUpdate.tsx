import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { usePokerLocalAdvisorSelfUpdate } from '@/hooks/usePokerLocalAdvisorSelfUpdate';
import { POKER_ADVISOR_DEFAULT_UPDATE_ORIGIN } from '@/constants/pokerLocalAdvisorDownload';
import type { PokerLocalAdvisorUpdateChannel } from '@/lib/pokerLocalAdvisor';

type Props = {
  baseUrl: string;
  /** Tighter layout for the session advisor panel */
  compact?: boolean;
};

export const PokerLocalAdvisorSelfUpdate: React.FC<Props> = ({ baseUrl, compact }) => {
  const { toast } = useToast();
  const {
    channel,
    setChannel,
    checking,
    installing,
    checkResult,
    lastError,
    clearError,
    check,
    install,
  } = usePokerLocalAdvisorSelfUpdate(baseUrl);

  const handleCheck = async () => {
    clearError();
    const r = await check();
    if (!r) return;
    toast({
      title: r.updateAvailable ? 'Update available' : 'Advisor is up to date',
      description: r.updateAvailable
        ? `Remote ${r.remoteChannel} ${r.remoteVersion} is newer than your ${r.currentVersion}.`
        : `You are on ${r.currentVersion} (channel: ${r.remoteChannel}).`,
    });
  };

  const handleInstall = async () => {
    clearError();
    const r = await install();
    if (!r) return;
    if (r.alreadyLatest) {
      toast({ title: 'Already up to date', description: `Version ${r.newVersion}.` });
      return;
    }
    toast({
      title: 'Advisor updated',
      description: r.restartRequired
        ? `Installed ${r.newVersion}. Restart the local server (stop and run node server.mjs again), unless you enabled POKER_ADVISOR_AUTO_RESTART=1.`
        : `Now on ${r.newVersion}.`,
    });
  };

  const disabled = !baseUrl.trim();
  const channelId = compact ? 'poker-advisor-update-channel-panel' : 'poker-advisor-update-channel';

  const controls = (
    <div className={compact ? 'flex flex-wrap items-center gap-2' : 'flex flex-wrap gap-2'}>
      <Button
        type="button"
        variant="secondary"
        size={compact ? 'sm' : 'sm'}
        className={compact ? 'h-7 text-xs' : undefined}
        onClick={() => void handleCheck()}
        disabled={disabled || checking || installing}
      >
        {checking ? 'Checking…' : 'Check for updates'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size={compact ? 'sm' : 'sm'}
        className={compact ? 'h-7 text-xs' : undefined}
        onClick={() => void handleInstall()}
        disabled={disabled || checking || installing}
      >
        {installing ? 'Installing…' : 'Install update'}
      </Button>
    </div>
  );

  if (compact) {
    return (
      <div className="flex flex-col gap-1.5 w-full min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={channel}
            onValueChange={(v) => setChannel(v as PokerLocalAdvisorUpdateChannel)}
            disabled={disabled || checking || installing}
          >
            <SelectTrigger id={channelId} className="h-7 text-xs w-[130px]">
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stable">Stable</SelectItem>
              <SelectItem value="nightly">Nightly</SelectItem>
            </SelectContent>
          </Select>
          {controls}
        </div>
        {checkResult && (
          <p className="text-[10px] text-muted-foreground font-mono truncate" title={checkResult.updateOrigin}>
            Local v{checkResult.currentVersion} · remote v{checkResult.remoteVersion}
            {checkResult.updateAvailable ? ' · update available' : ''}
          </p>
        )}
        {lastError && <p className="text-[10px] text-destructive break-words">{lastError}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="space-y-1">
        <Label htmlFor={channelId}>Advisor update channel</Label>
        <p className="text-xs text-muted-foreground">
          Update host order on the local advisor:{' '}
          <code className="text-[11px]">POKER_ADVISOR_UPDATE_ORIGIN</code> if set, else your browser&apos;s{' '}
          <code className="text-[11px]">Origin</code>, else{' '}
          <code className="text-[11px] break-all">{POKER_ADVISOR_DEFAULT_UPDATE_ORIGIN}</code> (for{' '}
          <code className="text-[11px]">poker-local-advisor-manifest.json</code> and the zip).
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5 w-[200px]">
          <Select
            value={channel}
            onValueChange={(v) => setChannel(v as PokerLocalAdvisorUpdateChannel)}
            disabled={disabled || checking || installing}
          >
            <SelectTrigger id={channelId}>
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stable">Stable</SelectItem>
              <SelectItem value="nightly">Nightly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {controls}
      </div>
      {checkResult && (
        <p className="text-xs text-muted-foreground">
          Local <span className="font-mono">{checkResult.currentVersion}</span> · remote{' '}
          <span className="font-mono">{checkResult.remoteVersion}</span>
          {checkResult.updateAvailable ? (
            <span className="text-amber-700 dark:text-amber-400"> · update available</span>
          ) : (
            <span> · up to date for this channel</span>
          )}
        </p>
      )}
      {lastError && <p className="text-xs text-destructive">{lastError}</p>}
    </div>
  );
};
