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

/** POST target for drafting Jira summary + description for a split suggestion */
export function normalizeSplitDetailsUrl(baseUrl: string): string {
  return `${advisorOrigin(baseUrl)}/split-details`;
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

/** Sub-story line item from the local advisor (required `splits` array may be empty). */
export type StorySplit = {
  title: string;
  points?: number;
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

/** Body for POST /split-details (extends advisor payload with the proposed split line). */
export type PokerAdvisorSplitDetailsRequestPayload = PokerAdvisorRequestPayload & {
  splitTitle: string;
  splitPoints?: number;
};

export type PokerAdvisorSplitDetailsResponse = {
  mode: 'split_details';
  summary: string;
  /** Plain text / markdown string, or an ADF doc object when the advisor generates rich ADF. */
  description: string | Record<string, unknown>;
  error?: string;
  roundId?: string;
  ticketKey?: string;
  roundNumber?: number;
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
  /** Always present after normalization; empty means keep as one story. */
  splits: StorySplit[];
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
  /** Present on success; on error responses use []. */
  splits: StorySplit[];
  error?: string;
  /** Echoed from the request so clients can ignore stale async responses. */
  roundId?: string;
  ticketKey?: string;
  roundNumber?: number;
};

export type PokerAdvisorResponse = PokerAdvisorAdviceResponse | PokerAdvisorQuestionsResponse;

/** Old cached payloads may omit `splits`; normalize before use. */
export function coalesceAdviceSplits(advice: PokerAdvisorResponse): PokerAdvisorResponse {
  if (advice.mode !== 'advice') return advice;
  if (Array.isArray(advice.splits)) return advice;
  return { ...advice, splits: [] };
}

/** Old cached context may omit `splits`. */
export function coalesceContextSplits(ctx: PokerAdvisorContextResponse): PokerAdvisorContextResponse {
  if (Array.isArray(ctx.splits)) return ctx;
  return { ...ctx, splits: [] };
}

const FIB = new Set([1, 2, 3, 5, 8, 13, 21]);

function splitItemTitleFromRecord(io: Record<string, unknown>): string {
  const t = typeof io.title === 'string' ? io.title.trim() : '';
  if (t) return t;
  const n = typeof io.name === 'string' ? io.name.trim() : '';
  if (n) return n;
  const s = typeof io.summary === 'string' ? io.summary.trim() : '';
  return s;
}

function splitItemsFromRawArray(raw: unknown[]): StorySplit[] {
  const out: StorySplit[] = [];
  for (const item of raw.slice(0, 5)) {
    if (!item || typeof item !== 'object') continue;
    const io = item as Record<string, unknown>;
    const title = splitItemTitleFromRecord(io);
    if (!title) continue;
    const ptsRaw = typeof io.points === 'number' ? io.points : Number(io.points);
    if (Number.isFinite(ptsRaw) && FIB.has(ptsRaw as number)) {
      out.push({ title: title.slice(0, 500), points: ptsRaw as number });
    } else {
      out.push({ title: title.slice(0, 500) });
    }
  }
  return out;
}

/** Mirrors server: prefer `splits` when it is an array (including []), else `subtasks`, else []. */
function coerceSplitsFromRecord(o: Record<string, unknown>): StorySplit[] {
  if (Array.isArray(o.splits)) return splitItemsFromRawArray(o.splits);
  if (Array.isArray(o.subtasks)) return splitItemsFromRawArray(o.subtasks);
  return [];
}

export function normalizeAdvisorResponse(raw: unknown): PokerAdvisorResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.error === 'string' && o.error) {
    // Preserve legacy shape on error for older servers; treat as advice-mode.
    return { mode: 'advice', points: 0, reasoning: '', splits: [], error: o.error };
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
  const splits = coerceSplitsFromRecord(o);
  const out: PokerAdvisorAdviceResponse = { mode: 'advice', points, reasoning, abstain, splits };
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
    return { mode: 'context', context: '', splits: [], error: o.error };
  }
  const mode = typeof o.mode === 'string' ? o.mode : null;
  if (mode !== 'context') return null;
  const context = typeof o.context === 'string' ? o.context : '';
  const splits = coerceSplitsFromRecord(o);
  const out: PokerAdvisorContextResponse = { mode: 'context', context, splits };
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

export function normalizeSplitDetailsResponse(raw: unknown): PokerAdvisorSplitDetailsResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.error === 'string' && o.error) {
    return { mode: 'split_details', summary: '', description: '', error: o.error };
  }
  if (o.mode !== 'split_details') return null;
  let summary = typeof o.summary === 'string' ? o.summary.trim() : '';
  if (!summary && typeof o.title === 'string') summary = o.title.trim();
  if (!summary) return null;
  summary = summary.slice(0, 255);

  let description: string | Record<string, unknown>;
  const rawDesc = o.description;
  if (rawDesc && typeof rawDesc === 'object' && (rawDesc as Record<string, unknown>).type === 'doc') {
    description = rawDesc as Record<string, unknown>;
  } else if (typeof rawDesc === 'string') {
    const trimmed = rawDesc.trim();
    // Model may have emitted the ADF JSON as a string — try to unwrap it
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (parsed && typeof parsed === 'object' && (parsed as Record<string, unknown>).type === 'doc') {
          description = parsed as Record<string, unknown>;
        } else {
          description = trimmed.slice(0, 20000);
        }
      } catch {
        description = trimmed.slice(0, 20000);
      }
    } else {
      description = trimmed.slice(0, 20000);
    }
  } else if (typeof o.body === 'string') {
    description = (o.body as string).trim().slice(0, 20000);
  } else {
    description = summary;
  }

  const out: PokerAdvisorSplitDetailsResponse = {
    mode: 'split_details',
    summary,
    description,
  };
  if (typeof o.roundId === 'string') out.roundId = o.roundId;
  if (typeof o.ticketKey === 'string') out.ticketKey = o.ticketKey;
  if (typeof o.roundNumber === 'number' && Number.isFinite(o.roundNumber)) {
    out.roundNumber = o.roundNumber;
  }
  return out;
}
