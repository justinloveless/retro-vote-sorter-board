#!/usr/bin/env node
/**
 * Reference local advisor server for Retroscope poker.
 * GET /health — fast liveness (no handler subprocess); JSON { ok: true }.
 * POST /advise — JSON body in, JSON { points, reasoning } out.
 *
 * Optional: --handler <name|path>
 *   Built-ins: claude-code (or claude), gemini-cli (or gemini), stub
 *   Or path to an executable: receives JSON on stdin; prints JSON on stdout.
 * Optional: POKER_ADVISOR_HANDLER=/path/to/executable (used when --handler is omitted)
 * Optional: HOST=0.0.0.0 (default) listens on all interfaces; HOST=127.0.0.1 for loopback only.
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import { runClaudeAdvisor } from './handlers/claude-code.mjs';
import { runClaudeContext } from './handlers/claude-code-context.mjs';
import { runClaudeSplitDetails } from './handlers/claude-code-split-details.mjs';
import { runGeminiAdvisor, runGeminiSplitDetails } from './handlers/gemini-cli.mjs';

const PORT = Number(process.env.PORT || 17300);
const HOST = process.env.HOST ?? '0.0.0.0';
const LOG_TRUNC = 400;

/** @typedef {{ kind: 'stub' } | { kind: 'builtin', run: (p: Record<string, unknown>) => Promise<Record<string, unknown>> } | { kind: 'external', path: string }} ResolvedHandler */

/**
 * @param {string[]} argv
 */
function parseServerArgs(argv) {
  let handlerFlag;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      return { help: true };
    }
    if (a === '--handler') {
      handlerFlag = argv[++i];
      if (handlerFlag === undefined) {
        console.error('[poker-local-advisor] error: --handler requires a value');
        process.exit(1);
      }
      continue;
    }
    if (a.startsWith('--handler=')) {
      handlerFlag = a.slice('--handler='.length);
      if (!handlerFlag) {
        console.error('[poker-local-advisor] error: --handler= requires a value');
        process.exit(1);
      }
      continue;
    }
    console.error(`[poker-local-advisor] error: unknown argument: ${a}`);
    console.error('Try: node server.mjs --help');
    process.exit(1);
  }
  return { help: false, handlerFlag };
}

function printHelp() {
  console.error(`Usage: node server.mjs [--handler <name|path>]

  --handler   Built-in: claude-code | claude | gemini-cli | gemini | stub
              Or path to an executable (stdin JSON → stdout JSON).
              If omitted, uses env POKER_ADVISOR_HANDLER, else defaults to claude-code.

Environment: PORT (default 17300), HOST (default 0.0.0.0), POKER_ADVISOR_HANDLER
`);
}

const cli = parseServerArgs(process.argv.slice(2));
if (cli.help) {
  printHelp();
  process.exit(0);
}

const handlerSpec =
  cli.handlerFlag !== undefined ? cli.handlerFlag : process.env.POKER_ADVISOR_HANDLER || '';

/**
 * @param {string} spec
 * @returns {ResolvedHandler}
 */
function resolveHandler(spec) {
  const trimmed = (spec || '').trim();
  // Default to Claude Code when no handler is specified.
  if (!trimmed) return { kind: 'builtin', run: runClaudeAdvisor };
  const lower = trimmed.toLowerCase();
  if (lower === 'stub' || lower === 'none') return { kind: 'stub' };
  if (lower === 'claude-code' || lower === 'claude') {
    return { kind: 'builtin', run: runClaudeAdvisor };
  }
  if (lower === 'gemini-cli' || lower === 'gemini') {
    return { kind: 'builtin', run: runGeminiAdvisor };
  }
  return { kind: 'external', path: trimmed };
}

/** @type {ResolvedHandler} */
const RESOLVED_HANDLER = resolveHandler(handlerSpec);

function logLine(...args) {
  console.error('[poker-local-advisor]', ...args);
}

