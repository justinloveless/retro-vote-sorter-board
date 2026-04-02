/**
 * Shared helpers for poker-local-advisor CLI handlers (stdin JSON → stdout JSON).
 */

const FIB = new Set([1, 2, 3, 5, 8, 13, 21]);

export async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * @param {unknown} x
 */
function isNonEmptyString(x) {
  return typeof x === 'string' && x.trim();
}

/**
 * @param {string | null | undefined} team
 * @param {string | null | undefined} personal
 */
export function combineAdvisorPrompts(team, personal) {
  const t = team != null ? String(team).trim() : '';
  const p = personal != null ? String(personal).trim() : '';
  if (!t && !p) return null;
  if (t && p) return `${t}\n\n${p}`;
  return t || p;
}

/**
 * @param {Record<string, unknown>} payload
 */
export function buildEstimationPrompt(payload) {
  const key = String(payload.ticketKey ?? 'unknown');
  const title = payload.ticketTitle != null ? String(payload.ticketTitle) : '';
  const parentKey = payload.parentKey != null ? String(payload.parentKey) : '';
  const parentSummary = payload.parentSummary != null ? String(payload.parentSummary) : '';
  const desc =
    payload.description != null && String(payload.description).trim()
      ? String(payload.description).slice(0, 12000)
      : '';
  const roundNumber = Number(payload.roundNumber) || 1;
  const gameState = String(payload.gameState ?? 'Selection');
  const combined =
    payload.combinedPrompt != null && String(payload.combinedPrompt).trim()
      ? String(payload.combinedPrompt).trim()
      : combineAdvisorPrompts(
          payload.teamPrompt != null ? String(payload.teamPrompt) : null,
          payload.personalPrompt != null ? String(payload.personalPrompt) : null,
        );

  /** @type {Array<{id: string, question: string, answer?: string}>} */
  const qa = Array.isArray(payload.qa) ? payload.qa : [];
  const qaLines = [];
  for (const item of qa) {
    if (!item || typeof item !== 'object') continue;
    const id = isNonEmptyString(item.id) ? item.id.trim() : '';
    const q = isNonEmptyString(item.question) ? item.question.trim() : '';
    const a = isNonEmptyString(item.answer) ? item.answer.trim() : '';
    if (!id || !q) continue;
    qaLines.push(`- [${id}] Q: ${q}${a ? ` | A: ${a}` : ' | A: (unanswered)'}`);
  }

  const parts = [
    'You are helping with planning poker (Fibonacci story points).',
    ...(combined
      ? [
          '',
          '--- Team and personal instructions (from Retroscope) ---',
          combined,
          '--- End instructions ---',
          '',
        ]
      : []),
    `Ticket key: ${key}`,
    `Title: ${title || '(none)'}`,
  ];
  if (parentKey) {
    parts.push(`Parent issue: ${parentKey}${parentSummary ? ` — ${parentSummary}` : ''}`);
  }
  if (desc) {
    parts.push(`Issue description / context:\n${desc}`);
  }
  if (qaLines.length) {
    parts.push('');
    parts.push('Clarifying Q&A so far:');
    parts.push(...qaLines);
  }
  parts.push(`Round number: ${roundNumber}, table phase: ${gameState}.`);
  parts.push('');
  parts.push('Reply with ONLY a single JSON object and nothing else (no markdown fences, no commentary).');
  parts.push('Choose ONE of the following shapes:');
  parts.push('');
  parts.push(
    '{"mode":"questions","questions":[{"id":"q1","question":"<short question>","kind":"text"}]}',
  );
  parts.push(
    'Use mode=questions when you need more info to estimate. Ask 1-3 questions max. Ids must be stable short strings.',
  );
  parts.push('');
  parts.push(
    '{"mode":"advice","points":<number>,"reasoning":"<one or two short sentences>","abstain":<boolean>}',
  );
  parts.push('Use points in {1,2,3,5,8,13,21}. Use points -1 and abstain true only if you truly cannot estimate.');
  return parts.join('\n');
}

/**
 * @param {Record<string, unknown>} payload
 */
