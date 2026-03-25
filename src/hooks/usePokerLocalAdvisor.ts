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
  invalidateAdviceCacheForTicket,
  setCachedAdviceForTicket,
} from '@/lib/pokerAdvisorCache';

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
  currentRound: PokerSessionRound | null;
  gameState: GameState;
  /** When true, no /advise requests are made (browser-local; see usePokerAdvisorPause). */
  paused: boolean;
}) {
  const { featureFlagOn, profile, teamId, currentRound, gameState, paused } = options;

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

  const runFetch = useCallback(async (forceRefresh = false) => {
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

    if (!forceRefresh) {
      const hit = getCachedAdviceForTicket(ticketKey);
      if (hit) {
        setAdvice(hit.advice);
        setAdviceReceivedAt(hit.receivedAt);
        setStatus('ok');
        setLastError(null);
        return;
      }
    }

    setStatus('loading');
    setLastError(null);

    let description: string | null = null;
    if (teamId && ticketKey && ticketKey !== '—') {
      description = await optionalJiraDescription(teamId, ticketKey);
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

    if (pausedRef.current) {
      setStatus('idle');
      setLastError(null);
      return;
    }

    const personalRaw = profile?.poker_advisor_personal_prompt;
    const personalPrompt =
      typeof personalRaw === 'string' && personalRaw.trim() ? personalRaw.trim() : null;

    if (pausedRef.current) {
      setStatus('idle');
      setLastError(null);
      return;
    }

    const payload: PokerAdvisorRequestPayload = {
      roundId,
      ticketKey,
      ticketTitle: currentRound?.ticket_title ?? null,
      parentKey: currentRound?.ticket_parent_key ?? null,
      parentSummary: currentRound?.ticket_parent_summary ?? null,
      description,
      roundNumber,
      gameState,
      teamPrompt,
      personalPrompt,
      combinedPrompt: combineAdvisorPrompts(teamPrompt, personalPrompt),
    };

    try {
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
        if (!pausedRef.current && fetchForKey === liveStableKeyRef.current) {
          setAdvice(null);
          setAdviceReceivedAt(null);
          setLastError(norm?.error || 'Invalid response');
          setStatus('error');
        }
        return;
      }

      // Always persist successful advice for this request's ticket, even if the user navigated
      // away before the response arrived (otherwise round 18's result is lost when returning later).
      const receivedAt = Date.now();
      setCachedAdviceForTicket(ticketKey, norm, receivedAt);

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
  }, [
    enabled,
    baseUrl,
    teamId,
    profile?.poker_advisor_personal_prompt,
    stableKey,
    roundId,
    ticketKey,
    currentRound?.ticket_title,
    currentRound?.ticket_parent_key,
    currentRound?.ticket_parent_summary,
    roundNumber,
    gameState,
  ]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