/** Clone-ish summary for logs: truncate long `description` / prompt fields. */
function summarizeForLog(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const o = { ...obj };
  for (const key of ['description', 'teamPrompt', 'personalPrompt', 'combinedPrompt']) {
    if (typeof o[key] === 'string' && o[key].length > LOG_TRUNC) {
      o[key] = `${o[key].slice(0, LOG_TRUNC)}… (truncated, ${o[key].length} chars total)`;
    }
  }
  return o;
}

function summarizeResponseForLog(result) {
  if (!result || typeof result !== 'object') return result;
  const r = { ...result };
  if (typeof r.reasoning === 'string' && r.reasoning.length > 300) {
    r.reasoning = `${r.reasoning.slice(0, 300)}… (truncated, ${r.reasoning.length} chars total)`;
  }
  return r;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function stubResponse(body) {
  const key = body?.ticketKey ?? 'unknown';
  return {
    mode: 'advice',
    points: 5,
    reasoning:
      `Stub response for ${key}. Run with --handler claude-code or --handler gemini-cli, set POKER_ADVISOR_HANDLER to a custom executable, or see README.`,
    abstain: false,
    splits: [],
  };
}

function stubContextResponse(body) {
  const key = body?.ticketKey ?? 'unknown';
  return {
    mode: 'context',
    context: `Stub context for ${key}. Run with --handler claude-code and update to a server that supports POST /context.`,
    points: 5,
    reasoning: 'Stub estimate; use a real handler for points and splits.',
    abstain: false,
    splits: [],
  };
}

function stubSplitDetailsResponse(body) {
  const st = typeof body?.splitTitle === 'string' ? body.splitTitle.trim() : '';
  const summary = (st || 'Split story').slice(0, 255);
  return {
    mode: 'split_details',
    summary,
    description: st
      ? `Stub split details for: ${st}. Run with --handler claude-code or gemini-cli for full text.`
      : 'Stub split details. Run with --handler claude-code or gemini-cli for full text.',
  };
}

function handlerLabel() {
  if (RESOLVED_HANDLER.kind === 'stub') return 'stub';
  if (RESOLVED_HANDLER.kind === 'builtin') {
    return RESOLVED_HANDLER.run === runClaudeAdvisor ? 'claude-code' : 'gemini-cli';
  }
  return RESOLVED_HANDLER.path;
}

/** Merge request correlation into the response so clients can match async results to a round. */
function attachCorrelation(parsed, result) {
  const roundId = typeof parsed.roundId === 'string' ? parsed.roundId : '';
  const ticketKey = typeof parsed.ticketKey === 'string' ? parsed.ticketKey : '';
  let roundNumber = parsed.roundNumber;
  if (typeof roundNumber !== 'number' || !Number.isFinite(roundNumber)) {
    roundNumber = Number(roundNumber);
  }
  if (typeof roundNumber !== 'number' || !Number.isFinite(roundNumber)) {
    roundNumber = 1;
  }
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return { ...result, roundId, ticketKey, roundNumber };
  }
  return result;
}

