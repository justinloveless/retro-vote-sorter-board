import type { GameState } from '@/hooks/usePokerSession';

/** POST target for the local advisor server */
export function normalizeAdviseUrl(baseUrl: string): string {
  const t = baseUrl.trim().replace(/\/$/, '');
  return `${t}/advise`;
}

export type PokerAdvisorRequestPayload = {
  /** Poker session round row id — used to correlate responses when navigating quickly. */
  roundId: string;
  ticketKey: string;
  ticketTitle: string | null;
  parentKey: string | null;
  parentSummary: string | null;
  description: string | null;
  roundNumber: number;
  gameState: GameState;
  /** Team-level instructions from Team settings (optional). */
  teamPrompt: string | null;
  /** User-level instructions from Account (optional). */
  personalPrompt: string | null;
  /** teamPrompt + personalPrompt joined for simple handlers; null if both empty. */
  combinedPrompt: string | null;
};

/** Merge team and personal advisor instructions (team first, then personal). */
export function combineAdvisorPrompts(team: string | null | undefined, personal: string | null | undefined): string | null {
  const t = (team ?? '').trim();
  const p = (personal ?? '').trim();
  if (!t && !p) return null;
  if (t && p) return `${t}\n\n${p}`;
  return t || p;
}

export type PokerAdvisorResponse = {
  points: number;
  reasoning: string;
  abstain?: boolean;
  error?: string;
  /** Echoed from the request so clients can ignore stale async responses. */
  roundId?: string;
  ticketKey?: string;
  roundNumber?: number;
};

const FIB = new Set([1, 2, 3, 5, 8, 13, 21]);

export function normalizeAdvisorResponse(raw: unknown): PokerAdvisorResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.error === 'string' && o.error) {
    return { points: 0, reasoning: '', error: o.error };
  }
  const abstain = o.abstain === true;
  let points = typeof o.points === 'number' ? o.points : Number(o.points);
  if (!Number.isFinite(points)) points = 1;
  if (abstain) points = -1;
  if (points !== -1 && !FIB.has(points)) {
    points = 5;
  }
  const reasoning = typeof o.reasoning === 'string' ? o.reasoning : '';
  const out: PokerAdvisorResponse = { points, reasoning, abstain };
  if (typeof o.roundId === 'string') out.roundId = o.roundId;
  if (typeof o.ticketKey === 'string') out.ticketKey = o.ticketKey;
  if (typeof o.roundNumber === 'number' && Number.isFinite(o.roundNumber)) {
    out.roundNumber = o.roundNumber;
  }
  return out;
}
