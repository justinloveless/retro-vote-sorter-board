import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Profile } from '@/hooks/useAuth';
import type { GameState } from '@/hooks/usePokerSession';
import type { PokerSessionRound } from '@/hooks/usePokerSessionHistory';
import { normalizeContextUrl, normalizeContextResponse, type PokerAdvisorContextResponse } from '@/lib/pokerLocalAdvisor';
import {
  getCachedContextForTicket,
  getInFlightContextForTicket,
  invalidateContextCacheForTicket,
  setCachedContextForTicket,
  setInFlightContextForTicket,
} from '@/lib/pokerAdvisorContextCache';
import { isSyntheticRoundTicket } from '@/lib/pokerRoundTicketPlaceholder';
import { buildPokerAdvisorRequestPayload, fetchRoundQa, hashQa } from '@/hooks/_pokerLocalAdvisorPayload';

const DEBOUNCE_MS = 450;
const MAX_CONTEXT_CHARS = 24000;

function buildScopedTicketKeyBase(options: {
  teamId: string | undefined;
  sessionId: string | null | undefined;
  ticketKey: string;
}): string {
  const { teamId, sessionId, ticketKey } = options;
  const tk = (ticketKey || '').trim();
  if (!tk || tk === '—') return '—';
  const tid = (teamId || '').trim();
  const sid = (sessionId || '').trim();
  if (!tid || !sid) return tk;
  return `${tid}|${sid}|${tk}`;
}