export function buildContextPrompt(payload) {
  const key = String(payload.ticketKey ?? 'unknown');
  const title = payload.ticketTitle != null ? String(payload.ticketTitle) : '';
  const parentKey = payload.parentKey != null ? String(payload.parentKey) : '';
  const parentSummary = payload.parentSummary != null ? String(payload.parentSummary) : '';
  const desc =
    payload.description != null && String(payload.description).trim()
      ? String(payload.description).slice(0, 12000)
      : '';
  const roundNumber = Number(payload.roundNumber) || 1;
  const gameState = String(payload.gameState ?? 'Selection');

  const combined =
    payload.combinedPrompt != null && String(payload.combinedPrompt).trim()
      ? String(payload.combinedPrompt).trim()
      : combineAdvisorPrompts(
          payload.teamPrompt != null ? String(payload.teamPrompt) : null,
          payload.personalPrompt != null ? String(payload.personalPrompt) : null,
        );

  const extra = (process.env.POKER_ADVISOR_CONTEXT_INSTRUCTIONS || '').trim();

  /** @type {Array<{id: string, question: string, answer?: string}>} */
  const qa = Array.isArray(payload.qa) ? payload.qa : [];
  const qaLines = [];
  for (const item of qa) {
    if (!item || typeof item !== 'object') continue;
    const id = isNonEmptyString(item.id) ? item.id.trim() : '';
    const q = isNonEmptyString(item.question) ? item.question.trim() : '';
    const a = isNonEmptyString(item.answer) ? item.answer.trim() : '';
    if (!id || !q) continue;
    qaLines.push(`- [${id}] Q: ${q}${a ? ` | A: ${a}` : ' | A: (unanswered)'}`);
  }

  const parts = [
    'You are helping gather planning context for a ticket before estimation.',
    ...(combined
      ? [
          '',
          '--- Team and personal instructions (from Retroscope) ---',
          combined,
          '--- End instructions ---',
          '',
        ]
      : []),
    ...(extra
      ? [
          '',
          '--- Additional context instructions (local) ---',
          extra,
          '--- End additional instructions ---',
          '',
        ]
      : []),
    `Ticket key: ${key}`,
    `Title: ${title || '(none)'}`,
  ];
  if (parentKey) {
    parts.push(`Parent issue: ${parentKey}${parentSummary ? ` — ${parentSummary}` : ''}`);
  }
  if (desc) {
    parts.push(`Issue description / context:\n${desc}`);
  }
  if (qaLines.length) {
    parts.push('');
    parts.push('Clarifying Q&A so far:');
    parts.push(...qaLines);
  }
  parts.push(`Round number: ${roundNumber}, table phase: ${gameState}.`);
  parts.push('');
  parts.push('Return ONLY a single JSON object and nothing else.');
  parts.push('Shape: {"mode":"context","context":"<concise context summary>","points":<number>,"reasoning":"<one or two short sentences>","abstain":<boolean>}');
  parts.push('Use points in {1,2,3,5,8,13,21}. Use points -1 and abstain true only if you truly cannot estimate.');
  parts.push('');
  parts.push('Guidelines for context:');
  parts.push('- Be concise but high-signal. Use short sections and bullets.');
  parts.push('- Include unknowns/questions if key info is missing.');
  parts.push('- Include likely impacted areas (components/services), risks, and a suggested test plan.');
  parts.push('- Do not include secrets. Do not fabricate links or code changes.');
  return parts.join('\n');
}

/**
 * @param {string} text
 */
export function extractJsonObject(text) {
  const t = text.trim();
  if (!t) {
    throw new Error('Empty CLI output');
  }
  try {
    return JSON.parse(t);
  } catch {
    /* fall through */
  }
  const fence = /```(?:json)?\s*([\s\S]*?)```/i;
  const m = t.match(fence);
  if (m) {
    try {
      return JSON.parse(m[1].trim());
    } catch {
      /* fall through */
    }
  }
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch {
      /* fall through */
    }
  }
  throw new Error(`Could not parse JSON from model output: ${t.slice(0, 280)}`);
}

/**
 * @param {unknown} raw
 */
export function normalizeAdvisorResult(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Parsed JSON is not an object');
  }
  const o = /** @type {Record<string, unknown>} */ (raw);

  const mode = typeof o.mode === 'string' ? o.mode : null;
  if (mode === 'questions') {
    const rawQuestions = Array.isArray(o.questions) ? o.questions : [];
    const questions = [];
    for (const q of rawQuestions) {
      if (!q || typeof q !== 'object') continue;
      const qo = /** @type {Record<string, unknown>} */ (q);
      const id = isNonEmptyString(qo.id) ? qo.id.trim() : '';
      const question = isNonEmptyString(qo.question) ? qo.question.trim() : '';
      const kindRaw = typeof qo.kind === 'string' ? qo.kind : 'text';
      const kind = kindRaw === 'choice' ? 'choice' : 'text';
      const choices =
        kind === 'choice' && Array.isArray(qo.choices)
          ? qo.choices.filter((c) => isNonEmptyString(c)).map((c) => c.trim())
          : undefined;
      if (!id || !question) continue;
      questions.push({ id, question, kind, choices: choices && choices.length ? choices : undefined });
    }
    if (!questions.length) {
      throw new Error('Questions response had no valid questions');
    }
    return { mode: 'questions', questions };
  }

  const abstain = o.abstain === true;
  let points = typeof o.points === 'number' ? o.points : Number(o.points);
  if (!Number.isFinite(points)) points = 5;
  if (abstain) points = -1;
  if (!abstain && points !== -1 && !FIB.has(points)) {
    points = 5;
  }
  const reasoning = typeof o.reasoning === 'string' ? o.reasoning : String(o.reasoning ?? '');
  return {
    mode: 'advice',
    points,
    reasoning: reasoning.slice(0, 4000),
    abstain: abstain || points === -1,
  };
}

/**
 * @param {unknown} raw
 */
export function normalizeContextResult(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Parsed JSON is not an object');
  }
  const o = /** @type {Record<string, unknown>} */ (raw);
  const mode = typeof o.mode === 'string' ? o.mode : null;
  if (mode !== 'context') {
    throw new Error('Context response had invalid mode');
  }
  const context = typeof o.context === 'string' ? o.context : String(o.context ?? '');
  const trimmed = context.trim();
  if (!trimmed) {
    throw new Error('Context response had empty context');
  }
  const abstain = o.abstain === true;
  let points = typeof o.points === 'number' ? o.points : Number(o.points);
  if (!Number.isFinite(points)) points = 5;
  const reasoning = typeof o.reasoning === 'string' ? o.reasoning : String(o.reasoning ?? '');
  return {
    mode: 'context',
    context: trimmed.slice(0, 24000),
    points,
    reasoning: reasoning.slice(0, 4000),
    abstain: abstain || points === -1,
  };
}
