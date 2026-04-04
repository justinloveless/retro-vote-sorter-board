#!/usr/bin/env node
/**
 * Local advisor: draft Jira summary + description for a proposed story split (Claude Code CLI).
 */

import { spawn } from 'node:child_process';
import {
  buildSplitDetailsPrompt,
  extractJsonObject,
  normalizeSplitDetailsResult,
} from './_shared.mjs';

function splitArgs(str) {
  if (!str || !str.trim()) return [];
  return str
    .trim()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function runClaude(bin, args) {
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
        reject(new Error(err || `claude exited with code ${code}`));
        return;
      }
      resolve(out);
    });
  });
}

/**
 * @param {Record<string, unknown>} payload
 */
export async function runClaudeSplitDetails(payload) {
  const prompt = buildSplitDetailsPrompt(payload);
  const bin = process.env.CLAUDE_BIN || 'claude';
  const extra = splitArgs(process.env.CLAUDE_ARGS || '');
  const args = ['-p', prompt, ...extra];

  const out = await runClaude(bin, args);
  const parsed = extractJsonObject(out);
  return normalizeSplitDetailsResult(parsed);
}
