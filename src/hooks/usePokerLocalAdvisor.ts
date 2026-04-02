import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Profile } from '@/hooks/useAuth';
import type { GameState } from '@/hooks/usePokerSession';
import type { PokerSessionRound } from '@/hooks/usePokerSessionHistory';
import { supabase } from '@/integrations/supabase/client';
import {
  normalizeContextUrl,
  normalizeContextResponse,
  normalizeAdviseUrl,
  normalizeAdvisorResponse,
  type PokerAdvisorRequestPayload,
  type PokerAdvisorQAItem,
  type PokerAdvisorResponse,
} from '@/lib/pokerLocalAdvisor';
import {
  getCachedAdviceForTicket,
  getInFlightAdviceForTicket,
  invalidateAdviceCacheForTicket,
  setInFlightAdviceForTicket,
  setCachedAdviceForTicket,
} from '@/lib/pokerAdvisorCache';
import { invalidateSplitDetailsCacheForTicket } from '@/lib/pokerAdvisorSplitDetailsCache';
import { isSyntheticRoundTicket } from '@/lib/pokerRoundTicketPlaceholder';
import {
  buildPokerAdvisorRequestPayload,
  buildScopedTicketKeyBase,
  fetchRoundQa,
  hashQa,
} from '@/hooks/_pokerLocalAdvisorPayload';
import {
  getCachedContextForTicket,
  getInFlightContextForTicket,
  setCachedContextForTicket,
  setInFlightContextForTicket,
} from '@/lib/pokerAdvisorContextCache';

const DEBOUNCE_MS = 450;

