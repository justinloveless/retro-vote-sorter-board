#!/usr/bin/env node
/**
 * Poker local advisor handler: Google Gemini CLI (`gemini`).
 *
 * Expects JSON on stdin (Retroscope /advise body). Prints one JSON object to stdout.
 *
 * Requires `gemini` on PATH (see https://google-gemini.github.io/gemini-cli/) and auth configured.
 *
 * Env:
 *   GEMINI_BIN   — default: gemini
 *   GEMINI_ARGS  — optional extra args, space-separated (e.g. --output-format json)
 */

import { spawn } from 'node:child_process';
import {
  readStdin,
  buildEstimationPrompt,
  extractJsonObject,
  normalizeAdvisorResult,
} from './_shared.mjs';

function splitArgs(str) {
  if (!str || !str.trim()) return [];
  return str
    .trim()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function runGemini(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env: process.env,
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
        reject(new Error(err || `gemini exited with code ${code}`));
        return;
      }
      resolve(out);
    });
  });
}

async function main() {
  const raw = await readStdin();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    console.error('Invalid JSON on stdin');
    process.exit(1);
  }

  const prompt = buildEstimationPrompt(payload);
  const bin = process.env.GEMINI_BIN || 'gemini';
  const extra = splitArgs(process.env.GEMINI_ARGS || '');
  const args = ['-p', prompt, ...extra];

  const out = await runGemini(bin, args);
  const parsed = extractJsonObject(out);
  const result = normalizeAdvisorResult(parsed);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
