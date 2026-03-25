import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronUp, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureFlags } from '@/contexts/FeatureFlagContext';
import { FEATURE_POKER_LOCAL_ADVISOR } from '@/constants/featureFlags';
import { usePokerTable } from '@/components/Neotro/PokerTableComponent/context';
import { usePokerLocalAdvisor } from '@/hooks/usePokerLocalAdvisor';
import { usePokerAdvisorPause } from '@/hooks/usePokerAdvisorPause';
import type { GameState } from '@/hooks/usePokerSession';
import { PokerLocalAdvisorDownload } from '@/components/account/PokerLocalAdvisorDownload';
import type { PokerAdvisorResponse } from '@/lib/pokerLocalAdvisor';

const COLLAPSE_KEY = 'poker-advisor-panel-collapsed';

function advisorPointsLabel(a: PokerAdvisorResponse): string {
  return a.abstain || a.points === -1 ? 'Abstain' : `${a.points} pts`;
}

/** Re-render periodically so "5 minutes ago" stays fresh. */
function useRelativeTimeTick(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, [active]);
}

export const PokerAdvisorPanel: React.FC = () => {
  const { flags, isFeatureEnabled, loading: flagsLoading } = useFeatureFlags();
  const globalFlagOn = flags[FEATURE_POKER_LOCAL_ADVISOR] === true;

  const { profile } = useAuth();
  const { displaySession, effectiveCurrentRound, teamId } = usePokerTable();
  const featureResolved = !flagsLoading && isFeatureEnabled(FEATURE_POKER_LOCAL_ADVISOR, { teamId });
  const tierBlocks = !flagsLoading && globalFlagOn && !featureResolved;
  const { paused, setPaused } = usePokerAdvisorPause();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const gameState = (displaySession?.game_state ?? 'Selection') as GameState;

  const advisor = usePokerLocalAdvisor({
    featureFlagOn: featureResolved,
    profile,
    teamId,
    currentRound: effectiveCurrentRound,
    gameState,
    paused,
  });

  const configured =
    !!profile?.poker_advisor_data_sharing_acknowledged_at &&
    !!(profile?.poker_advisor_base_url || '').trim() &&
    !!profile?.poker_advisor_enabled;

  const showSuggestionHeader =
    configured &&
    advisor.status === 'ok' &&
    advisor.advice &&
    advisor.adviceReceivedAt != null;

  useRelativeTimeTick(!!showSuggestionHeader);

  if (flagsLoading) {
    return (
      <div className="flex-shrink-0 border-t border-border/80 bg-card/80 px-3 py-2 text-xs text-muted-foreground">
        Loading advisor feature…
      </div>
    );
  }

  if (!featureResolved) {
    if (tierBlocks) {
      return (
        <div className="flex-shrink-0 border-t border-amber-500/30 bg-amber-500/5 px-3 py-2 space-y-2">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Poker advisor</span> is enabled globally but turned off for
            your subscription tier in billing/tier limits. Ask an admin to allow{' '}
            <code className="text-[10px]">poker_local_advisor</code> for your plan, or upgrade.
          </p>
          <PokerLocalAdvisorDownload variant="compact" />
        </div>
      );
    }
    return null;
  }

  return (
    <div className="flex-shrink-0 border-t border-border/80 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <button
        type="button"
        onClick={toggleCollapsed}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted/40"
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
            <span className="truncate">Private advisor (local CLI)</span>
            {showSuggestionHeader && advisor.advice && advisor.adviceReceivedAt != null && (
              <span className="text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400 shrink-0">
                {advisorPointsLabel(advisor.advice)} ·{' '}
                {formatDistanceToNow(new Date(advisor.adviceReceivedAt), { addSuffix: true })}
              </span>
            )}
          </span>
        </span>
        {collapsed ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 pt-0 space-y-2 max-h-[40vh] overflow-y-auto">
          {!configured ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Enable the advisor and set your local server URL in{' '}
                <Link to="/account" className="underline font-medium text-primary">
                  Account settings
                </Link>
                . Only you see suggestions; nothing is sent to teammates.
              </p>
              <PokerLocalAdvisorDownload variant="compact" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <PokerLocalAdvisorDownload variant="compact" />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Switch
                      id="poker-advisor-pause-panel"
                      checked={paused}
                      onCheckedChange={setPaused}
                      className="scale-90"
                    />
                    <Label htmlFor="poker-advisor-pause-panel" className="text-xs font-normal cursor-pointer">
                      Pause
                    </Label>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => advisor.refresh()}
                  disabled={advisor.status === 'loading' || paused}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${advisor.status === 'loading' ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {paused && (
                <p className="text-xs text-amber-700 dark:text-amber-500/90">
                  Local advisor is paused—Retroscope will not call your machine until you turn Pause off.
                </p>
              )}

              {advisor.requestsActive && advisor.status === 'loading' && (
                <p className="text-xs text-muted-foreground">Contacting your local advisor…</p>
              )}

              {advisor.requestsActive && advisor.status === 'error' && advisor.lastError && (
                <p className="text-xs text-destructive">
                  {advisor.lastError}
                  <span className="block text-muted-foreground mt-1">
                    Is the server running? From the downloaded folder run{' '}
                    <code className="text-[10px]">node server.mjs</code> (see INSTALL.md in the zip).
                  </span>
                </p>
              )}

              {advisor.status === 'ok' && advisor.advice && (
                <div className="rounded-md border bg-background/60 p-2 text-sm space-y-1">
                  <p className="leading-relaxed">
                    <span className="text-muted-foreground text-xs">Suggestion </span>
                    <span className="font-semibold tabular-nums">{advisorPointsLabel(advisor.advice)}</span>
                    {advisor.adviceReceivedAt != null && (
                      <span className="text-muted-foreground text-xs">
                        {' '}
                        ({formatDistanceToNow(new Date(advisor.adviceReceivedAt), { addSuffix: true })})
                      </span>
                    )}
                  </p>
                  {advisor.advice.reasoning ? (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {advisor.advice.reasoning}
                    </p>
                  ) : null}
                </div>
              )}

              {advisor.requestsActive && advisor.status === 'idle' && (
                <p className="text-xs text-muted-foreground">Waiting for ticket context…</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
