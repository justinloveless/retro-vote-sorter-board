import type { GameState } from '@/hooks/usePokerSession';

function advisorOrigin(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, '');
}

/** GET target for a fast connection check (reference server implements this; avoids running the CLI). */
export function normalizeHealthUrl(baseUrl: string): string {
  return `${advisorOrigin(baseUrl)}/health`;
}

/** POST target for the local advisor server */
export function normalizeAdviseUrl(baseUrl: string): string {
  return `${advisorOrigin(baseUrl)}/advise`;
}

/** POST target for local advisor context generation */
export function normalizeContextUrl(baseUrl: string): string {
  return `${advisorOrigin(baseUrl)}/context`;
}

export type PokerAdvisorQAItem = {
  id: string;
  question: string;
  answer?: string;
};

export type PokerAdvisorQuestion = {
  id: string;
  question: string;
  kind: 'text' | 'choice';
  choices?: string[];
};

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
  /** Optional compact Q&A context collected by the client. */
  qa?: PokerAdvisorQAItem[];
};

/** Merge team and personal advisor instructions (team first, then personal). */
export function combineAdvisorPrompts(team: string | null | undefined, personal: string | null | undefined): string | null {
  const t = (team ?? '').trim();
  const p = (personal ?? '').trim();
  if (!t && !p) return null;
  if (t && p) return `${t}\n\n${p}`;
  return t || p;
}

export type PokerAdvisorAdviceResponse = {
  mode: 'advice';
  points: number;
  reasoning: string;
  abstain?: boolean;
  error?: string;
  /** Echoed from the request so clients can ignore stale async responses. */
  roundId?: string;
  ticketKey?: string;
  roundNumber?: number;
};

export type PokerAdvisorQuestionsResponse = {
  mode: 'questions';
  questions: PokerAdvisorQuestion[];
  error?: string;
  /** Echoed from the request so clients can ignore stale async responses. */
  roundId?: string;
  ticketKey?: string;
  roundNumber?: number;
};

export type PokerAdvisorContextResponse = {
  mode: 'context';
  context: string;
  /** Optional estimate included by newer /context handlers (when used to drive points). */
  points?: number;
  reasoning?: string;
  abstain?: boolean;
  error?: string;
  /** Echoed from the request so clients can ignore stale async responses. */
  roundId?: string;
  ticketKey?: string;
  roundNumber?: number;
};

export type PokerAdvisorResponse = PokerAdvisorAdviceResponse | PokerAdvisorQuestionsResponse;

const FIB = new Set([1, 2, 3, 5, 8, 13, 21]);

export function normalizeAdvisorResponse(raw: unknown): PokerAdvisorResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.error === 'string' && o.error) {
    // Preserve legacy shape on error for older servers; treat as advice-mode.
    return { mode: 'advice', points: 0, reasoning: '', error: o.error };
  }

  const mode = typeof o.mode === 'string' ? o.mode : null;

  if (mode === 'questions') {
    const rawQuestions = Array.isArray(o.questions) ? o.questions : [];
    const questions: PokerAdvisorQuestion[] = [];
    for (const q of rawQuestions) {
      if (!q || typeof q !== 'object') continue;
      const qo = q as Record<string, unknown>;
      const id = typeof qo.id === 'string' ? qo.id.trim() : '';
      const question = typeof qo.question === 'string' ? qo.question.trim() : '';
      const kindRaw = typeof qo.kind === 'string' ? qo.kind : 'text';
      const kind: PokerAdvisorQuestion['kind'] = kindRaw === 'choice' ? 'choice' : 'text';
      const choices =
        kind === 'choice' && Array.isArray(qo.choices)
          ? qo.choices.filter((c): c is string => typeof c === 'string' && c.trim()).map((c) => c.trim())
          : undefined;
      if (!id || !question) continue;
      questions.push({ id, question, kind, choices: choices && choices.length ? choices : undefined });
    }
    const out: PokerAdvisorQuestionsResponse = {
      mode: 'questions',
      questions,
    };
    if (typeof o.roundId === 'string') out.roundId = o.roundId;
    if (typeof o.ticketKey === 'string') out.ticketKey = o.ticketKey;
    if (typeof o.roundNumber === 'number' && Number.isFinite(o.roundNumber)) {
      out.roundNumber = o.roundNumber;
    }
    return out;
  }

  // Default/legacy: advice-mode.
  const abstain = o.abstain === true;
  let points = typeof o.points === 'number' ? o.points : Number(o.points);
  if (!Number.isFinite(points)) points = 1;
  if (abstain) points = -1;
  if (points !== -1 && !FIB.has(points)) {
    points = 5;
  }
  const reasoning = typeof o.reasoning === 'string' ? o.reasoning : '';
  const out: PokerAdvisorAdviceResponse = { mode: 'advice', points, reasoning, abstain };
  if (typeof o.roundId === 'string') out.roundId = o.roundId;
  if (typeof o.ticketKey === 'string') out.ticketKey = o.ticketKey;
  if (typeof o.roundNumber === 'number' && Number.isFinite(o.roundNumber)) {
    out.roundNumber = o.roundNumber;
  }
  return out;
}

export function normalizeContextResponse(raw: unknown): PokerAdvisorContextResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.error === 'string' && o.error) {
    return { mode: 'context', context: '', error: o.error };
  }
  const mode = typeof o.mode === 'string' ? o.mode : null;
  if (mode !== 'context') return null;
  const context = typeof o.context === 'string' ? o.context : '';
  const out: PokerAdvisorContextResponse = { mode: 'context', context };
  const abstain = o.abstain === true;
  const points = typeof o.points === 'number' ? o.points : Number(o.points);
  const reasoning = typeof o.reasoning === 'string' ? o.reasoning : '';
  if (Number.isFinite(points)) out.points = points;
  if (reasoning) out.reasoning = reasoning;
  if (abstain) out.abstain = true;
  if (typeof o.roundId === 'string') out.roundId = o.roundId;
  if (typeof o.ticketKey === 'string') out.ticketKey = o.ticketKey;
  if (typeof o.roundNumber === 'number' && Number.isFinite(o.roundNumber)) {
    out.roundNumber = o.roundNumber;
  }
  return out;
}
