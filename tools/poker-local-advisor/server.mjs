#!/usr/bin/env node
/**
 * Reference local advisor server for Retroscope poker.
 * POST /advise — JSON body in, JSON { points, reasoning } out.
 *
 * Optional: POKER_ADVISOR_HANDLER=/path/to/executable
 *   Executable receives JSON on stdin; must print JSON on stdout.
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
const PORT = Number(process.env.PORT || 17300);
const HANDLER = process.env.POKER_ADVISOR_HANDLER || '';
const LOG_TRUNC = 400;

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function stubResponse(body) {
  const key = body?.ticketKey ?? 'unknown';
  return {
    points: 5,
    reasoning:
      `Stub response for ${key}. Set POKER_ADVISOR_HANDLER to a script that calls your CLI and prints JSON with points and reasoning.`,
  };
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
  return new Promise((resolve, reject) => {
    const child = spawn(HANDLER, [], {
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
  if (req.method === 'OPTIONS') {
    logLine('request', req.method, req.url ?? '', '(CORS preflight)');
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method !== 'POST' || !req.url?.startsWith('/advise')) {
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
    logLine('request POST /advise invalid JSON', err instanceof Error ? err.message : err);
    logLine('raw body (first 500 chars):', body.slice(0, 500));
    res.writeHead(400, corsHeaders());
    const errBody = JSON.stringify({ error: 'Invalid JSON body' });
    logLine('response', 400, errBody);
    res.end(errBody);
    return;
  }

  logLine('request POST /advise', JSON.stringify(summarizeForLog(parsed), null, 2));

  try {
    let result;
    if (HANDLER) {
      result = await runHandler(body);
    } else {
      result = stubResponse(parsed);
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

server.listen(PORT, '127.0.0.1', () => {
  console.error(
    `[poker-local-advisor] listening on http://127.0.0.1:${PORT}/advise (handler=${HANDLER || 'stub'})`,
  );
});
