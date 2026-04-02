import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronUp, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Markdown } from '@/components/ui/markdown';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { JiraIssueDrawer } from '@/components/Neotro/JiraIssueDrawer';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureFlags } from '@/contexts/FeatureFlagContext';
import { FEATURE_POKER_LOCAL_ADVISOR } from '@/constants/featureFlags';
import { usePokerTable } from '@/components/Neotro/PokerTableComponent/context';
import { usePokerLocalAdvisor } from '@/hooks/usePokerLocalAdvisor';
import { usePokerLocalAdvisorContext } from '@/hooks/usePokerLocalAdvisorContext';
import { usePokerAdvisorPause } from '@/hooks/usePokerAdvisorPause';
import { usePokerAdvisorPrefetch } from '@/hooks/usePokerAdvisorPrefetch';
import { usePokerAdvisorEstimateSource } from '@/hooks/usePokerAdvisorEstimateSource';
import type { GameState } from '@/hooks/usePokerSession';
import { PokerLocalAdvisorDownload } from '@/components/account/PokerLocalAdvisorDownload';
import {
  normalizeSplitDetailsResponse,
  normalizeSplitDetailsUrl,
  type PokerAdvisorAdviceResponse,
  type PokerAdvisorQuestionsResponse,
  type PokerAdvisorResponse,
  type PokerAdvisorSplitDetailsRequestPayload,
  type StorySplit,
} from '@/lib/pokerLocalAdvisor';
import {
  buildPokerAdvisorRequestPayload,
  buildScopedTicketKeyBase,
  fetchRoundQa,
  hashQa,
} from '@/hooks/_pokerLocalAdvisorPayload';
import { getCachedSplitDetails, setCachedSplitDetails } from '@/lib/pokerAdvisorSplitDetailsCache';
import { mergeSplitDescriptionAfterCreate } from '@/lib/jiraSplitDescriptionMerge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const COLLAPSE_KEY = 'poker-advisor-panel-collapsed';
/** Delay after Jira create so automations can populate the new issue description before merge/update. */
const SPLIT_POST_CREATE_DELAY_MS = 4000;

type SplitDetailsCacheEntry =
  | { status: 'loading' }
  | { status: 'ok'; summary: string; description: string }
  | { status: 'error'; error: string };
const ADVISOR_QUESTION_TAG = '__advisor_question__';

function isAdvice(r: PokerAdvisorResponse): r is PokerAdvisorAdviceResponse {
  return r.mode === 'advice';
}

function isQuestions(r: PokerAdvisorResponse): r is PokerAdvisorQuestionsResponse {
  return r.mode === 'questions';
}

