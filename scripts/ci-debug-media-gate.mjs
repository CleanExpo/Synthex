#!/usr/bin/env node
//
// scripts/ci-debug-media-gate.mjs
//
// Lane Synthex, bounded work item: make the failing CI media-asset gate
// debuggable from the agent's surface. The gate runs `npm run media:check`
// (which calls scripts/optimize-media.mjs --check). When the gate fails in
// CI but the script passes locally, the agent's bounded work is to capture
// the failure pattern in a way that's reviewable.
//
// This script:
// 1. Runs the same `npm run media:check` command
// 2. Captures stdout, stderr, exit code
// 3. If the script fails, parses the output for the actual reason
// 4. Writes a structured JSON to .artifacts/media-gate-result.json (gitignored)
//
// Bounded, no env reads, no secrets, no deploy. Local-only.
//
// Pattern source: scripts/optimize-media.mjs (the actual media:check runner)

import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const ARTIFACTS_DIR = path.join(ROOT, '.artifacts');
const OUTPUT_PATH = path.join(ARTIFACTS_DIR, 'media-gate-result.json');

function tail(s, max = 4000) {
  if (s.length <= max) return s;
  return `... [${s.length - max} chars omitted] ...\n` + s.slice(-max);
}

function extractLines(s, predicate) {
  return s.split('\n').filter(predicate).map((l) => l.trim()).filter(Boolean);
}

async function main() {
  const result = spawnSync('npm', ['run', 'media:check', '--silent'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const exit = result.status ?? -1;

  const failLines = extractLines(
    stdout + stderr,
    (l) => {
      const low = l.toLowerCase();
      return (
        low.startsWith('fail:') ||
        low.startsWith('fails:') ||
        low.startsWith('error:') ||
        low.startsWith('errors:') ||
        low.startsWith('fail ') ||
        low.startsWith('fatal') ||
        // The optimize-media.mjs script outputs "Warnings:" as a header
        // line followed by "- " prefixed lines. Mark the header as fail
        // if there are no other fail lines and it has content.
        (low.startsWith('warnings:') && l.trim().endsWith(':'))
      );
    },
  );
  const warnLines = extractLines(
    stdout + stderr,
    (l) => {
      const low = l.toLowerCase();
      return (
        low.startsWith('warn:') ||
        low.startsWith('warning:') ||
        // Catch "  - foo bar" lines that follow a "Warnings:" header
        l.trim().startsWith('- ') && l.length > 4
      );
    },
  );

  const gateResult = {
    ran_at: new Date().toISOString(),
    exit_code: exit,
    stdout_tail: tail(stdout),
    stderr_tail: tail(stderr),
    summary: {
      passed: exit === 0,
      fail_lines: failLines,
      warn_lines: warnLines,
    },
    script_paths: {
      cwd: ROOT,
      npm_script: 'media:check',
      runner_script: path.join(ROOT, 'scripts', 'optimize-media.mjs'),
    },
  };

  await mkdir(ARTIFACTS_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(gateResult, null, 2));

  const shortSummary = gateResult.summary.passed
    ? `[PASS] media:check (exit=${exit}, ${warnLines.length} warnings)`
    : `[FAIL] media:check (exit=${exit}, ${failLines.length} fails, ${warnLines.length} warnings)`;
  console.log(shortSummary);
  console.log(`  full result: ${OUTPUT_PATH}`);

  if (failLines.length > 0) {
    console.log('  --- fail lines ---');
    for (const l of failLines.slice(0, 20)) console.log(`    ${l}`);
  }
  if (warnLines.length > 0) {
    console.log('  --- warn lines ---');
    for (const l of warnLines.slice(0, 20)) console.log(`    ${l}`);
  }

  process.exit(exit);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error(`[ci-debug-media-gate] ${message}`);
  process.exit(2);
});