function runHandler(payloadStr) {
  if (RESOLVED_HANDLER.kind !== 'external') {
    return Promise.reject(new Error('runHandler requires an external handler'));
  }
  const exe = RESOLVED_HANDLER.path;
  return new Promise((resolve, reject) => {
    const child = spawn(exe, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });
    let out = '';
    let err = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => {
      out += c;
    });
    child.stderr.on('data', (c) => {
      err += c;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(err || `handler exited ${code}`));
        return;
      }
      try {
        const trimmed = out.trim();
        const json = JSON.parse(trimmed);
        resolve(json);
      } catch (e) {
        reject(new Error(`handler stdout is not valid JSON: ${out.slice(0, 200)}`));
      }
    });
    child.stdin.write(payloadStr);
    child.stdin.end();
  });
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;

  if (req.method === 'OPTIONS') {
    logLine('request', req.method, req.url ?? '', '(CORS preflight)');
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/health') {
    res.writeHead(200, corsHeaders());
    res.end(req.method === 'HEAD' ? '' : JSON.stringify({ ok: true, service: 'poker-local-advisor' }));
    return;
  }

  const isAdvise = req.method === 'POST' && pathname.startsWith('/advise');
  const isContext = req.method === 'POST' && pathname.startsWith('/context');
  const isSplitDetails = req.method === 'POST' && pathname.startsWith('/split-details');

  if (!isAdvise && !isContext && !isSplitDetails) {
    logLine('request', req.method, req.url ?? '', '→ 404 not found');
    res.writeHead(404, corsHeaders());
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  let parsed = {};
  try {
    parsed = body ? JSON.parse(body) : {};
  } catch (err) {
    logLine(
      `request POST ${isContext ? '/context' : isSplitDetails ? '/split-details' : '/advise'} invalid JSON`,
      err instanceof Error ? err.message : err,
    );
    logLine('raw body (first 500 chars):', body.slice(0, 500));
    res.writeHead(400, corsHeaders());
    const errBody = JSON.stringify({ error: 'Invalid JSON body' });
    logLine('response', 400, errBody);
    res.end(errBody);
    return;
  }

  logLine(
    `request POST ${isContext ? '/context' : isSplitDetails ? '/split-details' : '/advise'}`,
    JSON.stringify(summarizeForLog(parsed), null, 2),
  );

  try {
    let result;
    if (isContext) {
      if (RESOLVED_HANDLER.kind === 'builtin' && RESOLVED_HANDLER.run === runClaudeAdvisor) {
        result = await runClaudeContext(/** @type {Record<string, unknown>} */ (parsed));
      } else if (RESOLVED_HANDLER.kind === 'stub') {
        result = stubContextResponse(parsed);
      } else {
        res.writeHead(400, corsHeaders());
        res.end(JSON.stringify({ error: 'POST /context requires --handler claude-code (Claude Code CLI).' }));
        return;
      }
    } else if (isSplitDetails) {
      if (RESOLVED_HANDLER.kind === 'builtin' && RESOLVED_HANDLER.run === runClaudeAdvisor) {
        result = await runClaudeSplitDetails(/** @type {Record<string, unknown>} */ (parsed));
      } else if (RESOLVED_HANDLER.kind === 'builtin' && RESOLVED_HANDLER.run === runGeminiAdvisor) {
        result = await runGeminiSplitDetails(/** @type {Record<string, unknown>} */ (parsed));
      } else if (RESOLVED_HANDLER.kind === 'external') {
        result = await runHandler(body);
      } else if (RESOLVED_HANDLER.kind === 'stub') {
        result = stubSplitDetailsResponse(parsed);
      } else {
        res.writeHead(400, corsHeaders());
        res.end(
          JSON.stringify({
            error: 'POST /split-details requires --handler claude-code, gemini-cli, stub, or an external executable.',
          }),
        );
        return;
      }
    } else {
      if (RESOLVED_HANDLER.kind === 'builtin') {
        result = await RESOLVED_HANDLER.run(
          /** @type {Record<string, unknown>} */ (parsed),
        );
      } else if (RESOLVED_HANDLER.kind === 'external') {
        result = await runHandler(body);
      } else {
        result = stubResponse(parsed);
      }
    }
    result = attachCorrelation(parsed, result);
    const out = JSON.stringify(result);
    logLine('response 200', JSON.stringify(summarizeResponseForLog(result)));
    res.writeHead(200, corsHeaders());
    res.end(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Handler failed';
    logLine('handler error', msg);
    const errPayload = JSON.stringify({ error: msg });
    logLine('response 500', errPayload);
    res.writeHead(500, corsHeaders());
    res.end(errPayload);
  }
});

server.listen(PORT, HOST, () => {
  console.error(
    `[poker-local-advisor] listening on http://${HOST}:${PORT} (GET /health, POST /advise, POST /context, POST /split-details; handler=${handlerLabel()})`,
  );
});
