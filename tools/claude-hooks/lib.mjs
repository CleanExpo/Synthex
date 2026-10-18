/**
 * tools/claude-hooks/lib.mjs — shared helpers for the synthex-hooks command hooks.
 *
 * Hook input arrives as one JSON object on stdin (hooks reference, "Hook input and output").
 * Output is one JSON object on stdout with exit 0 ("JSON output", "Exit code 0").
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