export function usePokerLocalAdvisor(options: {
  featureFlagOn: boolean;
  profile: Profile | null;
  teamId: string | undefined;
  /** Poker session id — scopes the active-ticket prefetch queue. */
  sessionId: string | null | undefined;
  /** All rounds for the session — used to enqueue active tickets and resolve queue items. */
  rounds: PokerSessionRound[];
  currentRound: PokerSessionRound | null;
  gameState: GameState;
  /** When true, no /advise requests are made (browser-local; see usePokerAdvisorPause). */
  paused: boolean;
  /** When false, advisor only runs for the currently viewed ticket (no active-ticket prefetch). */
  prefetchActiveTickets: boolean;
  /** When true, estimates come from POST /context (which must include points+reasoning). */
  estimateFromContext: boolean;
}) {
  const {
    featureFlagOn,
    profile,
    teamId,
    sessionId,
    rounds,
    currentRound,
    gameState,
    paused,
    prefetchActiveTickets,
    estimateFromContext,
  } = options;

  const enabled =
    !!featureFlagOn &&
    !!profile?.poker_advisor_enabled &&
    !!profile?.poker_advisor_data_sharing_acknowledged_at &&
    !!(profile?.poker_advisor_base_url || '').trim();

  const baseUrl = (profile?.poker_advisor_base_url || '').trim();
  const sid = sessionId?.trim() || null;

  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [advice, setAdvice] = useState<PokerAdvisorResponse | null>(null);
  /** Epoch ms when the current `advice` was received (from network or cache). */
  const [adviceReceivedAt, setAdviceReceivedAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const ticketKey = (currentRound?.ticket_number || '').trim() || '—';
  const roundId = currentRound?.id ?? '';
  const roundNumber = currentRound?.round_number ?? 1;

  const stableKey = useMemo(
    () => `${roundId}|${ticketKey}|${gameState}`,
    [roundId, ticketKey, gameState],
  );

  /** Latest round context — compared after async work so stale responses are dropped. */
  const liveStableKeyRef = useRef(stableKey);
  liveStableKeyRef.current = stableKey;

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const viewingRoundIdRef = useRef<string | null>(null);
  const viewingTicketKeyRef = useRef('');
  viewingRoundIdRef.current = currentRound?.id ?? null;
  viewingTicketKeyRef.current = ticketKey;

  const roundsRef = useRef(rounds);
  roundsRef.current = rounds;

  const prefetchQueueRef = useRef<string[]>([]);
  /** Per round id, last ticket key we queued — re-queue when the ticket on an active round changes. */
  const lastQueuedTicketByRoundRef = useRef<Map<string, string>>(new Map());
  const drainingPrefetchRef = useRef(false);

  const runAdvisorNetworkOnce = useCallback(
    (
      round: PokerSessionRound,
      payloadGameState: GameState,
      qa: PokerAdvisorQAItem[],
      cacheKeyBase: string,
      cacheKeyFull: string,
    ) => {
      const tk = (round.ticket_number || '').trim();
      const rid = round.id;
      const rnum = round.round_number;

      return (async () => {
        const payload: PokerAdvisorRequestPayload = await buildPokerAdvisorRequestPayload({
          round,
          gameState: payloadGameState,
          profile,
          teamId,
          sessionId: sessionId?.trim() || null,
          qa,
          includeQa: !estimateFromContext,
        });

        const url = estimateFromContext ? normalizeContextUrl(baseUrl) : normalizeAdviseUrl(baseUrl);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        let parsed: unknown;
        try {
          parsed = text ? JSON.parse(text) : {};
        } catch {
          throw new Error('Local advisor did not return valid JSON.');
        }
        if (!res.ok) {
          const errMsg =
            typeof parsed === 'object' && parsed && 'error' in parsed && typeof (parsed as { error?: string }).error === 'string'
              ? (parsed as { error: string }).error
              : `HTTP ${res.status}`;
          throw new Error(errMsg);
        }

        let norm: PokerAdvisorResponse | null = null;
        if (estimateFromContext) {
          const ctx = normalizeContextResponse(parsed);
          if (!ctx || ctx.error) {
            throw new Error(ctx?.error || 'Invalid response');
          }
          // Share the /context response via the context cache so the Context panel can reuse it.
          setCachedContextForTicket(cacheKeyFull, ctx, Date.now());
          setCachedContextForTicket(cacheKeyBase, ctx, Date.now());
          if (typeof ctx.points === 'number' && Number.isFinite(ctx.points) && typeof ctx.reasoning === 'string') {
            norm = {
              mode: 'advice',
              points: ctx.points,
              reasoning: ctx.reasoning,
              abstain: ctx.abstain === true,
              splits: ctx.splits,
            };
          } else {
            throw new Error('Context response did not include points/reasoning.');
          }
        } else {
          norm = normalizeAdvisorResponse(parsed);
          if (!norm || norm.error) {
            throw new Error(norm?.error || 'Invalid response');
          }
        }

        const receivedAt = Date.now();
        setCachedAdviceForTicket(cacheKeyFull, norm, receivedAt);
        setCachedAdviceForTicket(cacheKeyBase, norm, receivedAt);
        return { advice: norm, receivedAt };
      })();
    },
    [baseUrl, teamId, profile, sessionId, estimateFromContext],
  );

  const runFetch = useCallback(
    async (forceRefresh = false) => {
      const fetchForKey = stableKey;

      if (!enabled || !baseUrl) {
        setStatus('idle');
        setAdvice(null);
        setAdviceReceivedAt(null);
        setLastError(null);
        return;
      }

      if (pausedRef.current) {
        setStatus('idle');
        setLastError(null);
        return;
      }

      if (!currentRound) {
        return;
      }

      const qa = sid ? await fetchRoundQa(sid, roundNumber) : [];
      const qaHash = hashQa(qa);
      const cacheKeyBase = buildScopedTicketKeyBase({ teamId, sessionId: sid, ticketKey });
      const cacheKeyFull = qa.length ? `${cacheKeyBase}|${qaHash}` : cacheKeyBase;

      if (estimateFromContext && !forceRefresh) {
        // If /context is already in-flight (from the Context panel), wait on it to avoid a second request.
        const inFlightCtx = getInFlightContextForTicket(cacheKeyFull);
        if (inFlightCtx) {
          setStatus('loading');
          setLastError(null);
          try {
            const { context: ctx, receivedAt } = await inFlightCtx;
            if (pausedRef.current) return;
            if (fetchForKey !== liveStableKeyRef.current) return;
            if (ctx.roundId && ctx.roundId !== roundId) return;
            if (typeof ctx.points === 'number' && Number.isFinite(ctx.points) && typeof ctx.reasoning === 'string') {
              const norm: PokerAdvisorResponse = {
                mode: 'advice',
                points: ctx.points,
                reasoning: ctx.reasoning,
                abstain: ctx.abstain === true,
                splits: ctx.splits,
              };
              setAdvice(norm);
              setAdviceReceivedAt(receivedAt);
              setStatus('ok');
              setLastError(null);
              // Mirror into advice cache for consistency.
              setCachedAdviceForTicket(cacheKeyFull, norm, receivedAt);
              setCachedAdviceForTicket(cacheKeyBase, norm, receivedAt);
              return;
            }
          } catch (e) {
            // fall through to normal path
          }
        }
      }

      if (!forceRefresh) {
        const hit = getCachedAdviceForTicket(cacheKeyFull) ?? getCachedAdviceForTicket(cacheKeyBase);
        if (hit) {
          setAdvice(hit.advice);
          setAdviceReceivedAt(hit.receivedAt);
          setStatus('ok');
          setLastError(null);
          return;
        }

        const inFlight = getInFlightAdviceForTicket(cacheKeyFull) ?? getInFlightAdviceForTicket(cacheKeyBase);
        if (inFlight) {
          setStatus('loading');
          setLastError(null);
          try {
            const { advice: norm, receivedAt } = await inFlight;
            if (pausedRef.current) return;
            if (fetchForKey !== liveStableKeyRef.current) return;
            if (norm.roundId && norm.roundId !== roundId) return;
            setAdvice(norm);
            setAdviceReceivedAt(receivedAt);
            setStatus('ok');
          } catch (e) {
            if (pausedRef.current) return;
            if (fetchForKey !== liveStableKeyRef.current) {
              return;
            }
            setAdvice(null);
            setAdviceReceivedAt(null);
            setLastError(e instanceof Error ? e.message : 'Request failed');
            setStatus('error');
          }
          return;
        }
      }

      // Don't start network calls for non-active/history tickets.
      // Cached/in-flight responses are still handled above; manual refresh (forceRefresh=true) can override.
      if (!forceRefresh && !currentRound.is_active) {
        setStatus('idle');
        setLastError(null);
        return;
      }

      setStatus('loading');
      setLastError(null);

      const requestPromise = runAdvisorNetworkOnce(currentRound, gameState, qa, cacheKeyBase, cacheKeyFull);

      setInFlightAdviceForTicket(cacheKeyFull, requestPromise);
      if (estimateFromContext) {
        // Also track /context inflight so the Context panel and advisor share the same network work.
        setInFlightContextForTicket(
          cacheKeyFull,
          requestPromise.then(({ advice, receivedAt }) => {
            const ctx = getCachedContextForTicket(cacheKeyFull) ?? getCachedContextForTicket(cacheKeyBase);
            if (ctx) return { context: ctx.context, receivedAt };
            // Minimal fallback: synthesize empty context so inflight resolves.
            return { context: { mode: 'context', context: '', ...(advice.mode === 'advice' ? advice : {}) }, receivedAt };
          }),
        );
      }

      try {
        const { advice: norm, receivedAt } = await requestPromise;
        if (pausedRef.current) return;
        if (fetchForKey !== liveStableKeyRef.current) return;
        if (norm.roundId && norm.roundId !== roundId) return;
        setAdvice(norm);
        setAdviceReceivedAt(receivedAt);
        setStatus('ok');
      } catch (e) {
        if (pausedRef.current) return;
        if (fetchForKey !== liveStableKeyRef.current) return;
        setAdvice(null);
        setAdviceReceivedAt(null);
        setLastError(e instanceof Error ? e.message : 'Request failed');
        setStatus('error');
      }
    },
    [
      enabled,
      baseUrl,
      currentRound,
      gameState,
      stableKey,
      roundId,
      ticketKey,
      runAdvisorNetworkOnce,
    ],
  );

  const drainPrefetchQueue = useCallback(async () => {
    if (!enabled || !baseUrl || pausedRef.current) return;
    if (drainingPrefetchRef.current) return;
    drainingPrefetchRef.current = true;
    try {
      while (prefetchQueueRef.current.length > 0) {
        const rid = prefetchQueueRef.current.shift()!;
        const round = roundsRef.current.find((r) => r.id === rid);
        if (!round?.is_active) continue;
        const tk = (round.ticket_number || '').trim();
        if (!tk || isSyntheticRoundTicket(tk)) continue;
        // Prefetch ignores Q&A context (best-effort); cache keys are scoped by ticketKey only here.
        const prefetchKeyBase = buildScopedTicketKeyBase({ teamId, sessionId: sid, ticketKey: tk });
        if (getCachedAdviceForTicket(prefetchKeyBase)) continue;
        if (getInFlightAdviceForTicket(prefetchKeyBase)) continue;

        const requestPromise = runAdvisorNetworkOnce(round, round.game_state, [], prefetchKeyBase, prefetchKeyBase);
        setInFlightAdviceForTicket(prefetchKeyBase, requestPromise);

        try {
          const { advice: norm, receivedAt } = await requestPromise;
          if (pausedRef.current) continue;
          if (viewingRoundIdRef.current !== round.id) continue;
          if (viewingTicketKeyRef.current !== tk) continue;
          if (norm.roundId && norm.roundId !== round.id) continue;
          setAdvice(norm);
          setAdviceReceivedAt(receivedAt);
          setStatus('ok');
          setLastError(null);
        } catch (e) {
          if (pausedRef.current) continue;
          if (viewingRoundIdRef.current !== round.id) continue;
          if (viewingTicketKeyRef.current !== tk) continue;
          setAdvice(null);
          setAdviceReceivedAt(null);
          setLastError(e instanceof Error ? e.message : 'Request failed');
          setStatus('error');
        }
      }
    } finally {
      drainingPrefetchRef.current = false;
    }
  }, [enabled, baseUrl, runAdvisorNetworkOnce, teamId, sid]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    prefetchQueueRef.current = [];
    lastQueuedTicketByRoundRef.current.clear();
  }, [sid]);

  useEffect(() => {
    if (!prefetchActiveTickets) return;
    if (!enabled || !sid) return;

    for (const r of rounds) {
      if (!r.is_active) continue;
      const tk = (r.ticket_number || '').trim();
      if (!tk || isSyntheticRoundTicket(tk)) continue;
      const prev = lastQueuedTicketByRoundRef.current.get(r.id);
      if (prev === tk) continue;
      lastQueuedTicketByRoundRef.current.set(r.id, tk);
      prefetchQueueRef.current.push(r.id);
    }

    void drainPrefetchQueue();
  }, [prefetchActiveTickets, enabled, sid, rounds, drainPrefetchQueue]);

  useEffect(() => {
    if (!prefetchActiveTickets) return;
    if (!paused) {
      void drainPrefetchQueue();
    }
  }, [prefetchActiveTickets, paused, drainPrefetchQueue]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setStatus('idle');
      setAdvice(null);
      setAdviceReceivedAt(null);
      setLastError(null);
      return;
    }

    if (paused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setLastError(null);
      const cacheKeyBase = buildScopedTicketKeyBase({ teamId, sessionId: sid, ticketKey });
      const hit = getCachedAdviceForTicket(cacheKeyBase);
      if (hit) {
        setAdvice(hit.advice);
        setAdviceReceivedAt(hit.receivedAt);
        setStatus('ok');
      } else {
        setAdvice(null);
        setAdviceReceivedAt(null);
        setStatus('idle');
      }
      return;
    }

    setLastError(null);

    const cacheKeyBase = buildScopedTicketKeyBase({ teamId, sessionId: sid, ticketKey });
    const cached = getCachedAdviceForTicket(cacheKeyBase);
    if (cached) {
      setAdvice(cached.advice);
      setAdviceReceivedAt(cached.receivedAt);
      setStatus('ok');
      return;
    }

    setAdvice(null);
    setAdviceReceivedAt(null);
    setStatus('idle');

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void runFetch(false);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, paused, stableKey, runFetch, ticketKey]);

  const refresh = useCallback(() => {
    const cacheKeyBase = buildScopedTicketKeyBase({ teamId, sessionId, ticketKey });
    invalidateAdviceCacheForTicket({ exactCacheKey: cacheKeyBase, cacheKeyPrefix: `${cacheKeyBase}|` });
    invalidateSplitDetailsCacheForTicket({ exactCacheKey: cacheKeyBase, cacheKeyPrefix: `${cacheKeyBase}|` });
    if (pausedRef.current) return;
    void runFetch(true);
  }, [runFetch, ticketKey, teamId, sessionId]);

  return {
    enabled,
    /** True when profile allows advisor and pause is off — requests may run. */
    requestsActive: enabled && !paused,
    showPanel: featureFlagOn,
    status,
    advice,
    adviceReceivedAt,
    lastError,
    refresh,
  };
}
