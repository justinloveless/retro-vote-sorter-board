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
  parts.push(`Round number: ${roundNumber}, table phase: ${gameState}.`);
  parts.push('');
  parts.push(
    'Reply with ONLY a single JSON object and nothing else (no markdown fences, no commentary). Shape:',
  );
  parts.push(
    '{"points": <number>, "reasoning": "<one or two short sentences>", "abstain": <boolean>}',
  );
  parts.push(
    'Use points in {1,2,3,5,8,13,21}. Use points -1 and abstain true only if you truly cannot estimate.',
  );
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
  const abstain = o.abstain === true;
  let points = typeof o.points === 'number' ? o.points : Number(o.points);
  if (!Number.isFinite(points)) points = 5;
  if (abstain) points = -1;
  if (!abstain && points !== -1 && !FIB.has(points)) {
    points = 5;
  }
  const reasoning = typeof o.reasoning === 'string' ? o.reasoning : String(o.reasoning ?? '');
  return {
    points,
    reasoning: reasoning.slice(0, 4000),
    abstain: abstain || points === -1,
  };
}
