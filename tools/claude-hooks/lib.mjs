/**
 * tools/claude-hooks/lib.mjs — shared helpers for the synthex-hooks command hooks.
 *
 * Hook input arrives as one JSON object on stdin (hooks reference, "Hook input and output").
 * Output is one JSON object on stdout with exit 0 ("JSON output", "Exit code 0").
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOOKS_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Project root: $CLAUDE_PROJECT_DIR (set by Claude Code), else the input cwd, else this repo. */
export function projectRoot(input = {}) {
  return (
    process.env.CLAUDE_PROJECT_DIR ||
    input.cwd ||
    path.resolve(HOOKS_DIR, '..', '..')
  );
}

export function readInput() {
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    raw = '';
  }
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

export function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

/** Run a command without a shell. code 124 = timed out or could not start. */
export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd,
    encoding: 'utf8',
    timeout: opts.timeout ?? 10000,
    env: { ...process.env, ...(opts.env || {}) },
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    code: r.status === null ? 124 : r.status,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
    error: r.error ? r.error.message : null,
  };
}

/**
 * Secret patterns for new content (H6) and ledger redaction (H11). A subset of the gitleaks
 * default rules plus the Stripe live-key prefixes; each needs enough key body to avoid prose hits.
 */
export const SECRET_PATTERNS = [
  [/\b[sr]k_live_[0-9A-Za-z]{16,}/, 'Stripe live key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key block'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [
    /\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{50,}/,
    'GitHub token',
  ],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'Google API key'],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/, 'Anthropic key'],
  [/\bsk-(proj-|or-v1-)?[A-Za-z0-9_-]{32,}/, 'OpenAI/OpenRouter-style key'],
  [/\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/, 'SendGrid key'],
  [/\bwhsec_[A-Za-z0-9]{24,}/, 'webhook signing secret'],
  [
    /postgres(ql)?:\/\/[^:\s/]+:[^@\s]{6,}@(?!localhost|127\.0\.0\.1)/,
    'database URL with password',
  ],
];
export const findSecret = text =>
  SECRET_PATTERNS.find(([re]) => re.test(String(text || '')))?.[1] ?? null;
export const redact = text =>
  SECRET_PATTERNS.reduce(
    (t, [re]) => t.replace(new RegExp(re.source, 'g'), '[REDACTED]'),
    String(text || '')
  );

export function utcDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** H9: the halt files scripts/fleet/lib.mjs haltState() reads (security STOP or today's STOP-<date>). */
export function haltFiles(root, pol) {
  const dir = path.join(root, (pol && pol.halt_dir) || 'release-receipts/halt');
  return ['STOP', `STOP-${utcDate()}`].filter(f =>
    existsSync(path.join(dir, f))
  );
}