export function usePokerLocalAdvisorContext(options: {
  featureFlagOn: boolean;
  profile: Profile | null;
  teamId: string | undefined;
  sessionId: string | null | undefined;
  rounds: PokerSessionRound[];
  currentRound: PokerSessionRound | null;
  gameState: GameState;
  paused: boolean;
  prefetchActiveTickets: boolean;
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
  } = options;

  const enabled =
    !!featureFlagOn &&
    !!profile?.poker_advisor_enabled &&
    !!profile?.poker_advisor_data_sharing_acknowledged_at &&
    !!(profile?.poker_advisor_base_url || '').trim();

  const baseUrl = (profile?.poker_advisor_base_url || '').trim();
  const sid = sessionId?.trim() || null;

  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [context, setContext] = useState<PokerAdvisorContextResponse | null>(null);
  const [contextReceivedAt, setContextReceivedAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const ticketKey = (currentRound?.ticket_number || '').trim() || '—';
  const roundId = currentRound?.id ?? '';
  const roundNumber = currentRound?.round_number ?? 1;

  const stableKey = useMemo(() => `${roundId}|${ticketKey}|${gameState}`, [roundId, ticketKey, gameState]);

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
  const lastQueuedTicketByRoundRef = useRef<Map<string, string>>(new Map());
  const drainingPrefetchRef = useRef(false);

  const runContextNetworkOnce = useCallback(
    (round: PokerSessionRound, payloadGameState: GameState, cacheKeyBase: string, cacheKeyFull: string) => {
      const fetchForKey = stableKey;
      return (async () => {
        const qa = sid ? await fetchRoundQa(sid, round.round_number) : [];
        const payload = await buildPokerAdvisorRequestPayload({
          round,
          gameState: payloadGameState,
          profile,
          teamId,
          sessionId: sid,
          qa,
          includeQa: true,
        });

        const url = normalizeContextUrl(baseUrl);
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

        const norm = normalizeContextResponse(parsed);
        if (!norm || norm.error) {
          throw new Error(norm?.error || 'Invalid response');
        }

        const clipped: PokerAdvisorContextResponse = {
          ...norm,
          context: (norm.context || '').slice(0, MAX_CONTEXT_CHARS),
        };

        const receivedAt = Date.now();
        setCachedContextForTicket(cacheKeyFull, clipped, receivedAt);
        setCachedContextForTicket(cacheKeyBase, clipped, receivedAt);

        if (pausedRef.current) return { context: clipped, receivedAt };
        if (fetchForKey !== liveStableKeyRef.current) return { context: clipped, receivedAt };
        if (clipped.roundId && clipped.roundId !== roundId) return { context: clipped, receivedAt };

        return { context: clipped, receivedAt };
      })();
    },
    [baseUrl, profile, teamId, sid, stableKey, roundId],
  );

  const runFetch = useCallback(
    async (forceRefresh = false) => {
      const fetchForKey = stableKey;

      if (!enabled || !baseUrl) {
        setStatus('idle');
        setContext(null);
        setContextReceivedAt(null);
        setLastError(null);
        return;
      }

      if (pausedRef.current) {
        setStatus('idle');
        setLastError(null);
        return;
      }

      if (!currentRound) return;

      const qa = sid ? await fetchRoundQa(sid, roundNumber) : [];
      const qaHash = hashQa(qa);
      const cacheKeyBase = buildScopedTicketKeyBase({ teamId, sessionId: sid, ticketKey });
      const cacheKeyFull = qa.length ? `${cacheKeyBase}|${qaHash}` : cacheKeyBase;

      if (!forceRefresh) {
        const hit = getCachedContextForTicket(cacheKeyFull) ?? getCachedContextForTicket(cacheKeyBase);
        if (hit) {
          setContext(hit.context);
          setContextReceivedAt(hit.receivedAt);
          setStatus('ok');
          setLastError(null);
          return;
        }

        const inFlight = getInFlightContextForTicket(cacheKeyFull) ?? getInFlightContextForTicket(cacheKeyBase);
        if (inFlight) {
          setStatus('loading');
          setLastError(null);
          try {
            const { context: norm, receivedAt } = await inFlight;
            if (pausedRef.current) return;
            if (fetchForKey !== liveStableKeyRef.current) return;
            if (norm.roundId && norm.roundId !== roundId) return;
            setContext(norm);
            setContextReceivedAt(receivedAt);
            setStatus('ok');
          } catch (e) {
            if (pausedRef.current) return;
            if (fetchForKey !== liveStableKeyRef.current) return;
            setContext(null);
            setContextReceivedAt(null);
            setLastError(e instanceof Error ? e.message : 'Request failed');
            setStatus('error');
          }
          return;
        }
      }

      if (!forceRefresh && !currentRound.is_active) {
        setStatus('idle');
        setLastError(null);
        return;
      }

      setStatus('loading');
      setLastError(null);

      const requestPromise = runContextNetworkOnce(currentRound, gameState, cacheKeyBase, cacheKeyFull);
      setInFlightContextForTicket(cacheKeyFull, requestPromise);

      try {
        const { context: norm, receivedAt } = await requestPromise;
        if (pausedRef.current) return;
        if (fetchForKey !== liveStableKeyRef.current) return;
        if (norm.roundId && norm.roundId !== roundId) return;
        setContext(norm);
        setContextReceivedAt(receivedAt);
        setStatus('ok');
      } catch (e) {
        if (pausedRef.current) return;
        if (fetchForKey !== liveStableKeyRef.current) return;
        setContext(null);
        setContextReceivedAt(null);
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
      roundNumber,
      ticketKey,
      runContextNetworkOnce,
      sid,
      teamId,
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
        if (getCachedContextForTicket(prefetchKeyBase)) continue;
        if (getInFlightContextForTicket(prefetchKeyBase)) continue;

        const requestPromise = runContextNetworkOnce(round, round.game_state, prefetchKeyBase, prefetchKeyBase);
        setInFlightContextForTicket(prefetchKeyBase, requestPromise);

        try {
          const { context: norm, receivedAt } = await requestPromise;
          if (pausedRef.current) continue;
          if (viewingRoundIdRef.current !== round.id) continue;
          if (viewingTicketKeyRef.current !== tk) continue;
          if (norm.roundId && norm.roundId !== round.id) continue;
          setContext(norm);
          setContextReceivedAt(receivedAt);
          setStatus('ok');
          setLastError(null);
        } catch (e) {
          if (pausedRef.current) continue;
          if (viewingRoundIdRef.current !== round.id) continue;
          if (viewingTicketKeyRef.current !== tk) continue;
          setContext(null);
          setContextReceivedAt(null);
          setLastError(e instanceof Error ? e.message : 'Request failed');
          setStatus('error');
        }
      }
    } finally {
      drainingPrefetchRef.current = false;
    }
  }, [enabled, baseUrl, runContextNetworkOnce, teamId, sid]);

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
      setContext(null);
      setContextReceivedAt(null);
      setLastError(null);
      return;
    }

    if (paused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setLastError(null);
      const cacheKeyBase = buildScopedTicketKeyBase({ teamId, sessionId: sid, ticketKey });
      const hit = getCachedContextForTicket(cacheKeyBase);
      if (hit) {
        setContext(hit.context);
        setContextReceivedAt(hit.receivedAt);
        setStatus('ok');
      } else {
        setContext(null);
        setContextReceivedAt(null);
        setStatus('idle');
      }
      return;
    }

    setLastError(null);
    const cacheKeyBase = buildScopedTicketKeyBase({ teamId, sessionId: sid, ticketKey });
    const cached = getCachedContextForTicket(cacheKeyBase);
    if (cached) {
      setContext(cached.context);
      setContextReceivedAt(cached.receivedAt);
      setStatus('ok');
      return;
    }

    setContext(null);
    setContextReceivedAt(null);
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
    invalidateContextCacheForTicket({ exactCacheKey: cacheKeyBase, cacheKeyPrefix: `${cacheKeyBase}|` });
    if (pausedRef.current) return;
    void runFetch(true);
  }, [runFetch, ticketKey, teamId, sessionId]);

  return {
    enabled,
    requestsActive: enabled && !paused,
    status,
    context,
    contextReceivedAt,
    lastError,
    refresh,
  };
}