function advisorPointsLabel(a: PokerAdvisorAdviceResponse): string {
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

  const { profile, updateProfile } = useAuth();
  const { toast } = useToast();
  const {
    displaySession,
    effectiveCurrentRound,
    teamId,
    session,
    rounds,
    chatMessagesForRound,
    sendMessage,
    sendBotMessage,
    addTicketToQueue,
    isJiraConfigured,
  } = usePokerTable();
  const featureResolved = !flagsLoading && isFeatureEnabled(FEATURE_POKER_LOCAL_ADVISOR, { teamId });
  const tierBlocks = !flagsLoading && globalFlagOn && !featureResolved;
  const { paused, setPaused } = usePokerAdvisorPause();
  const { prefetchActiveTickets, setPrefetchActiveTickets } = usePokerAdvisorPrefetch();
  const { estimateSource, setEstimateSource } = usePokerAdvisorEstimateSource();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [draftBaseUrl, setDraftBaseUrl] = useState('');
  const [draftPersonalPrompt, setDraftPersonalPrompt] = useState('');
  const [sendingContextToChat, setSendingContextToChat] = useState(false);
  const [suggestionSectionOpen, setSuggestionSectionOpen] = useState(true);
  const [contextSectionOpen, setContextSectionOpen] = useState(true);

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const toBase64Utf8 = (s: string) => btoa(unescape(encodeURIComponent(s)));

  useEffect(() => {
    if (!profile) return;
    setDraftBaseUrl(profile.poker_advisor_base_url || '');
    setDraftPersonalPrompt(profile.poker_advisor_personal_prompt || '');
  }, [profile?.poker_advisor_base_url, profile?.poker_advisor_personal_prompt]);

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
    sessionId: session?.session_id ?? null,
    rounds,
    currentRound: effectiveCurrentRound,
    gameState,
    paused,
    prefetchActiveTickets,
    estimateFromContext: estimateSource === 'context',
  });

  const ticketContext = usePokerLocalAdvisorContext({
    featureFlagOn: featureResolved,
    profile,
    teamId,
    sessionId: session?.session_id ?? null,
    rounds,
    currentRound: effectiveCurrentRound,
    gameState,
    paused,
    prefetchActiveTickets,
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

  const showContextHeader =
    configured &&
    ticketContext.status === 'ok' &&
    ticketContext.context &&
    ticketContext.contextReceivedAt != null;

  useRelativeTimeTick(!!showSuggestionHeader);
  useRelativeTimeTick(!!showContextHeader);

  const existingAdvisorQuestionsById = useMemo(() => {
    const map = new Map<string, { messageId: string; question: string }>();
    for (const m of chatMessagesForRound) {
      if (m.user_name !== 'Advisor') continue;
      const raw = (m.message || '').trim();
      if (!raw.startsWith(ADVISOR_QUESTION_TAG)) continue;
      const rest = raw.slice(ADVISOR_QUESTION_TAG.length).trim();
      try {
        const o = JSON.parse(rest) as unknown;
        if (!o || typeof o !== 'object') continue;
        const r = o as Record<string, unknown>;
        const id = typeof r.id === 'string' ? r.id.trim() : '';
        const question = typeof r.question === 'string' ? r.question.trim() : '';
        if (!id || !question) continue;
        map.set(id, { messageId: m.id, question });
      } catch {
        continue;
      }
    }
    return map;
  }, [chatMessagesForRound]);

  const existingAnswersByQuestionMessageId = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of chatMessagesForRound) {
      if (!m.reply_to_message_id) continue;
      if (m.user_id == null) continue;
      const a = (m.message || '').trim();
      if (!a) continue;
      map.set(m.reply_to_message_id, a);
    }
    return map;
  }, [chatMessagesForRound]);

  const [draftAnswersByQid, setDraftAnswersByQid] = useState<Record<string, string>>({});
  const [splitDetailsCache, setSplitDetailsCache] = useState<Record<number, SplitDetailsCacheEntry>>({});
  const splitPrefetchVersion = useRef(0);
  const [splitPreview, setSplitPreview] = useState<{
    split: StorySplit;
    index: number;
    parentIssueKey: string;
    summary: string;
    description: string | Record<string, unknown>;
  } | null>(null);
  const [splitPreviewSubmitting, setSplitPreviewSubmitting] = useState(false);

  useEffect(() => {
    if (advisor.status !== 'ok' || !advisor.advice || !isQuestions(advisor.advice)) return;
    const next: Record<string, string> = {};
    for (const q of advisor.advice.questions) {
      const existing = existingAdvisorQuestionsById.get(q.id);
      if (!existing) continue;
      const ans = existingAnswersByQuestionMessageId.get(existing.messageId);
      if (ans) next[q.id] = ans;
    }
    setDraftAnswersByQid((prev) => ({ ...next, ...prev }));
  }, [advisor.status, advisor.advice, existingAdvisorQuestionsById, existingAnswersByQuestionMessageId]);

  /** Preemptively fetch split-details for every split suggestion when advice arrives. */
  useEffect(() => {
    if (!advisor.advice || !isAdvice(advisor.advice) || advisor.advice.splits.length === 0) {
      setSplitDetailsCache({});
      return;
    }
    if (!configured || paused || !effectiveCurrentRound || !session?.session_id || !teamId) {
      setSplitDetailsCache({});
      return;
    }
    const tk = (effectiveCurrentRound.ticket_number || '').trim();
    if (!tk || tk === '—') {
      setSplitDetailsCache({});
      return;
    }
    const baseUrl = (profile?.poker_advisor_base_url || '').trim();
    if (!baseUrl) {
      setSplitDetailsCache({});
      return;
    }

    const splits = advisor.advice.splits;
    const version = ++splitPrefetchVersion.current;

    (async () => {
      let basePayload: PokerAdvisorSplitDetailsRequestPayload;
      let cacheKeyFull: string;
      try {
        const qa = await fetchRoundQa(session.session_id, effectiveCurrentRound.round_number);
        if (splitPrefetchVersion.current !== version) return;
        basePayload = await buildPokerAdvisorRequestPayload({
          round: effectiveCurrentRound,
          gameState,
          profile,
          teamId,
          sessionId: session.session_id,
          qa,
          includeQa: true,
        }) as PokerAdvisorSplitDetailsRequestPayload;
        if (splitPrefetchVersion.current !== version) return;
        const cacheKeyBase = buildScopedTicketKeyBase({
          teamId,
          sessionId: session.session_id,
          ticketKey: tk,
        });
        const qaHash = hashQa(qa);
        cacheKeyFull = qa.length ? `${cacheKeyBase}|${qaHash}` : cacheKeyBase;
      } catch {
        if (splitPrefetchVersion.current !== version) return;
        setSplitDetailsCache((prev) => {
          const next = { ...prev };
          for (let i = 0; i < splits.length; i++) next[i] = { status: 'error', error: 'Could not build advisor payload' };
          return next;
        });
        return;
      }

      const initial: Record<number, SplitDetailsCacheEntry> = {};
      const indicesToFetch: number[] = [];
      for (let i = 0; i < splits.length; i++) {
        const split = splits[i];
        const hit = getCachedSplitDetails(cacheKeyFull, split.title, split.points ?? null);
        if (hit) {
          initial[i] = { status: 'ok', summary: hit.summary, description: hit.description };
        } else {
          initial[i] = { status: 'loading' };
          indicesToFetch.push(i);
        }
      }
      if (splitPrefetchVersion.current !== version) return;
      setSplitDetailsCache(initial);

      if (indicesToFetch.length === 0) return;

      await Promise.allSettled(
        indicesToFetch.map(async (index) => {
          const split = splits[index];
          const body: PokerAdvisorSplitDetailsRequestPayload = {
            ...basePayload,
            splitTitle: split.title,
            ...(split.points != null ? { splitPoints: split.points } : {}),
          };
          try {
            const splitRes = await fetch(normalizeSplitDetailsUrl(baseUrl), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            let splitRaw: unknown;
            try { splitRaw = await splitRes.json(); } catch { splitRaw = {}; }
            const details = normalizeSplitDetailsResponse(splitRaw);
            if (!details || details.error) throw new Error(details?.error || `Split details failed (${splitRes.status})`);
            if (splitPrefetchVersion.current !== version) return;
            setCachedSplitDetails(cacheKeyFull, split.title, split.points ?? null, {
              summary: details.summary,
              description: details.description,
            });
            setSplitDetailsCache((prev) => ({
              ...prev,
              [index]: { status: 'ok', summary: details.summary, description: details.description },
            }));
          } catch (e) {
            if (splitPrefetchVersion.current !== version) return;
            setSplitDetailsCache((prev) => ({
              ...prev,
              [index]: { status: 'error', error: e instanceof Error ? e.message : String(e) },
            }));
          }
        }),
      );
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advisor.adviceReceivedAt]);

  const handleConfirmSplitStoryCreate = useCallback(async (overrides?: { summary?: string; description?: string }) => {
    if (!splitPreview || !teamId || !isJiraConfigured || !effectiveCurrentRound) return;
    const { parentIssueKey } = splitPreview;
    const sum = (overrides?.summary ?? splitPreview.summary).trim();
    const description = overrides?.description ?? splitPreview.description;
    if (!sum) {
      toast({ title: 'Summary is required', variant: 'destructive' });
      return;
    }
    setSplitPreviewSubmitting(true);
    let newKey = '';
    try {
      const { data, error } = await supabase.functions.invoke('create-jira-issue', {
        body: { teamId, summary: sum, splitFromIssueKey: parentIssueKey },
      });
      if (error) throw error;
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(String((data as { error?: string }).error));
      }
      newKey =
        data && typeof data === 'object' && 'key' in data ? String((data as { key?: string }).key) : '';
      if (!newKey) throw new Error('No issue key returned');

      await new Promise((r) => setTimeout(r, SPLIT_POST_CREATE_DELAY_MS));

      let descOk = true;
      try {
        const { data: issueData, error: getErr } = await supabase.functions.invoke('get-jira-issue-v3', {
          body: { teamId, issueIdOrKey: newKey },
        });
        if (getErr) throw getErr;
        if (issueData && typeof issueData === 'object' && 'error' in issueData && issueData.error) {
          throw new Error(String((issueData as { error?: string }).error));
        }
        const fields =
          issueData && typeof issueData === 'object' && 'fields' in issueData
            ? (issueData as { fields?: { description?: unknown } }).fields
            : undefined;
        const descriptionAdf = mergeSplitDescriptionAfterCreate(fields?.description, description, parentIssueKey);
        const { data: updData, error: updErr } = await supabase.functions.invoke('update-jira-issue-v2', {
          body: { teamId, issueKey: newKey, descriptionAdf },
        });
        if (updErr) throw updErr;
        if (updData && typeof updData === 'object' && 'error' in updData && updData.error) {
          throw new Error(String((updData as { error?: string }).error));
        }
      } catch {
        descOk = false;
        toast({
          title: `Created ${newKey}`,
          description:
            'Issue was created but the description could not be updated automatically. Edit it in Jira.',
          variant: 'destructive',
        });
      }

      const parent = effectiveCurrentRound.ticket_parent_key
        ? {
            key: effectiveCurrentRound.ticket_parent_key,
            summary: effectiveCurrentRound.ticket_parent_summary || '',
          }
        : null;
      await addTicketToQueue(newKey, sum, parent);
      if (descOk) {
        toast({ title: `Created ${newKey}` });
      }
      setSplitPreview(null);
    } catch (e) {
      toast({
        title: 'Could not create split story',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setSplitPreviewSubmitting(false);
    }
  }, [
    splitPreview,
    teamId,
    isJiraConfigured,
    effectiveCurrentRound,
    toast,
    addTicketToQueue,
  ]);

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
      {splitPreview != null && (
        <JiraIssueDrawer
          issueIdOrKey={null}
          teamId={teamId}
          previewIssue={{ summary: splitPreview.summary, description: splitPreview.description }}
          open
          onOpenChange={(o) => { if (!o && !splitPreviewSubmitting) setSplitPreview(null); }}
          onCreateInJira={({ summary, description }) => void handleConfirmSplitStoryCreate({ summary, description })}
          createInJiraLoading={splitPreviewSubmitting}
        />
      )}

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
          {collapsed && advisor.requestsActive && advisor.status === 'loading' && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0" role="status" aria-label="Contacting local advisor">
              <RefreshCw className="h-3 w-3 animate-spin" />
            </span>
          )}
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
                <div className="flex items-center gap-2 shrink-0">
                  <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
                        Settings
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Private advisor settings</DialogTitle>
                      </DialogHeader>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <Label htmlFor="poker-advisor-prefetch" className="cursor-pointer">
                              Queue all active tickets
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              When on, your browser may call your local advisor in advance for other active rounds.
                              When off, it only runs for the current ticket.
                            </p>
                          </div>
                          <Switch
                            id="poker-advisor-prefetch"
                            checked={prefetchActiveTickets}
                            onCheckedChange={setPrefetchActiveTickets}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <Label htmlFor="poker-advisor-estimate-from-context" className="cursor-pointer">
                              Use gathered context for point suggestions
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              When on, point suggestions come from <code className="text-[10px]">POST /context</code> (context + points).
                              When off, suggestions use ticket description only via <code className="text-[10px]">POST /advise</code>.
                            </p>
                          </div>
                          <Switch
                            id="poker-advisor-estimate-from-context"
                            checked={estimateSource === 'context'}
                            onCheckedChange={(v) => setEstimateSource(v ? 'context' : 'description')}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="poker-advisor-url-inline">Local server base URL</Label>
                          <Input
                            id="poker-advisor-url-inline"
                            placeholder="http://127.0.0.1:17300"
                            value={draftBaseUrl}
                            onChange={(e) => setDraftBaseUrl(e.target.value)}
                            autoComplete="off"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="poker-advisor-personal-prompt-inline">Personal advisor instructions</Label>
                          <Textarea
                            id="poker-advisor-personal-prompt-inline"
                            value={draftPersonalPrompt}
                            onChange={(e) => setDraftPersonalPrompt(e.target.value)}
                            rows={4}
                            className="font-mono text-sm min-h-[96px]"
                            placeholder="Optional instructions sent with each /advise request…"
                          />
                        </div>
                      </div>

                      <DialogFooter>
                        <Button
                          type="button"
                          onClick={async () => {
                            if (!profile) return;
                            setSettingsSaving(true);
                            try {
                              await updateProfile({
                                poker_advisor_base_url: draftBaseUrl.trim() || null,
                                poker_advisor_personal_prompt: draftPersonalPrompt.trim() || null,
                              });
                              setSettingsOpen(false);
                            } finally {
                              setSettingsSaving(false);
                            }
                          }}
                          disabled={settingsSaving}
                        >
                          {settingsSaving ? 'Saving…' : 'Save'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => advisor.refresh()}
                    disabled={advisor.status === 'loading' || paused}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${advisor.status === 'loading' ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
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
                <Collapsible
                  open={suggestionSectionOpen}
                  onOpenChange={setSuggestionSectionOpen}
                  className="rounded-md border bg-background/60 p-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 rounded py-0.5 text-left transition-colors hover:bg-muted/40"
                      >
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${suggestionSectionOpen ? '' : '-rotate-90'}`}
                          aria-hidden
                        />
                        <span className="min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 leading-relaxed">
                          <span className="text-muted-foreground text-xs">Suggestion</span>
                          <span className="font-semibold tabular-nums">
                            {isAdvice(advisor.advice) ? advisorPointsLabel(advisor.advice) : '—'}
                          </span>
                          {advisor.adviceReceivedAt != null && (
                            <span className="text-muted-foreground text-xs">
                              ({formatDistanceToNow(new Date(advisor.adviceReceivedAt), { addSuffix: true })})
                            </span>
                          )}
                          {isAdvice(advisor.advice) ? (
                            <span className="text-muted-foreground text-xs">
                              ·{' '}
                              {advisor.advice.splits.length === 0
                                ? 'No splits'
                                : `${advisor.advice.splits.length} suggested ${
                                    advisor.advice.splits.length === 1 ? 'split' : 'splits'
                                  }`}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </CollapsibleTrigger>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 text-xs"
                      onClick={() => advisor.refresh()}
                      disabled={advisor.status === 'loading' || paused}
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${advisor.status === 'loading' ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                  <CollapsibleContent className="space-y-1 pt-2">
                    {isAdvice(advisor.advice) && advisor.advice.reasoning ? (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {advisor.advice.reasoning}
                      </p>
                    ) : null}
                    {isAdvice(advisor.advice) ? (
                      <div className="pt-2 border-t border-border/60 space-y-1.5">
                        <p className="text-xs font-medium text-foreground">Split suggestions</p>
                        {advisor.advice.splits.length === 0 ? (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            None — advisor recommends keeping this as a single story.
                          </p>
                        ) : (
                          <ul className="space-y-2 list-none m-0 p-0">
                            {advisor.advice.splits.map((s, i) => (
                              <li
                                key={`${i}-${s.title.slice(0, 40)}`}
                                className="flex flex-col gap-1 text-xs text-muted-foreground"
                              >
                                <div className="flex items-start gap-2">
                                  <span className="text-foreground font-medium shrink-0 tabular-nums">{i + 1}.</span>
                                  <span className="flex-1 min-w-0 leading-relaxed">{s.title}</span>
                                  {s.points != null ? (
                                    <span className="shrink-0 tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                                      {s.points} pts
                                    </span>
                                  ) : null}
                                </div>
                                <div className="pl-5 flex items-center gap-2">
                                  {(() => {
                                    const cached = splitDetailsCache[i];
                                    const isLoading = !cached || cached.status === 'loading';
                                    const isError = cached?.status === 'error';
                                    const tk = (effectiveCurrentRound?.ticket_number || '').trim();
                                    return (
                                      <>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="secondary"
                                          className="h-7 text-xs"
                                          disabled={
                                            !configured || paused || !teamId || !isJiraConfigured ||
                                            isLoading || splitPreview !== null || splitPreviewSubmitting
                                          }
                                          onClick={() => {
                                            if (cached?.status !== 'ok') return;
                                            setSplitPreview({
                                              split: s,
                                              index: i,
                                              parentIssueKey: tk,
                                              summary: cached.summary,
                                              description: cached.description,
                                            });
                                          }}
                                        >
                                          {isLoading ? (
                                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                          ) : null}
                                          {isLoading ? 'Preparing…' : 'Create story'}
                                        </Button>
                                        {isError && (
                                          <span className="text-[10px] text-destructive" title={(cached as { status: 'error'; error: string }).error}>
                                            Preview unavailable
                                          </span>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {configured && (
                <Collapsible
                  open={contextSectionOpen}
                  onOpenChange={setContextSectionOpen}
                  className="rounded-md border bg-background/60 p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 rounded py-0.5 text-left transition-colors hover:bg-muted/40"
                      >
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${contextSectionOpen ? '' : '-rotate-90'}`}
                          aria-hidden
                        />
                        <span className="text-xs font-medium text-foreground">
                          Context
                          {ticketContext.contextReceivedAt != null && (
                            <span className="font-normal text-muted-foreground">
                              {' '}
                              ({formatDistanceToNow(new Date(ticketContext.contextReceivedAt), { addSuffix: true })})
                            </span>
                          )}
                        </span>
                      </button>
                    </CollapsibleTrigger>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 text-xs"
                      onClick={() => ticketContext.refresh()}
                      disabled={ticketContext.status === 'loading' || paused}
                    >
                      <RefreshCw
                        className={`h-3 w-3 mr-1 ${ticketContext.status === 'loading' ? 'animate-spin' : ''}`}
                      />
                      Refresh context
                    </Button>
                  </div>

                  <CollapsibleContent className="space-y-2 pt-2">
                    <div className="flex items-center justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={
                          paused ||
                          sendingContextToChat ||
                          ticketContext.status !== 'ok' ||
                          !(ticketContext.context?.context || '').trim()
                        }
                        onClick={async () => {
                          const raw = (ticketContext.context?.context || '').trim();
                          if (!raw) return;
                          setSendingContextToChat(true);
                          try {
                            const clipped = raw.slice(0, 12000);
                            const payload = toBase64Utf8(clipped);
                            const html = [
                              '<div style="display:flex;align-items:center;gap:8px;">',
                              '<strong>Advisor context</strong>',
                              `<button style="cursor:pointer;padding:6px 10px;border-radius:8px;border:1px solid rgba(120,120,120,0.35);background:transparent;" onclick="window.showAdvisorContext('${escapeHtml(payload)}')">View</button>`,
                              '</div>',
                            ].join('');
                            await sendBotMessage('Advisor', html);
                          } finally {
                            setSendingContextToChat(false);
                          }
                        }}
                      >
                        {sendingContextToChat ? 'Sending…' : 'Send to chat'}
                      </Button>
                    </div>

                    {ticketContext.requestsActive && ticketContext.status === 'loading' && (
                      <p className="text-xs text-muted-foreground">Gathering ticket context…</p>
                    )}

                    {ticketContext.requestsActive && ticketContext.status === 'error' && ticketContext.lastError && (
                      <p className="text-xs text-destructive">
                        {ticketContext.lastError}
                        <span className="block text-muted-foreground mt-1">
                          Your local advisor may be running an older server without <code className="text-[10px]">POST /context</code>.
                        </span>
                      </p>
                    )}

                    {ticketContext.status === 'ok' && ticketContext.context?.context?.trim() ? (
                      <Markdown className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                        {ticketContext.context.context}
                      </Markdown>
                    ) : ticketContext.status === 'ok' ? (
                      <p className="text-xs text-muted-foreground">No context returned yet.</p>
                    ) : null}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {advisor.status === 'ok' && advisor.advice && isQuestions(advisor.advice) && (
                <div className="rounded-md border bg-background/60 p-2 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    The advisor needs a bit more info before estimating.
                  </p>
                  <div className="space-y-2">
                    {advisor.advice.questions.map((q) => {
                      const existing = existingAdvisorQuestionsById.get(q.id);
                      const existingAnswer =
                        existing ? existingAnswersByQuestionMessageId.get(existing.messageId) : undefined;
                      const value = draftAnswersByQid[q.id] ?? existingAnswer ?? '';
                      return (
                        <div key={q.id} className="space-y-1">
                          <p className="text-xs font-medium text-foreground">{q.question}</p>
                          <Input
                            value={value}
                            onChange={(e) =>
                              setDraftAnswersByQid((prev) => ({ ...prev, [q.id]: e.target.value }))
                            }
                            placeholder="Type your answer…"
                            className="h-8 text-xs"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={async () => {
                        // Persist advisor questions (if missing), then persist answers as replies, then refresh.
                        const insertedMessageIdsByQid = new Map<string, string>();
                        for (const q of advisor.advice.questions) {
                          if (!existingAdvisorQuestionsById.has(q.id)) {
                            const insertedId = await sendBotMessage(
                              'Advisor',
                              `${ADVISOR_QUESTION_TAG} ${JSON.stringify({ id: q.id, question: q.question })}`,
                            );
                            if (insertedId) insertedMessageIdsByQid.set(q.id, insertedId);
                          }
                        }
                        for (const q of advisor.advice.questions) {
                          const m = existingAdvisorQuestionsById.get(q.id);
                          const replyToId = m?.messageId ?? insertedMessageIdsByQid.get(q.id);
                          const answer = (draftAnswersByQid[q.id] || '').trim();
                          if (!replyToId || !answer) continue;
                          await sendMessage(answer, replyToId);
                        }
                        advisor.refresh();
                      }}
                      disabled={paused || advisor.status === 'loading'}
                    >
                      Submit answers
                    </Button>
                  </div>
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
