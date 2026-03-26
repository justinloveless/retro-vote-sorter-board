import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Profile } from '@/hooks/useAuth';
import type { GameState } from '@/hooks/usePokerSession';
import type { PokerSessionRound } from '@/hooks/usePokerSessionHistory';
import { supabase } from '@/integrations/supabase/client';
import {
  combineAdvisorPrompts,
  normalizeAdviseUrl,
  normalizeAdvisorResponse,
  type PokerAdvisorRequestPayload,
  type PokerAdvisorResponse,
} from '@/lib/pokerLocalAdvisor';
import {
  getCachedAdviceForTicket,
  getInFlightAdviceForTicket,
  invalidateAdviceCacheForTicket,
  setInFlightAdviceForTicket,
  setCachedAdviceForTicket,
} from '@/lib/pokerAdvisorCache';
import { isSyntheticRoundTicket } from '@/lib/pokerRoundTicketPlaceholder';

const DEBOUNCE_MS = 450;

async function optionalJiraDescription(teamId: string | undefined, ticketKey: string): Promise<string | null> {
  if (!teamId || !ticketKey?.trim()) return null;
  try {
    const { data, error } = await supabase.functions.invoke('get-jira-issue', {
      body: { issueIdOrKey: ticketKey.trim(), teamId },
    });
    if (error || !data || typeof data !== 'object' || 'error' in data) return null;
    const fields = data.fields as Record<string, unknown> | undefined;
    if (!fields) return null;
    const d = fields.description;
    if (typeof d === 'string') return d.slice(0, 12000);
    if (d && typeof d === 'object') {
      return JSON.stringify(d).slice(0, 12000);
    }
    return null;
  } catch {
    return null;
  }
}

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
}) {
  const { featureFlagOn, profile, teamId, sessionId, rounds, currentRound, gameState, paused } = options;

  const enabled =
    !!featureFlagOn &&
    !!profile?.poker_advisor_enabled &&
    !!profile?.poker_advisor_data_sharing_acknowledged_at &&
    !!(profile?.poker_advisor_base_url || '').trim();

  const baseUrl = (profile?.poker_advisor_base_url || '').trim();

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
    (round: PokerSessionRound, payloadGameState: GameState) => {
      const tk = (round.ticket_number || '').trim();
      const rid = round.id;
      const rnum = round.round_number;

      return (async () => {
        let description: string | null = null;
        if (teamId && tk && tk !== '—') {
          description = await optionalJiraDescription(teamId, tk);
        }

        let teamPrompt: string | null = null;
        if (teamId) {
          const { data } = await supabase
            .from('teams')
            .select('poker_advisor_team_prompt')
            .eq('id', teamId)
            .maybeSingle();
          const raw = data?.poker_advisor_team_prompt;
          teamPrompt = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
        }

        const personalRaw = profile?.poker_advisor_personal_prompt;
        const personalPrompt =
          typeof personalRaw === 'string' && personalRaw.trim() ? personalRaw.trim() : null;

        const payload: PokerAdvisorRequestPayload = {
          roundId: rid,
          ticketKey: tk,
          ticketTitle: round.ticket_title ?? null,
          parentKey: round.ticket_parent_key ?? null,
          parentSummary: round.ticket_parent_summary ?? null,
          description,
          roundNumber: rnum,
          gameState: payloadGameState,
          teamPrompt,
          personalPrompt,
          combinedPrompt: combineAdvisorPrompts(teamPrompt, personalPrompt),
        };

        const url = normalizeAdviseUrl(baseUrl);
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

        const norm = normalizeAdvisorResponse(parsed);
        if (!norm || norm.error) {
          throw new Error(norm?.error || 'Invalid response');
        }

        const receivedAt = Date.now();
        setCachedAdviceForTicket(tk, norm, receivedAt);
        return { advice: norm, receivedAt };
      })();
    },
    [baseUrl, teamId, profile?.poker_advisor_personal_prompt],
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

      if (!forceRefresh) {
        const hit = getCachedAdviceForTicket(ticketKey);
        if (hit) {
          setAdvice(hit.advice);
          setAdviceReceivedAt(hit.receivedAt);
          setStatus('ok');
          setLastError(null);
          return;
        }

        const inFlight = getInFlightAdviceForTicket(ticketKey);
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

      const requestPromise = runAdvisorNetworkOnce(currentRound, gameState);

      setInFlightAdviceForTicket(ticketKey, requestPromise);

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
        if (getCachedAdviceForTicket(tk)) continue;
        if (getInFlightAdviceForTicket(tk)) continue;

        const requestPromise = runAdvisorNetworkOnce(round, round.game_state);
        setInFlightAdviceForTicket(tk, requestPromise);

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
  }, [enabled, baseUrl, runAdvisorNetworkOnce]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sid = sessionId?.trim() || null;

  useEffect(() => {
    prefetchQueueRef.current = [];
    lastQueuedTicketByRoundRef.current.clear();
  }, [sid]);

  useEffect(() => {
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
  }, [enabled, sid, rounds, drainPrefetchQueue]);

  useEffect(() => {
    if (!paused) {
      void drainPrefetchQueue();
    }
  }, [paused, drainPrefetchQueue]);

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
      const hit = getCachedAdviceForTicket(ticketKey);
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

    const cached = getCachedAdviceForTicket(ticketKey);
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
    invalidateAdviceCacheForTicket(ticketKey);
    if (pausedRef.current) return;
    void runFetch(true);
  }, [runFetch, ticketKey]);

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
